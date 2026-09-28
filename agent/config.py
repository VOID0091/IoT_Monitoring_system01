import os
import uuid
import socket
from typing import Optional

def get_default_device_id() -> str:
    """Generate a stable default device ID based on hostname."""
    try:
        hostname = socket.gethostname().lower().replace(" ", "_")
        return f"device-{hostname}"
    except Exception:
        # Fallback to random UUID if hostname fails
        return f"device-{uuid.uuid4().hex[:8]}"

# Load .env file manually if present to avoid strict dependency on python-dotenv
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

# MQTT Settings
MQTT_HOST: str = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT: int = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_USERNAME: Optional[str] = os.environ.get("MQTT_USERNAME", None)
MQTT_PASSWORD: Optional[str] = os.environ.get("MQTT_PASSWORD", None)
MQTT_KEEPALIVE: int = int(os.environ.get("MQTT_KEEPALIVE", "60"))
MQTT_CLEAN_SESSION: bool = True

# Device settings
DEVICE_ID: str = os.environ.get("DEVICE_ID", get_default_device_id())
DEVICE_NAME: str = os.environ.get("DEVICE_NAME", f"Agent - {socket.gethostname()}")
DEVICE_GROUP: str = os.environ.get("DEVICE_GROUP", "Production")
DEVICE_LOCATION: str = os.environ.get("DEVICE_LOCATION", "Main Hall")
DEVICE_DESCRIPTION: str = os.environ.get("DEVICE_DESCRIPTION", "Industrial IoT Smart Client Agent")

# Intervals
TELEMETRY_INTERVAL: int = int(os.environ.get("TELEMETRY_INTERVAL", "10"))  # Seconds
HEARTBEAT_INTERVAL: int = int(os.environ.get("HEARTBEAT_INTERVAL", "30"))  # Seconds
