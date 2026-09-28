"""
Device Command Bus API
POST   /api/v1/commands                  — dispatch a new command
GET    /api/v1/commands?device_id=       — list commands with filtering
GET    /api/v1/commands/{command_id}     — get specific command status
DELETE /api/v1/commands/{command_id}     — cancel pending command
"""
import json
import logging
import uuid
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.database import get_db
from app.db.models import DeviceCommand, Device, DeviceEvent
from app.core.security import decode_token
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/commands", tags=["commands"])
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


VALID_COMMAND_TYPES = [
    "reboot", "shutdown", "restart_service", "stop_service", "start_service",
    "update_hostname", "update_network", "install_application", "uninstall_application",
    "start_application", "stop_application", "restart_application",
    "deploy_config", "run_script", "get_processes", "kill_process",
    "browse_files", "upload_file", "download_file",
    "start_discovery", "stop_discovery",
    "apply_ota", "rollback_ota",
    "get_shadow", "sync_shadow",
]


class CommandDispatch(BaseModel):
    device_id: str
    command_type: str
    payload: Optional[dict] = None


def utcnow():
    return datetime.now(timezone.utc)


@router.post("")
async def dispatch_command(
    body: CommandDispatch,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    tok = decode_token(token)
    if not tok:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Verify device exists
    dev_result = await db.execute(select(Device).where(Device.device_id == body.device_id))
    device = dev_result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    command_id = str(uuid.uuid4())
    cmd = DeviceCommand(
        command_id=command_id,
        device_id=body.device_id,
        command_type=body.command_type,
        payload=json.dumps(body.payload or {}),
        status="pending",
        created_by=tok.get("sub"),
        sent_at=utcnow(),
    )
    db.add(cmd)

    # Record event
    event = DeviceEvent(
        device_id=body.device_id,
        event_type="command_dispatched",
        message=f"Command '{body.command_type}' dispatched by {tok.get('sub')}",
        event_data=json.dumps({"command_id": command_id, "type": body.command_type}),
        severity="info",
    )
    db.add(event)
    await db.commit()

    # Send via MQTT
    from app.services.mqtt_service import mqtt_service
    mqtt_payload = {
        "command_id": command_id,
        "command_type": body.command_type,
        "payload": body.payload or {},
    }
    await mqtt_service.publish(f"iot/commands/{body.device_id}", mqtt_payload)

    # Update status to sent
    cmd.status = "sent"
    await db.commit()

    return {
        "command_id": command_id,
        "device_id": body.device_id,
        "command_type": body.command_type,
        "status": "sent",
        "created_at": cmd.created_at.isoformat(),
    }


@router.get("")
async def list_commands(
    device_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(DeviceCommand).order_by(desc(DeviceCommand.created_at)).limit(limit)
    if device_id:
        query = query.where(DeviceCommand.device_id == device_id)
    if status:
        query = query.where(DeviceCommand.status == status)

    result = await db.execute(query)
    commands = result.scalars().all()

    return [
        {
            "command_id": c.command_id,
            "device_id": c.device_id,
            "command_type": c.command_type,
            "payload": json.loads(c.payload or "{}"),
            "status": c.status,
            "result": json.loads(c.result or "null"),
            "created_at": c.created_at.isoformat(),
            "sent_at": c.sent_at.isoformat() if c.sent_at else None,
            "executed_at": c.executed_at.isoformat() if c.executed_at else None,
            "created_by": c.created_by,
        }
        for c in commands
    ]


@router.get("/{command_id}")
async def get_command(command_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DeviceCommand).where(DeviceCommand.command_id == command_id))
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    return {
        "command_id": cmd.command_id,
        "device_id": cmd.device_id,
        "command_type": cmd.command_type,
        "payload": json.loads(cmd.payload or "{}"),
        "status": cmd.status,
        "result": json.loads(cmd.result or "null"),
        "created_at": cmd.created_at.isoformat(),
        "sent_at": cmd.sent_at.isoformat() if cmd.sent_at else None,
        "executed_at": cmd.executed_at.isoformat() if cmd.executed_at else None,
        "created_by": cmd.created_by,
    }


@router.delete("/{command_id}")
async def cancel_command(
    command_id: str,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    tok = decode_token(token)
    if not tok:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(DeviceCommand).where(DeviceCommand.command_id == command_id))
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    if cmd.status not in ("pending", "sent"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel command with status '{cmd.status}'")

    cmd.status = "cancelled"
    await db.commit()
    return {"command_id": command_id, "status": "cancelled"}


@router.get("/types/list")
async def list_command_types():
    return {"command_types": VALID_COMMAND_TYPES}
