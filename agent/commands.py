import json
import logging
from typing import Dict, Any
import config
from platform_abstraction import get_platform_adapter
from network_adapters import get_network_adapter

logger = logging.getLogger("commands")

class CommandHandler:
    def __init__(self, mqtt_client):
        self.mqtt_client = mqtt_client
        self.platform = get_platform_adapter()
        self.network = get_network_adapter()

    def handle_command(self, topic: str, payload_bytes: bytes) -> None:
        """Parse the topic and trigger actions based on sub-topics."""
        # Topic format: iot/commands/{device_id}/{action}
        parts = topic.split("/")
        if len(parts) < 4:
            logger.error(f"Malformed command topic: {topic}")
            return
            
        action = parts[3]
        payload_str = payload_bytes.decode("utf-8", errors="ignore")
        logger.info(f"Dispatching action '{action}' with payload: {payload_str}")
        
        try:
            payload = json.loads(payload_str) if payload_str.strip() else {}
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON command payload: {payload_str}")
            self.send_response(action, False, "Invalid JSON payload")
            return

        if action == "reboot":
            self._handle_reboot()
        elif action == "hostname":
            self._handle_hostname(payload)
        elif action == "network":
            self._handle_network(payload)
        else:
            logger.warning(f"Unknown command action received: {action}")
            self.send_response(action, False, f"Unknown action: {action}")

    def send_response(self, action: str, success: bool, message: str) -> None:
        """Publish responses back to the server."""
        response_topic = f"iot/events/{config.DEVICE_ID}/response"
        response_payload = json.dumps({
            "device_id": config.DEVICE_ID,
            "action": action,
            "success": success,
            "message": message
        })
        self.mqtt_client.publish(response_topic, response_payload)
        logger.info(f"Published command response to {response_topic}: {response_payload}")

    def _handle_reboot(self) -> None:
        logger.info("Executing reboot command...")
        self.send_response("reboot", True, "Reboot command accepted. System is restarting...")
        # Give a small delay to let response publish before shutting down
        import time
        time.sleep(1)
        self.platform.reboot()

    def _handle_hostname(self, payload: Dict[str, Any]) -> None:
        new_hostname = payload.get("hostname")
        if not new_hostname:
            self.send_response("hostname", False, "Missing 'hostname' parameter")
            return
            
        logger.info(f"Changing hostname to {new_hostname}...")
        success = self.platform.set_hostname(new_hostname)
        if success:
            self.send_response("hostname", True, f"Hostname successfully changed to {new_hostname}. Reboot may be required.")
        else:
            self.send_response("hostname", False, "Failed to change hostname. Permissions or platform error.")

    def _handle_network(self, payload: Dict[str, Any]) -> None:
        iface = payload.get("interface")
        dhcp = payload.get("dhcp", True)
        
        if not iface:
            self.send_response("network", False, "Missing 'interface' parameter")
            return
            
        if dhcp:
            logger.info(f"Setting DHCP mode on interface {iface}...")
            # Safely configure DHCP with connection check
            success = self.network.set_dhcp_safe(iface)
            if success:
                self.send_response("network", True, f"Interface {iface} set to DHCP successfully.")
            else:
                self.send_response("network", False, f"Failed to get DHCP lease on {iface}. Rolled back.")
        else:
            ip = payload.get("ip_address")
            netmask = payload.get("netmask")
            gateway = payload.get("gateway")
            dns = payload.get("dns", [])
            
            if not all([ip, netmask, gateway]):
                self.send_response("network", False, "Missing static IP parameters (ip_address, netmask, gateway)")
                return
                
            logger.info(f"Setting static IP {ip} on interface {iface}...")
            # Safely configure Static IP with connection check
            success = self.network.set_static_ip_safe(iface, ip, netmask, gateway, dns)
            if success:
                self.send_response("network", True, f"Interface {iface} configured with static IP {ip} successfully.")
            else:
                self.send_response("network", False, f"Static IP configuration failed or lost connection. Rolled back.")
