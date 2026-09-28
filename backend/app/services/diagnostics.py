import sys
import os
import psutil
import socket
import logging
from sqlalchemy import text
from app.db.database import AsyncSessionLocal
from app.core.config import settings
from app.core.config_manager import CONFIG_DIR, LOGS_DIR, DATA_DIR

logger = logging.getLogger("diagnostics")

async def run_startup_diagnostics() -> bool:
    """Run system and connectivity diagnostics at server startup."""
    logger.info("================== SYSTEM STARTUP DIAGNOSTICS ==================")
    logger.info(f"Application Version : {settings.APP_VERSION}")
    logger.info(f"Python Interpreter  : {sys.version}")
    logger.info(f"Operating System    : {sys.platform} (frozen mode: {getattr(sys, 'frozen', False)})")
    
    # 1. Directory Checks
    logger.info("-- Directories Status --")
    logger.info(f"Config Folder: {CONFIG_DIR.resolve()} (exists: {CONFIG_DIR.exists()})")
    logger.info(f"Logs Folder  : {LOGS_DIR.resolve()} (exists: {LOGS_DIR.exists()})")
    logger.info(f"Data Folder  : {DATA_DIR.resolve()} (exists: {DATA_DIR.exists()})")
    
    # 2. Host Resources
    logger.info("-- Hardware Resources --")
    try:
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage(str(DATA_DIR.resolve()))
        logger.info(f"Available RAM : {mem.available / 1024**3:.2f} GB / {mem.total / 1024**3:.2f} GB ({mem.percent}% used)")
        logger.info(f"Available Disk: {disk.free / 1024**3:.2f} GB / {disk.total / 1024**3:.2f} GB ({disk.percent}% used)")
    except Exception as e:
        logger.warning(f"Could not fetch hardware stats: {e}")
        
    # 3. Database Check
    logger.info("-- Database Validation --")
    db_ok = False
    try:
        async with AsyncSessionLocal() as session:
            # Query standard sqlite master table to verify read connection
            result = await session.execute(text("SELECT 1"))
            val = result.scalar()
            if val == 1:
                db_ok = True
                logger.info("SQLite connection: OK (Select validation query succeeded)")
    except Exception as e:
        logger.error(f"SQLite database: ERROR (Connection or verification failed: {e})")
        
    # 4. MQTT Broker Port Ping
    logger.info("-- MQTT Broker Connectivity --")
    mqtt_ok = False
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((settings.MQTT_HOST, settings.MQTT_PORT))
            mqtt_ok = True
            logger.info(f"MQTT Broker Port ({settings.MQTT_HOST}:{settings.MQTT_PORT}): OK (Port open)")
    except Exception as e:
        logger.warning(
            f"MQTT Broker Port ({settings.MQTT_HOST}:{settings.MQTT_PORT}): WARNING "
            f"(Port unavailable. Note: Mosquitto may be starting up or is not configured yet. Details: {e})"
        )
        
    logger.info("================================================================")
    return db_ok

