"""
Application Lifecycle Management API
GET/POST   /api/v1/apps                           — app registry
GET/DELETE /api/v1/apps/{app_id}                  — single app
GET        /api/v1/apps/device/{device_id}        — apps on a device
POST       /api/v1/apps/device/{device_id}/install
POST       /api/v1/apps/device/{device_id}/{app_id}/action  — start/stop/restart/uninstall
"""
import json, logging
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import Application, ApplicationDeployment, Device, DeviceCommand, DeviceEvent
from app.core.security import decode_token
from fastapi.security import OAuth2PasswordBearer
import uuid

router = APIRouter(prefix="/apps", tags=["applications"])
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

def utcnow(): return datetime.now(timezone.utc)

class AppCreate(BaseModel):
    name: str
    version: str
    description: Optional[str] = None
    install_command: Optional[str] = None
    uninstall_command: Optional[str] = None
    start_command: Optional[str] = None
    stop_command: Optional[str] = None

class AppInstall(BaseModel):
    app_id: int

class AppAction(BaseModel):
    action: str  # start, stop, restart, uninstall

def fmt_app(a: Application) -> dict:
    return {"id": a.id, "name": a.name, "version": a.version, "description": a.description,
            "install_command": a.install_command, "start_command": a.start_command,
            "created_at": a.created_at.isoformat()}

def fmt_deployment(d: ApplicationDeployment) -> dict:
    return {"id": d.id, "app_id": d.app_id, "device_id": d.device_id,
            "status": d.status, "version": d.version,
            "installed_at": d.installed_at.isoformat() if d.installed_at else None,
            "error": d.error}

@router.get("")
async def list_apps(db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Application))
    return [fmt_app(a) for a in r.scalars().all()]

@router.post("")
async def create_app(body: AppCreate, db: AsyncSession = Depends(get_db),
                     token: str = Depends(oauth2_scheme)):
    tok = decode_token(token)
    if not tok: raise HTTPException(status_code=401, detail="Invalid token")
    app = Application(**body.model_dump(), created_by=tok.get("sub"))
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return fmt_app(app)

@router.get("/{app_id}")
async def get_app(app_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Application).where(Application.id == app_id))
    app = r.scalar_one_or_none()
    if not app: raise HTTPException(status_code=404, detail="App not found")
    return fmt_app(app)

@router.delete("/{app_id}")
async def delete_app(app_id: int, db: AsyncSession = Depends(get_db),
                     token: str = Depends(oauth2_scheme)):
    if not decode_token(token): raise HTTPException(status_code=401, detail="Invalid token")
    r = await db.execute(select(Application).where(Application.id == app_id))
    app = r.scalar_one_or_none()
    if not app: raise HTTPException(status_code=404, detail="App not found")
    await db.delete(app)
    await db.commit()
    return {"deleted": app_id}

@router.get("/device/{device_id}")
async def get_device_apps(device_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ApplicationDeployment).where(ApplicationDeployment.device_id == device_id))
    return [fmt_deployment(d) for d in r.scalars().all()]

@router.post("/device/{device_id}/install")
async def install_app(device_id: str, body: AppInstall, db: AsyncSession = Depends(get_db),
                      token: str = Depends(oauth2_scheme)):
    tok = decode_token(token)
    if not tok: raise HTTPException(status_code=401, detail="Invalid token")
    app_r = await db.execute(select(Application).where(Application.id == body.app_id))
    app = app_r.scalar_one_or_none()
    if not app: raise HTTPException(status_code=404, detail="App not found")

    deployment = ApplicationDeployment(
        app_id=body.app_id, device_id=device_id, status="installing", version=app.version)
    db.add(deployment)

    # Send command via MQTT
    from app.services.mqtt_service import mqtt_service
    cmd_id = str(uuid.uuid4())
    cmd = DeviceCommand(
        command_id=cmd_id, device_id=device_id, command_type="install_application",
        payload=json.dumps({"app_id": body.app_id, "name": app.name,
                            "version": app.version, "install_command": app.install_command}),
        status="sent", created_by=tok.get("sub"))
    db.add(cmd)
    event = DeviceEvent(device_id=device_id, event_type="app_install",
                        message=f"Installing {app.name} v{app.version}",
                        event_data=json.dumps({"app_id": body.app_id, "app_name": app.name}))
    db.add(event)
    await db.commit()
    await mqtt_service.publish(f"iot/commands/{device_id}",
        {"command_id": cmd_id, "command_type": "install_application",
         "payload": {"app_id": body.app_id, "name": app.name, "install_command": app.install_command}})
    return {"status": "installing", "deployment_id": deployment.id}

@router.post("/device/{device_id}/{app_id}/action")
async def app_action(device_id: str, app_id: int, body: AppAction,
                     db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)):
    tok = decode_token(token)
    if not tok: raise HTTPException(status_code=401, detail="Invalid token")
    if body.action not in ("start", "stop", "restart", "uninstall"):
        raise HTTPException(status_code=400, detail="Invalid action")

    cmd_map = {"start": "start_application", "stop": "stop_application",
               "restart": "restart_application", "uninstall": "uninstall_application"}
    from app.services.mqtt_service import mqtt_service
    cmd_id = str(uuid.uuid4())
    cmd = DeviceCommand(
        command_id=cmd_id, device_id=device_id, command_type=cmd_map[body.action],
        payload=json.dumps({"app_id": app_id}), status="sent", created_by=tok.get("sub"))
    db.add(cmd)
    await db.commit()
    await mqtt_service.publish(f"iot/commands/{device_id}",
        {"command_id": cmd_id, "command_type": cmd_map[body.action], "payload": {"app_id": app_id}})
    return {"status": "sent", "action": body.action, "command_id": cmd_id}
