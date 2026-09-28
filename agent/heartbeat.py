import json
import logging
import time
import config
from platform_abstraction import get_platform_adapter

logger = logging.getLogger("heartbeat")

class HeartbeatSystem:
    def __init__(self, mqtt_client):
        self.mqtt_client = mqtt_client
        self.platform = get_platform_adapter()
        self.version = "1.0.0"

    def send_heartbeat(self) -> bool:
        """Publish a heartbeat message containing basic device operational state."""
        topic = f"iot/devices/{config.DEVICE_ID}/heartbeat"
        payload = json.dumps({
            "device_id": config.DEVICE_ID,
            "status": "online",
            "uptime_seconds": self.platform.get_uptime(),
            "timestamp": time.time()
        })
        success = self.mqtt_client.publish(topic, payload, qos=0)
        if success:
            logger.debug(f"Heartbeat sent to {topic}")
        return success

    def send_capabilities(self) -> bool:
        """Publish device hardware capability details and static descriptors."""
        topic = f"iot/devices/{config.DEVICE_ID}/capabilities"
        info = self.platform.get_platform_info()
        
        payload = json.dumps({
            "device_id": config.DEVICE_ID,
            "name": config.DEVICE_NAME,
            "hostname": self.platform.get_hostname(),
            "group_name": config.DEVICE_GROUP,
            "location": config.DEVICE_LOCATION,
            "description": config.DEVICE_DESCRIPTION,
            "platform": info.get("platform", "unknown"),
            "os_version": info.get("os_name", "unknown"),
            "agent_version": self.version,
            "capabilities": [
                {"capability": "cpu_monitoring", "value": "enabled"},
                {"capability": "ram_monitoring", "value": "enabled"},
                {"capability": "disk_monitoring", "value": "enabled"},
                {"capability": "temperature_sensing", "value": "enabled"},
                {"capability": "remote_reboot", "value": "enabled"},
                {"capability": "network_configuration", "value": "enabled"}
            ]
        })
        success = self.mqtt_client.publish(topic, payload, qos=1, retain=True)
        if success:
            logger.info(f"Capabilities reported to {topic}")
        return success
