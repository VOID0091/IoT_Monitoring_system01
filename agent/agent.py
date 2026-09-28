import time
import logging
import json
import sys
import config
from mqtt_client import AgentMQTTClient
from commands import CommandHandler
from heartbeat import HeartbeatSystem
from collectors import collect_all_metrics
from platform_abstraction import get_platform_adapter
from network_adapters import get_network_adapter

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("agent")

class IoTAgent:
    def __init__(self):
        logger.info(f"Initializing IoT Monitor Device Agent (Device ID: {config.DEVICE_ID})")
        
        self.cmd_handler = None
        self.mqtt_client = AgentMQTTClient(on_command_callback=self._on_command_received)
        self.cmd_handler = CommandHandler(self.mqtt_client)
        self.heartbeat_system = HeartbeatSystem(self.mqtt_client)
        self.platform = get_platform_adapter()
        self.network = get_network_adapter()
        
        self.running = False

    def _on_command_received(self, topic: str, payload: bytes) -> None:
        if self.cmd_handler:
            self.cmd_handler.handle_command(topic, payload)

    def report_ip_addresses(self):
        """Find the primary IP/MAC address and publish capabilities again if they change."""
        try:
            interfaces = self.network.get_interfaces()
            primary_ip = None
            primary_mac = None
            
            # Look for non-loopback active ethernet or wifi adapters
            for iface in interfaces:
                if iface.status == "up" and iface.ip_address and iface.ip_address != "127.0.0.1":
                    primary_ip = iface.ip_address
                    # Attempt to resolve mac using psutil
                    import psutil
                    for name, addrs in psutil.net_if_addrs().items():
                        if name == iface.name:
                            for addr in addrs:
                                if addr.family == psutil.AF_LINK if hasattr(psutil, "AF_LINK") else -1:
                                    primary_mac = addr.address
                                    break
                    break
                    
            logger.info(f"Detected primary network interface: IP={primary_ip}, MAC={primary_mac}")
            
            # Send initial IP report
            status_topic = f"iot/devices/{config.DEVICE_ID}/status"
            payload = json.dumps({
                "device_id": config.DEVICE_ID,
                "ip_address": primary_ip,
                "mac_address": primary_mac,
                "status": "online"
            })
            self.mqtt_client.publish(status_topic, payload, qos=1, retain=True)
        except Exception as e:
            logger.error(f"Error reporting IP address: {e}")

    def run(self):
        self.running = True
        
        # Connect to broker
        connected = self.mqtt_client.connect()
        if not connected:
            logger.error("Could not connect to MQTT broker. Retrying in background...")
            
        # Give MQTT client a moment to establish connection
        time.sleep(2)
        
        # Report device capabilities and initial status
        self.heartbeat_system.send_capabilities()
        self.report_ip_addresses()
        
        last_heartbeat = 0.0
        last_telemetry = 0.0
        
        logger.info("Agent started successfully. Running main execution loop...")
        
        try:
            while self.running:
                now = time.time()
                
                # Check MQTT connection status
                if not self.mqtt_client.connected:
                    logger.warning("MQTT disconnected, waiting for auto-reconnect...")
                    time.sleep(2)
                    continue
                
                # Heartbeat Timer
                if now - last_heartbeat >= config.HEARTBEAT_INTERVAL:
                    try:
                        self.heartbeat_system.send_heartbeat()
                        last_heartbeat = now
                    except Exception as e:
                        logger.error(f"Error sending heartbeat: {e}")
                        
                # Telemetry Timer
                if now - last_telemetry >= config.TELEMETRY_INTERVAL:
                    try:
                        metrics = collect_all_metrics()
                        metrics["device_id"] = config.DEVICE_ID
                        
                        telemetry_topic = f"iot/devices/{config.DEVICE_ID}/telemetry"
                        self.mqtt_client.publish(telemetry_topic, json.dumps(metrics), qos=0)
                        logger.debug(f"Telemetry metrics sent: {metrics}")
                        last_telemetry = now
                    except Exception as e:
                        logger.error(f"Error collecting or sending telemetry: {e}")
                
                # Small sleep to yield CPU
                time.sleep(0.5)
                
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received. Stopping agent...")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        # Report offline status prior to clean shutdown
        if self.mqtt_client.connected:
            status_topic = f"iot/devices/{config.DEVICE_ID}/status"
            payload = json.dumps({
                "device_id": config.DEVICE_ID,
                "status": "offline"
            })
            # Publish with QoS 1 to ensure delivery before disconnecting
            self.mqtt_client.publish(status_topic, payload, qos=1, retain=True)
            time.sleep(0.5)
            
        self.mqtt_client.disconnect()
        logger.info("Agent stopped.")

def main():
    agent = IoTAgent()
    agent.run()

if __name__ == "__main__":
    main()
