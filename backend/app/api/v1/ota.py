"""
OTA Platform API
POST /api/v1/ota/packages          — upload package metadata
GET  /api/v1/ota/packages          — list packages
GET  /api/v1/ota/packages/{id}     — get package
POST /api/v1/ota/deploy            — create deployment
GET  /api/v1/ota/deployments       — list deployments
GET  /api/v1/ota/deployments/{id}  — deployment status
POST /api/v1/ota/deployments/{id}/rollback
"""
import json, logging, os, shutil
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.database import get_db
from app.db.models import OTAPackage, OTADeployment, Device, DeviceCommand, DeviceEvent
from app.core.security import decode_token
from fastapi.security import OAuth2PasswordBearer
import uuid, hashlib

router = APIRouter(prefix="/ota", tags=["ota"])
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

OTA_STORAGE = r"C:\ProgramData\IoTMonitor\packages"

def utcnow(): return datetime.now(timezone.utc)

class DeployCreate(BaseModel):
    package_id: int
    device_ids: list[str]

def fmt_pkg(p: OTAPackage) -> dict:
    return {"id": p.id, "name": p.name, "version": p.version, "file_size": p.file_size,
            "checksum": p.checksum, "release_notes": p.release_notes,
            "target_platform": p.target_platform, "created_at": p.created_at.isoformat()}

def fmt_dep(d: OTADeployment) -> dict:
    return {"id": d.id, "package_id": d.package_id, "device_id": d.device_id,
            "status": d.status, "progress": d.progress, "error": d.error,
            "started_at": d.started_at.isoformat() if d.started_at else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
            "created_at": d.created_at.isoformat()}

@router.post("/packages")
async def upload_package(
    name: str = Form(...), version: str = Form(...),
    release_notes: Optional[str] = Form(None),
    target_platform: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
):
    tok = decode_token(token)
    if not tok: raise HTTPException(status_code=401, detail="Invalid token")

    file_path, file_size, checksum = None, None, None
    if file:
        os.makedirs(OTA_STORAGE, exist_ok=True)
        safe_name = f"{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(OTA_STORAGE, safe_name)
        content = await file.read()
        file_size = len(content)
        checksum = hashlib.sha256(content).hexdigest()
        with open(file_path, "wb") as f:
            f.write(content)

    pkg = OTAPackage(name=name, version=version, file_path=file_path, file_size=file_size,
                     checksum=checksum, release_notes=release_notes,
                     target_platform=target_platform, created_by=tok.get("sub"))
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    return fmt_pkg(pkg)

@router.get("/packages")
async def list_packages(db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OTAPackage).order_by(desc(OTAPackage.created_at)))
    return [fmt_pkg(p) for p in r.scalars().all()]

@router.get("/packages/{pkg_id}")
async def get_package(pkg_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OTAPackage).where(OTAPackage.id == pkg_id))
    pkg = r.scalar_one_or_none()
    if not pkg: raise HTTPException(status_code=404, detail="Package not found")
    return fmt_pkg(pkg)

@router.post("/deploy")
async def create_deployment(body: DeployCreate, db: AsyncSession = Depends(get_db),
                            token: str = Depends(oauth2_scheme)):
    tok = decode_token(token)
    if not tok: raise HTTPException(status_code=401, detail="Invalid token")

    pkg_r = await db.execute(select(OTAPackage).where(OTAPackage.id == body.package_id))
    pkg = pkg_r.scalar_one_or_none()
    if not pkg: raise HTTPException(status_code=404, detail="Package not found")

    from app.services.mqtt_service import mqtt_service
    deployments = []
    for device_id in body.device_ids:
        dep = OTADeployment(package_id=body.package_id, device_id=device_id,
                            status="pending", created_by=tok.get("sub"))
        db.add(dep)
        event = DeviceEvent(device_id=device_id, event_type="ota_started",
                            message=f"OTA deployment started: {pkg.name} v{pkg.version}",
                            event_data=json.dumps({"package_id": body.package_id}))
        db.add(event)
        deployments.append(device_id)

    await db.commit()

    # Notify each device
    for device_id in body.device_ids:
        cmd_id = str(uuid.uuid4())
        await mqtt_service.publish(f"iot/commands/{device_id}", {
            "command_id": cmd_id, "command_type": "apply_ota",
            "payload": {"package_id": body.package_id, "name": pkg.name,
                        "version": pkg.version, "checksum": pkg.checksum}
        })

    return {"status": "pending", "device_count": len(deployments), "devices": deployments}

@router.get("/deployments")
async def list_deployments(device_id: Optional[str] = Query(None),
                           status: Optional[str] = Query(None),
                           db: AsyncSession = Depends(get_db)):
    query = select(OTADeployment).order_by(desc(OTADeployment.created_at))
    if device_id: query = query.where(OTADeployment.device_id == device_id)
    if status: query = query.where(OTADeployment.status == status)
    r = await db.execute(query)
    return [fmt_dep(d) for d in r.scalars().all()]

@router.get("/deployments/{dep_id}")
async def get_deployment(dep_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OTADeployment).where(OTADeployment.id == dep_id))
    dep = r.scalar_one_or_none()
    if not dep: raise HTTPException(status_code=404, detail="Deployment not found")
    return fmt_dep(dep)

@router.post("/deployments/{dep_id}/rollback")
async def rollback_deployment(dep_id: int, db: AsyncSession = Depends(get_db),
                              token: str = Depends(oauth2_scheme)):
    tok = decode_token(token)
    if not tok: raise HTTPException(status_code=401, detail="Invalid token")
    r = await db.execute(select(OTADeployment).where(OTADeployment.id == dep_id))
    dep = r.scalar_one_or_none()
    if not dep: raise HTTPException(status_code=404, detail="Deployment not found")

    from app.services.mqtt_service import mqtt_service
    cmd_id = str(uuid.uuid4())
    dep.status = "rolled_back"
    event = DeviceEvent(device_id=dep.device_id, event_type="ota_rollback",
                        message="OTA rollback initiated", severity="warning",
                        event_data=json.dumps({"deployment_id": dep_id}))
    db.add(event)
    await db.commit()
    await mqtt_service.publish(f"iot/commands/{dep.device_id}",
        {"command_id": cmd_id, "command_type": "rollback_ota", "payload": {"deployment_id": dep_id}})
    return {"status": "rolled_back", "deployment_id": dep_id}
