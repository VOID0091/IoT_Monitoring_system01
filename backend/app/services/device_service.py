import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc
from app.db.models import Device, Telemetry, Alert, DeviceCapability
from app.core.config import settings

logger = logging.getLogger(__name__)


class DeviceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_device(self, device_id: str) -> Device:
        result = await self.db.execute(select(Device).where(Device.device_id == device_id))
        device = result.scalar_one_or_none()
        if not device:
            device = Device(device_id=device_id, name=device_id, status="online")
            self.db.add(device)
            await self.db.commit()
            await self.db.refresh(device)
        return device

    async def handle_heartbeat(self, device_id: str, data: dict):
        device = await self.get_or_create_device(device_id)
        now = datetime.now(timezone.utc)
        device.last_seen = now
        device.status = "online"
        if "hostname" in data:
            device.hostname = data["hostname"]
        if "ip_address" in data:
            device.ip_address = data["ip_address"]
        if "platform" in data:
            device.platform = data["platform"]
        if "os_version" in data:
            device.os_version = data["os_version"]
        if "agent_version" in data:
            device.agent_version = data["agent_version"]
        if "mac_address" in data:
            device.mac_address = data["mac_address"]
        await self.db.commit()

    async def ingest_telemetry(self, device_id: str, data: dict):
        device = await self.get_or_create_device(device_id)
        device.last_seen = datetime.now(timezone.utc)

        telemetry = Telemetry(
            device_id=device_id,
            cpu_percent=data.get("cpu_percent"),
            ram_percent=data.get("ram_percent"),
            ram_used_mb=data.get("ram_used_mb"),
            ram_total_mb=data.get("ram_total_mb"),
            disk_percent=data.get("disk_percent"),
            disk_used_gb=data.get("disk_used_gb"),
            disk_total_gb=data.get("disk_total_gb"),
            temperature=data.get("temperature"),
            uptime_seconds=data.get("uptime_seconds"),
            net_bytes_sent=data.get("net_bytes_sent"),
            net_bytes_recv=data.get("net_bytes_recv"),
        )
        self.db.add(telemetry)

        # Auto-generate alerts based on thresholds
        await self._check_thresholds(device, data)
        await self.db.commit()

    async def _check_thresholds(self, device: Device, data: dict):
        cpu = data.get("cpu_percent")
        ram = data.get("ram_percent")
        temp = data.get("temperature")

        async def maybe_alert(metric, value, warn, crit, unit=""):
            if value is None:
                return
            if value >= crit:
                await self._create_alert(device.device_id, "critical", "telemetry",
                    f"{metric} critical: {value:.1f}{unit} (threshold: {crit}{unit})")
            elif value >= warn:
                await self._create_alert(device.device_id, "warning", "telemetry",
                    f"{metric} warning: {value:.1f}{unit} (threshold: {warn}{unit})")

        await maybe_alert("CPU", cpu, settings.CPU_WARNING_THRESHOLD, settings.CPU_CRITICAL_THRESHOLD, "%")
        await maybe_alert("RAM", ram, settings.RAM_WARNING_THRESHOLD, settings.RAM_CRITICAL_THRESHOLD, "%")
        await maybe_alert("Temperature", temp, settings.TEMP_WARNING_THRESHOLD, settings.TEMP_CRITICAL_THRESHOLD, "°C")

        # Update device status
        device_status = "online"
        if cpu and cpu >= settings.CPU_CRITICAL_THRESHOLD:
            device_status = "critical"
        elif ram and ram >= settings.RAM_CRITICAL_THRESHOLD:
            device_status = "critical"
        elif cpu and cpu >= settings.CPU_WARNING_THRESHOLD:
            device_status = "warning"
        elif ram and ram >= settings.RAM_WARNING_THRESHOLD:
            device_status = "warning"
        device.status = device_status

    async def _create_alert(self, device_id: str, severity: str, category: str, message: str):
        alert = Alert(device_id=device_id, severity=severity, category=category, message=message)
        self.db.add(alert)

    async def update_capabilities(self, device_id: str, data: dict):
        device = await self.get_or_create_device(device_id)
        # Remove existing capabilities and replace
        existing = await self.db.execute(
            select(DeviceCapability).where(DeviceCapability.device_id == device_id)
        )
        for cap in existing.scalars():
            await self.db.delete(cap)

        caps_list = data.get("capabilities")
        if isinstance(caps_list, list):
            for item in caps_list:
                if isinstance(item, dict) and "capability" in item:
                    cap_name = item["capability"]
                    cap_value = item.get("value")
                    cap = DeviceCapability(
                        device_id=device_id,
                        capability=cap_name,
                        value=str(cap_value) if cap_value is not None else None
                    )
                    self.db.add(cap)
        else:
            for cap_name, cap_value in data.items():
                cap = DeviceCapability(device_id=device_id, capability=cap_name, value=str(cap_value))
                self.db.add(cap)
        await self.db.commit()

    async def update_status(self, device_id: str, status: str):
        device = await self.get_or_create_device(device_id)
        device.status = status
        device.last_seen = datetime.now(timezone.utc)
        await self.db.commit()

    async def mark_offline_devices(self):
        """Called periodically to mark devices that haven't sent heartbeat as offline."""
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.DEVICE_OFFLINE_TIMEOUT_SECONDS)
        result = await self.db.execute(
            select(Device).where(Device.last_seen < cutoff, Device.status != "offline", Device.status != "maintenance")
        )
        for device in result.scalars():
            device.status = "offline"
            await self._create_alert(device.device_id, "warning", "system",
                f"Device {device.name} went offline (no heartbeat for {settings.DEVICE_OFFLINE_TIMEOUT_SECONDS}s)")
        await self.db.commit()
