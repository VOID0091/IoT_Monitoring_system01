"""
Device Timeline (Events) API
GET  /api/v1/events/{device_id}         — paginated event history
GET  /api/v1/events                     — global event feed (all devices)
POST /api/v1/events/{device_id}         — manually record an event (internal/admin)
"""
import json
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.database import get_db
from app.db.models import DeviceEvent
from app.core.security import decode_token
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/events", tags=["events"])
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


EVENT_TYPES = [
    "online", "offline", "reboot", "shutdown",
    "ip_change", "hostname_change",
    "app_install", "app_remove", "app_start", "app_stop", "app_crash",
    "ota_started", "ota_succeeded", "ota_failed", "ota_rollback",
    "policy_applied", "command_dispatched", "command_executed",
    "config_change", "alert", "discovery_started", "discovery_completed",
    "shadow_synced", "shadow_drift",
]

SEVERITY_MAP = {
    "online": "info", "offline": "warning", "reboot": "warning",
    "app_crash": "critical", "ota_failed": "critical", "alert": "warning",
    "shadow_drift": "warning",
}


class EventCreate(BaseModel):
    event_type: str
    message: Optional[str] = None
    event_data: Optional[dict] = None
    severity: Optional[str] = None


def utcnow():
    return datetime.now(timezone.utc)


def format_event(e: DeviceEvent) -> dict:
    return {
        "id": e.id,
        "device_id": e.device_id,
        "event_type": e.event_type,
        "message": e.message,
        "event_data": json.loads(e.event_data or "{}"),
        "severity": e.severity,
        "created_at": e.created_at.isoformat(),
    }


@router.get("")
async def list_all_events(
    device_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(DeviceEvent).order_by(desc(DeviceEvent.created_at)).offset(offset).limit(limit)
    if device_id:
        query = query.where(DeviceEvent.device_id == device_id)
    if event_type:
        query = query.where(DeviceEvent.event_type == event_type)
    if severity:
        query = query.where(DeviceEvent.severity == severity)

    result = await db.execute(query)
    events = result.scalars().all()
    return [format_event(e) for e in events]


@router.get("/{device_id}")
async def get_device_events(
    device_id: str,
    event_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(DeviceEvent)
        .where(DeviceEvent.device_id == device_id)
        .order_by(desc(DeviceEvent.created_at))
        .offset(offset)
        .limit(limit)
    )
    if event_type:
        query = query.where(DeviceEvent.event_type == event_type)

    result = await db.execute(query)
    events = result.scalars().all()
    return [format_event(e) for e in events]


@router.post("/{device_id}")
async def create_event(
    device_id: str,
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    tok = decode_token(token)
    if not tok:
        raise HTTPException(status_code=401, detail="Invalid token")

    severity = body.severity or SEVERITY_MAP.get(body.event_type, "info")
    event = DeviceEvent(
        device_id=device_id,
        event_type=body.event_type,
        message=body.message,
        event_data=json.dumps(body.event_data or {}),
        severity=severity,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return format_event(event)
