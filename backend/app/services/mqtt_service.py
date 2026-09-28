import asyncio
import json
import logging
from typing import TYPE_CHECKING
from datetime import datetime, timezone

import aiomqtt
from app.core.config import settings

if TYPE_CHECKING:
    from app.services.ws_manager import WebSocketManager

logger = logging.getLogger(__name__)


class MQTTService:
    def __init__(self):
        self.client: aiomqtt.Client | None = None
        self.ws_manager: "WebSocketManager | None" = None
        self._task: asyncio.Task | None = None
        self._running = False

    def set_ws_manager(self, ws_manager: "WebSocketManager"):
        self.ws_manager = ws_manager

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()

    async def _run_loop(self):
        while self._running:
            try:
                await self._connect_and_listen()
            except Exception as e:
                logger.error(f"MQTT connection error: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)

    async def _connect_and_listen(self):
        kwargs = dict(
            hostname=settings.MQTT_HOST,
            port=settings.MQTT_PORT,
            identifier=settings.MQTT_CLIENT_ID,
            keepalive=settings.MQTT_KEEPALIVE,
        )
        if settings.MQTT_USERNAME:
            kwargs["username"] = settings.MQTT_USERNAME
            kwargs["password"] = settings.MQTT_PASSWORD

        async with aiomqtt.Client(**kwargs) as client:
            self.client = client
            logger.info(f"Connected to MQTT broker at {settings.MQTT_HOST}:{settings.MQTT_PORT}")
            await client.subscribe("iot/devices/#")
            await client.subscribe("iot/events/#")

            async for message in client.messages:
                if not self._running:
                    break
                await self._handle_message(str(message.topic), message.payload)

    async def _handle_message(self, topic: str, payload: bytes):
        try:
            data = json.loads(payload.decode())
        except Exception:
            return

        parts = topic.split("/")
        # iot/devices/{device_id}/{type}
        if len(parts) >= 4 and parts[0] == "iot" and parts[1] == "devices":
            device_id = parts[2]
            msg_type = parts[3]

            from app.services.device_service import DeviceService
            from app.db.database import AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                svc = DeviceService(db)
                if msg_type == "telemetry":
                    await svc.ingest_telemetry(device_id, data)
                elif msg_type == "heartbeat":
                    await svc.handle_heartbeat(device_id, data)
                elif msg_type == "capabilities":
                    await svc.update_capabilities(device_id, data)
                elif msg_type == "status":
                    await svc.update_status(device_id, data.get("status", "online"))

            # Broadcast to WebSocket clients
            if self.ws_manager:
                await self.ws_manager.broadcast({
                    "event": f"device.{msg_type}",
                    "device_id": device_id,
                    "data": data,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

    async def publish(self, topic: str, payload: dict, qos: int = 1):
        if self.client:
            try:
                await self.client.publish(topic, json.dumps(payload), qos=qos)
            except Exception as e:
                logger.error(f"MQTT publish failed: {e}")

    async def send_command(self, device_id: str, command: str, params: dict = None):
        topic = f"iot/commands/{device_id}/{command}"
        await self.publish(topic, params or {})


mqtt_service = MQTTService()
