from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.db.models import Device
from app.core.dependencies import get_current_active_user

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/overview")
async def network_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Device.status, func.count(Device.id)).group_by(Device.status)
    )
    status_counts = {row[0]: row[1] for row in result}

    devices_result = await db.execute(
        select(Device.device_id, Device.name, Device.ip_address, Device.mac_address,
               Device.hostname, Device.status, Device.last_seen, Device.group_name)
    )
    devices = [
        {
            "device_id": r[0], "name": r[1], "ip_address": r[2], "mac_address": r[3],
            "hostname": r[4], "status": r[5],
            "last_seen": r[6].isoformat() if r[6] else None,
            "group_name": r[7],
        }
        for r in devices_result
    ]

    return {
        "status_counts": status_counts,
        "total": sum(status_counts.values()),
        "online": status_counts.get("online", 0),
        "offline": status_counts.get("offline", 0),
        "warning": status_counts.get("warning", 0),
        "critical": status_counts.get("critical", 0),
        "devices": devices,
    }
