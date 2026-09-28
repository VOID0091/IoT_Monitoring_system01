from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── Users ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"


class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Devices ─────────────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    device_id: str
    name: str
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    group_name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    group_name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class CapabilityOut(BaseModel):
    capability: str
    value: Optional[str] = None
    model_config = {"from_attributes": True}


class DeviceOut(BaseModel):
    id: int
    device_id: str
    name: str
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    platform: Optional[str] = None
    os_version: Optional[str] = None
    agent_version: Optional[str] = None
    status: str
    group_name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    last_seen: Optional[datetime] = None
    created_at: datetime
    capabilities: list[CapabilityOut] = []

    model_config = {"from_attributes": True}


class DeviceCommandRequest(BaseModel):
    command: str  # reboot, set_hostname, set_ip, set_dhcp
    params: Optional[dict] = None


# ─── Telemetry ───────────────────────────────────────────────────────────────

class TelemetryOut(BaseModel):
    id: int
    device_id: str
    cpu_percent: Optional[float] = None
    ram_percent: Optional[float] = None
    ram_used_mb: Optional[float] = None
    ram_total_mb: Optional[float] = None
    disk_percent: Optional[float] = None
    disk_used_gb: Optional[float] = None
    disk_total_gb: Optional[float] = None
    temperature: Optional[float] = None
    uptime_seconds: Optional[float] = None
    net_bytes_sent: Optional[float] = None
    net_bytes_recv: Optional[float] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


# ─── Alerts ──────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: int
    device_id: str
    severity: str
    category: str
    message: str
    acknowledged: bool
    resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AlertAckRequest(BaseModel):
    alert_ids: list[int]


# ─── Audit Logs ──────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    resource: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


# ─── WebSocket Events ────────────────────────────────────────────────────────

class WSEvent(BaseModel):
    event: str
    data: dict
    timestamp: Optional[str] = None
