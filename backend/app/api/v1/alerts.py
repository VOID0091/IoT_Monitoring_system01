from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from typing import Optional
from app.db.database import get_db
from app.db.models import Alert
from app.core.dependencies import get_current_active_user, require_role
from app.schemas.schemas import AlertOut, AlertAckRequest
from datetime import datetime, timezone

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def list_alerts(
    device_id: Optional[str] = None,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    acknowledged: Optional[bool] = None,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    q = select(Alert).order_by(desc(Alert.created_at))
    if device_id:
        q = q.where(Alert.device_id == device_id)
    if severity:
        q = q.where(Alert.severity == severity)
    if resolved is not None:
        q = q.where(Alert.resolved == resolved)
    if acknowledged is not None:
        q = q.where(Alert.acknowledged == acknowledged)
    q = q.limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/acknowledge")
async def acknowledge_alerts(
    body: AlertAckRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "operator")),
):
    await db.execute(
        update(Alert)
        .where(Alert.id.in_(body.alert_ids))
        .values(acknowledged=True, acknowledged_by=current_user.id)
    )
    await db.commit()
    return {"acknowledged": len(body.alert_ids)}


@router.post("/resolve")
async def resolve_alerts(
    body: AlertAckRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "operator")),
):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Alert)
        .where(Alert.id.in_(body.alert_ids))
        .values(resolved=True, resolved_at=now, acknowledged=True, acknowledged_by=current_user.id)
    )
    await db.commit()
    return {"resolved": len(body.alert_ids)}


@router.get("/stats")
async def alert_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from sqlalchemy import func
    result = await db.execute(
        select(Alert.severity, func.count(Alert.id))
        .where(Alert.resolved == False)
        .group_by(Alert.severity)
    )
    stats = {row[0]: row[1] for row in result}
    return {
        "critical": stats.get("critical", 0),
        "warning": stats.get("warning", 0),
        "info": stats.get("info", 0),
        "total_unresolved": sum(stats.values()),
    }
