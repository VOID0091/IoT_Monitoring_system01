from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path
import os
import sys

from app.core.config_manager import load_settings_dict, CONFIG_DIR, LOGS_DIR, DATA_DIR, BACKUPS_DIR

config_data = load_settings_dict()

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Phantomation DeviceOps"
    COMPANY_NAME: str = "Phantomation Intelligence"
    TAGLINE: str = "Industrial Device Operating Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = config_data.get("DEBUG", False)
    HOST: str = "0.0.0.0"
    PORT: int = config_data.get("PORT", 8080)

    # Security
    SECRET_KEY: str = config_data.get("SECRET_KEY", "change-this-to-a-very-long-random-secret-key-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = config_data.get("DATABASE_URL", f"sqlite+aiosqlite:///{DATA_DIR.as_posix()}/phantomation_deviceops.db")

    # MQTT
    MQTT_HOST: str = config_data.get("MQTT_HOST", "127.0.0.1")
    MQTT_PORT: int = config_data.get("MQTT_PORT", 1883)
    MQTT_USERNAME: Optional[str] = config_data.get("MQTT_USERNAME", None) or None
    MQTT_PASSWORD: Optional[str] = config_data.get("MQTT_PASSWORD", None) or None
    MQTT_CLIENT_ID: str = "phantomation-deviceops-backend"
    MQTT_KEEPALIVE: int = 60

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]

    # Alerts
    CPU_WARNING_THRESHOLD: float = config_data.get("CPU_WARNING_THRESHOLD", 75.0)
    CPU_CRITICAL_THRESHOLD: float = config_data.get("CPU_CRITICAL_THRESHOLD", 90.0)
    RAM_WARNING_THRESHOLD: float = config_data.get("RAM_WARNING_THRESHOLD", 80.0)
    RAM_CRITICAL_THRESHOLD: float = config_data.get("RAM_CRITICAL_THRESHOLD", 95.0)
    TEMP_WARNING_THRESHOLD: float = config_data.get("TEMP_WARNING_THRESHOLD", 70.0)
    TEMP_CRITICAL_THRESHOLD: float = config_data.get("TEMP_CRITICAL_THRESHOLD", 85.0)

    # Device timeouts
    DEVICE_OFFLINE_TIMEOUT_SECONDS: int = 60
    HEARTBEAT_INTERVAL_SECONDS: int = 30

    class Config:
        extra = "ignore"

settings = Settings()
