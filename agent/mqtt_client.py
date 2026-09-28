import time
import logging
import paho.mqtt.client as mqtt
from typing import Callable, Optional
import config

logger = logging.getLogger("mqtt_client")
logging.basicConfig(level=logging.INFO)

class AgentMQTTClient:
    def __init__(self, on_command_callback: Optional[Callable[[str, bytes], None]] = None):
        self.client_id = f"{config.DEVICE_ID}-agent"
        # Supporting paho-mqtt v1 & v2 API compatibility
        self.client = mqtt.Client(
            client_id=self.client_id,
            clean_session=config.MQTT_CLEAN_SESSION
        )
        self.on_command = on_command_callback
        self.connected = False
        
        # Register callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        
        if config.MQTT_USERNAME:
            self.client.username_pw_set(config.MQTT_USERNAME, config.MQTT_PASSWORD)

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            logger.info("Connected to MQTT Broker!")
            self.connected = True
            
            # Subscribe to command topics for this device
            cmd_topic = f"iot/commands/{config.DEVICE_ID}/#"
            self.client.subscribe(cmd_topic)
            logger.info(f"Subscribed to topic: {cmd_topic}")
        else:
            logger.error(f"Failed to connect to MQTT Broker, return code {rc}")
            self.connected = False

    def _on_disconnect(self, client, userdata, rc, properties=None):
        logger.warning(f"Disconnected from MQTT Broker (rc: {rc}). Reconnection handled by loop.")
        self.connected = False

    def _on_message(self, client, userdata, msg):
        logger.info(f"Received message on topic: {msg.topic}")
        if self.on_command:
            try:
                self.on_command(msg.topic, msg.payload)
            except Exception as e:
                logger.error(f"Error executing command: {e}")

    def connect(self) -> bool:
        """Connect to broker and start loop thread."""
        logger.info(f"Connecting to MQTT Broker at {config.MQTT_HOST}:{config.MQTT_PORT}...")
        try:
            self.client.connect(
                host=config.MQTT_HOST,
                port=config.MQTT_PORT,
                keepalive=config.MQTT_KEEPALIVE
            )
            self.client.loop_start()
            return True
        except Exception as e:
            logger.error(f"Failed to initiate connection: {e}")
            return False

    def publish(self, topic: str, payload: str, qos: int = 1, retain: bool = False) -> bool:
        """Publish payload thread-safely."""
        if not self.connected:
            logger.warning(f"Cannot publish: Client is disconnected. Dropping message for {topic}.")
            return False
        try:
            info = self.client.publish(topic, payload, qos=qos, retain=retain)
            # Wait for publish confirmation in a non-blocking way
            return info.rc == mqtt.MQTT_ERR_SUCCESS
        except Exception as e:
            logger.error(f"Error publishing to {topic}: {e}")
            return False

    def disconnect(self):
        """Clean disconnect."""
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("Disconnected client and stopped loop.")
