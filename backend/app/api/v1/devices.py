from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from app.db.database import get_db
from app.db.models import Device, AuditLog
from app.core.dependencies import get_current_active_user, require_role
from app.schemas.schemas import DeviceCreate, DeviceUpdate, DeviceOut, DeviceCommandRequest
from app.services.mqtt_service import mqtt_service
from typing import Optional

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceOut])
async def list_devices(
    status: Optional[str] = None,
    group: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    q = select(Device).options(selectinload(Device.capabilities))
    if status:
        q = q.where(Device.status == status)
    if group:
        q = q.where(Device.group_name == group)
    if search:
        q = q.where(Device.name.contains(search) | Device.hostname.contains(search) | Device.ip_address.contains(search))
    q = q.order_by(Device.name)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=DeviceOut)
async def create_device(
    body: DeviceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "operator")),
):
    existing = await db.execute(select(Device).where(Device.device_id == body.device_id))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Device ID already exists")
    device = Device(**body.model_dump())
    db.add(device)
    log = AuditLog(user_id=current_user.id, username=current_user.username,
                   action="create_device", resource="device", resource_id=body.device_id,
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    await db.commit()
    await db.refresh(device)
    return device


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Device).where(Device.device_id == device_id).options(selectinload(Device.capabilities))
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")
    return device


@router.put("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: str,
    body: DeviceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "operator")),
):
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(device, k, v)
    log = AuditLog(user_id=current_user.id, username=current_user.username,
                   action="update_device", resource="device", resource_id=device_id,
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    await db.commit()
    await db.refresh(device)
    return device


@router.delete("/{device_id}")
async def delete_device(
    device_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")
    await db.delete(device)
    log = AuditLog(user_id=current_user.id, username=current_user.username,
                   action="delete_device", resource="device", resource_id=device_id,
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{device_id}/command")
async def send_command(
    device_id: str,
    body: DeviceCommandRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "operator")),
):
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")

    await mqtt_service.send_command(device_id, body.command, body.params or {})

    log = AuditLog(user_id=current_user.id, username=current_user.username,
                   action=f"command:{body.command}", resource="device", resource_id=device_id,
                   details=str(body.params), ip_address=request.client.host if request.client else None)
    db.add(log)
    await db.commit()
    return {"status": "sent", "command": body.command}


@router.get("/groups/list")
async def list_groups(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    result = await db.execute(select(Device.group_name).distinct())
    groups = [r[0] for r in result if r[0]]
    return {"groups": groups}
