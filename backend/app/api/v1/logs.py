from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from app.db.database import get_db
from app.db.models import AuditLog
from app.core.dependencies import get_current_active_user
from app.schemas.schemas import AuditLogOut

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=list[AuditLogOut])
async def list_logs(
    username: Optional[str] = None,
    action: Optional[str] = None,
    resource: Optional[str] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    q = select(AuditLog).order_by(desc(AuditLog.timestamp))
    if username:
        q = q.where(AuditLog.username == username)
    if action:
        q = q.where(AuditLog.action.contains(action))
    if resource:
        q = q.where(AuditLog.resource == resource)
    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()
