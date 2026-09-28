"""
Device Shadow API
GET  /api/v1/shadow/{device_id}          — get shadow (desired + reported + diff)
PUT  /api/v1/shadow/{device_id}/desired  — update desired state
POST /api/v1/shadow/{device_id}/sync     — mark as synced (called by agent via MQTT, or manually)
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import DeviceShadow, Device, DeviceEvent
from app.core.security import decode_token
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timezone

router = APIRouter(prefix="/shadow", tags=["shadow"])
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def utcnow():
    return datetime.now(timezone.utc)


def compute_diff(desired: dict, reported: dict) -> dict:
    """Return keys that differ between desired and reported states."""
    diff = {}
    all_keys = set(desired.keys()) | set(reported.keys())
    for key in all_keys:
        d_val = desired.get(key)
        r_val = reported.get(key)
        if d_val != r_val:
            diff[key] = {"desired": d_val, "reported": r_val}
    return diff


class DesiredStateUpdate(BaseModel):
    state: dict


@router.get("/{device_id}")
async def get_shadow(device_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DeviceShadow).where(DeviceShadow.device_id == device_id))
    shadow = result.scalar_one_or_none()
    if not shadow:
        # Create empty shadow on first access
        shadow = DeviceShadow(device_id=device_id, desired_state="{}", reported_state="{}", sync_status="unknown")
        db.add(shadow)
        await db.commit()
        await db.refresh(shadow)

    desired = json.loads(shadow.desired_state or "{}")
    reported = json.loads(shadow.reported_state or "{}")
    diff = compute_diff(desired, reported)

    return {
        "device_id": device_id,
        "desired_state": desired,
        "reported_state": reported,
        "diff": diff,
        "sync_status": shadow.sync_status,
        "last_sync": shadow.last_sync.isoformat() if shadow.last_sync else None,
    }


@router.put("/{device_id}/desired")
async def update_desired_state(
    device_id: str,
    body: DesiredStateUpdate,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Ensure device exists
    dev_result = await db.execute(select(Device).where(Device.device_id == device_id))
    if not dev_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Device not found")

    result = await db.execute(select(DeviceShadow).where(DeviceShadow.device_id == device_id))
    shadow = result.scalar_one_or_none()
    if not shadow:
        shadow = DeviceShadow(device_id=device_id)
        db.add(shadow)

    shadow.desired_state = json.dumps(body.state)
    shadow.sync_status = "pending"
    await db.commit()

    # Publish desired state to agent via MQTT
    from app.services.mqtt_service import mqtt_service
    await mqtt_service.publish(f"iot/shadow/{device_id}/desired", body.state)

    # Record event
    event = DeviceEvent(
        device_id=device_id,
        event_type="config_change",
        message=f"Desired state updated by {payload.get('sub')}",
        event_data=json.dumps(body.state),
        severity="info",
    )
    db.add(event)
    await db.commit()

    return {"status": "pending", "desired_state": body.state}


@router.get("/{device_id}/diff")
async def get_shadow_diff(device_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DeviceShadow).where(DeviceShadow.device_id == device_id))
    shadow = result.scalar_one_or_none()
    if not shadow:
        return {"diff": {}, "sync_status": "unknown"}

    desired = json.loads(shadow.desired_state or "{}")
    reported = json.loads(shadow.reported_state or "{}")
    diff = compute_diff(desired, reported)
    status = "in_sync" if not diff else ("drift_detected" if shadow.sync_status != "pending" else "pending")
    return {"diff": diff, "sync_status": status, "has_drift": bool(diff)}
