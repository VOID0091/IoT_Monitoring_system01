import os
import sys
import json
from pathlib import Path
from typing import Dict, Any

# Determine system-wide AppData path
IS_FROZEN = getattr(sys, "frozen", False)
IS_PRODUCTION = os.environ.get("PHANTOMATION_DEVICEOPS_ENV") == "production" or IS_FROZEN

if os.name == "nt" and IS_PRODUCTION:
    APP_DATA_DIR = Path("C:/ProgramData/PhantomationDeviceOps")
else:
    # Local fallback for development and non-Windows runtimes
    APP_DATA_DIR = Path(os.getcwd()) / "app_data"

CONFIG_DIR = APP_DATA_DIR / "config"
LOGS_DIR = APP_DATA_DIR / "logs"
DATA_DIR = APP_DATA_DIR / "data"
BACKUPS_DIR = APP_DATA_DIR / "backups"

def ensure_directories():
    """Ensure all required application data directories exist."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

def load_settings_dict() -> Dict[str, Any]:
    """Load settings from settings.json or generate defaults if missing."""
    ensure_directories()
    config_file = CONFIG_DIR / "settings.json"
    
    defaults = {
        "DEBUG": False,
        "PORT": 8080,
        "SECRET_KEY": "change-this-to-a-very-long-random-secret-key-in-production",
        "DATABASE_URL": f"sqlite+aiosqlite:///{DATA_DIR.as_posix()}/phantomation_deviceops.db",
        "MQTT_HOST": "127.0.0.1",
        "MQTT_PORT": 1883,
        "MQTT_USERNAME": "",
        "MQTT_PASSWORD": "",
        "CPU_WARNING_THRESHOLD": 75.0,
        "CPU_CRITICAL_THRESHOLD": 90.0,
        "RAM_WARNING_THRESHOLD": 80.0,
        "RAM_CRITICAL_THRESHOLD": 95.0,
        "TEMP_WARNING_THRESHOLD": 70.0,
        "TEMP_CRITICAL_THRESHOLD": 85.0
    }
    
    if not config_file.exists():
        try:
            with open(config_file, "w") as f:
                json.dump(defaults, f, indent=4)
        except Exception as e:
            print(f"[ConfigManager] Warning: Could not write default settings: {e}")
        return defaults
        
    try:
        with open(config_file, "r") as f:
            data = json.load(f)
            # Ensure any new settings added to defaults are populated
            for k, v in defaults.items():
                data.setdefault(k, v)
            return data
    except Exception as e:
        print(f"[ConfigManager] Error: Failed to read settings.json: {e}. Loading defaults.")
        return defaults
