from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from app.db.database import get_db
from app.db.models import Telemetry
from app.core.dependencies import get_current_active_user
from app.schemas.schemas import TelemetryOut

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/{device_id}/latest", response_model=TelemetryOut)
async def get_latest(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Telemetry).where(Telemetry.device_id == device_id).order_by(desc(Telemetry.timestamp)).limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "No telemetry for device")
    return row


@router.get("/{device_id}/history", response_model=list[TelemetryOut])
async def get_history(
    device_id: str,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Telemetry)
        .where(Telemetry.device_id == device_id)
        .order_by(desc(Telemetry.timestamp))
        .offset(offset)
        .limit(limit)
    )
    rows = result.scalars().all()
    return list(reversed(rows))


@router.get("/summary/all")
async def get_all_latest(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Latest telemetry for all devices."""
    from sqlalchemy import func
    subq = (
        select(Telemetry.device_id, func.max(Telemetry.id).label("max_id"))
        .group_by(Telemetry.device_id)
        .subquery()
    )
    result = await db.execute(
        select(Telemetry).join(subq, (Telemetry.device_id == subq.c.device_id) & (Telemetry.id == subq.c.max_id))
    )
    return result.scalars().all()
