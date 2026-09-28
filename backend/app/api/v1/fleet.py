"""
Fleet Management API
Organizations → Sites → Fleets → Devices hierarchy

GET/POST   /api/v1/fleet/orgs
GET/PUT/DELETE /api/v1/fleet/orgs/{org_id}

GET/POST   /api/v1/fleet/sites
GET/PUT/DELETE /api/v1/fleet/sites/{site_id}

GET/POST   /api/v1/fleet/fleets
GET/PUT/DELETE /api/v1/fleet/fleets/{fleet_id}

GET        /api/v1/fleet/fleets/{fleet_id}/health
POST       /api/v1/fleet/bulk-action
"""
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.db.models import Organization, Site, Fleet, Device, Telemetry
from app.core.security import decode_token
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/fleet", tags=["fleet"])
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


# ─── Schemas ─────────────────────────────────────────────────────────────────
class OrgCreate(BaseModel):
    name: str
    description: Optional[str] = None

class SiteCreate(BaseModel):
    org_id: int
    name: str
    location: Optional[str] = None
    description: Optional[str] = None

class FleetCreate(BaseModel):
    site_id: int
    name: str
    description: Optional[str] = None
    tags: Optional[list[str]] = None

class BulkAction(BaseModel):
    fleet_id: Optional[int] = None
    device_ids: Optional[list[str]] = None
    command_type: str
    payload: Optional[dict] = None

class DeviceAssign(BaseModel):
    org_id: Optional[int] = None
    site_id: Optional[int] = None
    fleet_id: Optional[int] = None


# ─── Organizations ────────────────────────────────────────────────────────────
@router.get("/orgs")
async def list_orgs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization))
    orgs = result.scalars().all()
    out = []
    for org in orgs:
        sites_r = await db.execute(select(func.count()).select_from(Site).where(Site.org_id == org.id))
        site_count = sites_r.scalar()
        out.append({"id": org.id, "name": org.name, "description": org.description,
                    "site_count": site_count, "created_at": org.created_at.isoformat()})
    return out

@router.post("/orgs")
async def create_org(body: OrgCreate, db: AsyncSession = Depends(get_db),
                     token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    org = Organization(name=body.name, description=body.description)
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return {"id": org.id, "name": org.name, "description": org.description, "created_at": org.created_at.isoformat()}

@router.get("/orgs/{org_id}")
async def get_org(org_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    sites_r = await db.execute(select(Site).where(Site.org_id == org_id))
    sites = sites_r.scalars().all()
    return {
        "id": org.id, "name": org.name, "description": org.description,
        "created_at": org.created_at.isoformat(),
        "sites": [{"id": s.id, "name": s.name, "location": s.location} for s in sites],
    }

@router.put("/orgs/{org_id}")
async def update_org(org_id: int, body: OrgCreate, db: AsyncSession = Depends(get_db),
                     token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.name = body.name
    org.description = body.description
    await db.commit()
    return {"id": org.id, "name": org.name}

@router.delete("/orgs/{org_id}")
async def delete_org(org_id: int, db: AsyncSession = Depends(get_db),
                     token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await db.delete(org)
    await db.commit()
    return {"deleted": org_id}


# ─── Sites ────────────────────────────────────────────────────────────────────
@router.get("/sites")
async def list_sites(org_id: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)):
    query = select(Site)
    if org_id:
        query = query.where(Site.org_id == org_id)
    result = await db.execute(query)
    sites = result.scalars().all()
    out = []
    for s in sites:
        fleet_r = await db.execute(select(func.count()).select_from(Fleet).where(Fleet.site_id == s.id))
        fleet_count = fleet_r.scalar()
        out.append({"id": s.id, "org_id": s.org_id, "name": s.name, "location": s.location,
                    "description": s.description, "fleet_count": fleet_count,
                    "created_at": s.created_at.isoformat()})
    return out

@router.post("/sites")
async def create_site(body: SiteCreate, db: AsyncSession = Depends(get_db),
                      token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    site = Site(org_id=body.org_id, name=body.name, location=body.location, description=body.description)
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return {"id": site.id, "name": site.name, "org_id": site.org_id}

@router.get("/sites/{site_id}")
async def get_site(site_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id))
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    fleets_r = await db.execute(select(Fleet).where(Fleet.site_id == site_id))
    fleets = fleets_r.scalars().all()
    return {
        "id": site.id, "org_id": site.org_id, "name": site.name,
        "location": site.location, "description": site.description,
        "created_at": site.created_at.isoformat(),
        "fleets": [{"id": f.id, "name": f.name} for f in fleets],
    }

@router.delete("/sites/{site_id}")
async def delete_site(site_id: int, db: AsyncSession = Depends(get_db),
                      token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(Site).where(Site.id == site_id))
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    await db.delete(site)
    await db.commit()
    return {"deleted": site_id}


# ─── Fleets ───────────────────────────────────────────────────────────────────
@router.get("/fleets")
async def list_fleets(site_id: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)):
    query = select(Fleet)
    if site_id:
        query = query.where(Fleet.site_id == site_id)
    result = await db.execute(query)
    fleets = result.scalars().all()
    out = []
    for f in fleets:
        dev_r = await db.execute(select(func.count()).select_from(Device).where(Device.fleet_id == f.id))
        dev_count = dev_r.scalar()
        online_r = await db.execute(
            select(func.count()).select_from(Device)
            .where(Device.fleet_id == f.id, Device.status == "online")
        )
        online_count = online_r.scalar()
        out.append({
            "id": f.id, "site_id": f.site_id, "name": f.name,
            "description": f.description,
            "tags": json.loads(f.tags or "[]"),
            "device_count": dev_count,
            "online_count": online_count,
            "created_at": f.created_at.isoformat(),
        })
    return out

@router.post("/fleets")
async def create_fleet(body: FleetCreate, db: AsyncSession = Depends(get_db),
                       token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    fleet = Fleet(
        site_id=body.site_id, name=body.name, description=body.description,
        tags=json.dumps(body.tags or []),
    )
    db.add(fleet)
    await db.commit()
    await db.refresh(fleet)
    return {"id": fleet.id, "name": fleet.name, "site_id": fleet.site_id}

@router.get("/fleets/{fleet_id}/health")
async def get_fleet_health(fleet_id: int, db: AsyncSession = Depends(get_db)):
    dev_r = await db.execute(select(Device).where(Device.fleet_id == fleet_id))
    devices = dev_r.scalars().all()
    if not devices:
        return {"fleet_id": fleet_id, "health_score": 0, "device_count": 0}

    from app.services.health_service import calculate_device_health
    scores = []
    for device in devices:
        # Get latest telemetry
        tel_r = await db.execute(
            select(Telemetry).where(Telemetry.device_id == device.device_id)
            .order_by(Telemetry.timestamp.desc()).limit(1)
        )
        latest_tel = tel_r.scalar_one_or_none()
        score = calculate_device_health(device, latest_tel)
        scores.append(score)

    avg_score = sum(scores) / len(scores)
    online = sum(1 for d in devices if d.status == "online")
    return {
        "fleet_id": fleet_id,
        "health_score": round(avg_score, 1),
        "device_count": len(devices),
        "online_count": online,
        "offline_count": len(devices) - online,
    }

@router.delete("/fleets/{fleet_id}")
async def delete_fleet(fleet_id: int, db: AsyncSession = Depends(get_db),
                       token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(Fleet).where(Fleet.id == fleet_id))
    fleet = result.scalar_one_or_none()
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet not found")
    await db.delete(fleet)
    await db.commit()
    return {"deleted": fleet_id}


# ─── Device Assignment ────────────────────────────────────────────────────────
@router.put("/devices/{device_id}/assign")
async def assign_device(device_id: str, body: DeviceAssign, db: AsyncSession = Depends(get_db),
                        token: str = Depends(oauth2_scheme)):
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if body.org_id is not None:
        device.org_id = body.org_id
    if body.site_id is not None:
        device.site_id = body.site_id
    if body.fleet_id is not None:
        device.fleet_id = body.fleet_id
    await db.commit()
    return {"device_id": device_id, "org_id": device.org_id, "site_id": device.site_id, "fleet_id": device.fleet_id}


# ─── Bulk Actions ─────────────────────────────────────────────────────────────
@router.post("/bulk-action")
async def bulk_action(body: BulkAction, db: AsyncSession = Depends(get_db),
                      token: str = Depends(oauth2_scheme)):
    tok = decode_token(token)
    if not tok:
        raise HTTPException(status_code=401, detail="Invalid token")

    device_ids = body.device_ids or []
    if body.fleet_id and not device_ids:
        dev_r = await db.execute(select(Device.device_id).where(Device.fleet_id == body.fleet_id))
        device_ids = [row[0] for row in dev_r.all()]

    if not device_ids:
        raise HTTPException(status_code=400, detail="No devices specified")

    from app.services.mqtt_service import mqtt_service
    import uuid
    dispatched = []
    for device_id in device_ids:
        command_id = str(uuid.uuid4())
        from app.db.models import DeviceCommand, DeviceEvent
        cmd = DeviceCommand(
            command_id=command_id, device_id=device_id,
            command_type=body.command_type,
            payload=json.dumps(body.payload or {}),
            status="sent", created_by=tok.get("sub"),
        )
        db.add(cmd)
        await mqtt_service.publish(f"iot/commands/{device_id}", {
            "command_id": command_id, "command_type": body.command_type,
            "payload": body.payload or {},
        })
        dispatched.append({"device_id": device_id, "command_id": command_id})

    await db.commit()
    return {"dispatched": dispatched, "total": len(dispatched)}
