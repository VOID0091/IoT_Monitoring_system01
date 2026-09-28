import asyncio
import logging
import sys
import os

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager
from pathlib import Path
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

from app.core.config import settings
from app.core.config_manager import LOGS_DIR
from app.db.database import init_db
from app.services.mqtt_service import mqtt_service
from app.services.ws_manager import ws_manager
from app.api.v1 import auth, devices, telemetry, alerts, logs, users, network, shadow, commands, events, fleet, applications, ota

# ─── Centralized Log Management ───
log_file = LOGS_DIR / "backend.log"
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Ensure logs folder exists
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Rotating File Handler
file_handler = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5)
file_handler.setFormatter(formatter)
file_handler.setLevel(logging.INFO)

# Console Handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
console_handler.setLevel(logging.INFO)

# Config Root Logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.handlers = []
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

logger = logging.getLogger("backend")

# ─── Resolve Frontend Path ───
if getattr(sys, "frozen", False):
    # PyInstaller bundle temp path
    FRONTEND_DIR = Path(sys._MEIPASS) / "frontend"
else:
    # Development relative path
    FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

logger.info(f"Frontend static directory resolved to: {FRONTEND_DIR.resolve()}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
        
        # Run startup diagnostics
        from app.services.diagnostics import run_startup_diagnostics
        await run_startup_diagnostics()
    except Exception as e:
        logger.critical(f"Startup initialization failed: {e}")

    logger.info("Starting MQTT service...")
    mqtt_service.set_ws_manager(ws_manager)
    await mqtt_service.start()

    # Background task: mark offline devices periodically
    async def offline_checker():
        while True:
            await asyncio.sleep(settings.HEARTBEAT_INTERVAL_SECONDS)
            try:
                from app.db.database import AsyncSessionLocal
                from app.services.device_service import DeviceService
                async with AsyncSessionLocal() as db:
                    svc = DeviceService(db)
                    await svc.mark_offline_devices()
            except Exception as e:
                logger.error(f"Offline checker error: {e}")

    checker_task = asyncio.create_task(offline_checker())
    logger.info("\n" + "="*80 + "\n\nPhantomation DeviceOps\nPhantomation Intelligence\nIndustrial Device Operating Platform\n\n" + "="*80)
    logger.info(f"{settings.APP_NAME} v{settings.APP_VERSION} started on port {settings.PORT}")

    yield

    # Shutdown
    logger.info("Stopping background tasks...")
    checker_task.cancel()
    await mqtt_service.stop()
    logger.info("Shutdown complete")

app = FastAPI(
    title="Phantomation DeviceOps API",
    description="Industrial Device Operating Platform API - Phantomation Intelligence",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(devices.router, prefix="/api/v1")
app.include_router(telemetry.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(logs.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(network.router, prefix="/api/v1")
app.include_router(shadow.router, prefix="/api/v1")
app.include_router(commands.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(fleet.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(ota.router, prefix="/api/v1")

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "mqtt_connected": mqtt_service.client is not None,
        "ws_connections": ws_manager.connection_count,
    }

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await ws_manager.connect(client_id, websocket)
    try:
        await ws_manager.send_to(client_id, {"event": "connected", "data": {"client_id": client_id}})
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if msg == "ping":
                    await ws_manager.send_to(client_id, {"event": "pong"})
            except asyncio.TimeoutError:
                await ws_manager.send_to(client_id, {"event": "heartbeat"})
    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WS error for {client_id}: {e}")
        ws_manager.disconnect(client_id)

# ─── SPA Static File serving ───
assets_path = FRONTEND_DIR / "assets"
if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")
    logger.info("Assets folder mounted on /assets")

@app.get("/{catchall:path}")
async def serve_spa(catchall: str):
    """Fallback handler returning index.html for all non-API client routes."""
    # Let standard FastAPI router return 404 for missing /api routes
    if catchall.startswith("api/") or catchall.startswith("ws"):
        raise HTTPException(status_code=404, detail="Not Found")
        
    index_html = FRONTEND_DIR / "index.html"
    if index_html.exists():
        return FileResponse(str(index_html))
        
    return HTMLResponse(
        content="<h3>Welcome to Phantomation DeviceOps</h3><p>Static frontend assets not compiled. Run <code>npm run build</code> in the frontend folder first.</p>",
        status_code=200
    )

if __name__ == "__main__":
    import uvicorn
    if getattr(sys, "frozen", False):
        uvicorn.run(app, host=settings.HOST, port=settings.PORT)
    else:
        uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)


