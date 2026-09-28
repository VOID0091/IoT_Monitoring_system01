from datetime import datetime, timezone
from typing import Optional
import uuid
from sqlalchemy import String, Float, Boolean, Integer, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


# ─── Existing Models (unchanged) ────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="viewer")  # admin, operator, viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="user")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    hostname: Mapped[Optional[str]] = mapped_column(String(256))
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))
    mac_address: Mapped[Optional[str]] = mapped_column(String(32))
    platform: Mapped[Optional[str]] = mapped_column(String(64))
    os_version: Mapped[Optional[str]] = mapped_column(String(128))
    agent_version: Mapped[Optional[str]] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="offline")
    group_name: Mapped[Optional[str]] = mapped_column(String(64))
    location: Mapped[Optional[str]] = mapped_column(String(128))
    description: Mapped[Optional[str]] = mapped_column(Text)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # NEW: Fleet hierarchy foreign keys (nullable for backwards compat)
    org_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    site_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True, index=True)
    fleet_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("fleets.id", ondelete="SET NULL"), nullable=True, index=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of strings

    # Existing relationships
    telemetry: Mapped[list["Telemetry"]] = relationship("Telemetry", back_populates="device", cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="device", cascade="all, delete-orphan")
    capabilities: Mapped[list["DeviceCapability"]] = relationship("DeviceCapability", back_populates="device", cascade="all, delete-orphan")

    # NEW relationships
    shadow: Mapped[Optional["DeviceShadow"]] = relationship("DeviceShadow", back_populates="device", uselist=False, cascade="all, delete-orphan")
    commands: Mapped[list["DeviceCommand"]] = relationship("DeviceCommand", back_populates="device", cascade="all, delete-orphan")
    events: Mapped[list["DeviceEvent"]] = relationship("DeviceEvent", back_populates="device", cascade="all, delete-orphan")
    app_deployments: Mapped[list["ApplicationDeployment"]] = relationship("ApplicationDeployment", back_populates="device", cascade="all, delete-orphan")
    ota_deployments: Mapped[list["OTADeployment"]] = relationship("OTADeployment", back_populates="device", cascade="all, delete-orphan")


class DeviceCapability(Base):
    __tablename__ = "device_capabilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), index=True)
    capability: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text)

    device: Mapped["Device"] = relationship("Device", back_populates="capabilities")


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), index=True)
    cpu_percent: Mapped[Optional[float]] = mapped_column(Float)
    ram_percent: Mapped[Optional[float]] = mapped_column(Float)
    ram_used_mb: Mapped[Optional[float]] = mapped_column(Float)
    ram_total_mb: Mapped[Optional[float]] = mapped_column(Float)
    disk_percent: Mapped[Optional[float]] = mapped_column(Float)
    disk_used_gb: Mapped[Optional[float]] = mapped_column(Float)
    disk_total_gb: Mapped[Optional[float]] = mapped_column(Float)
    temperature: Mapped[Optional[float]] = mapped_column(Float)
    uptime_seconds: Mapped[Optional[float]] = mapped_column(Float)
    net_bytes_sent: Mapped[Optional[float]] = mapped_column(Float)
    net_bytes_recv: Mapped[Optional[float]] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    device: Mapped["Device"] = relationship("Device", back_populates="telemetry")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), index=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="system")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    device: Mapped["Device"] = relationship("Device", back_populates="alerts")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource: Mapped[Optional[str]] = mapped_column(String(128))
    resource_id: Mapped[Optional[str]] = mapped_column(String(128))
    details: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")


# ─── NEW: Fleet Hierarchy ────────────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sites: Mapped[list["Site"]] = relationship("Site", back_populates="org", cascade="all, delete-orphan")


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    org_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(256))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Organization"] = relationship("Organization", back_populates="sites")
    fleets: Mapped[list["Fleet"]] = relationship("Fleet", back_populates="site", cascade="all, delete-orphan")


class Fleet(Base):
    __tablename__ = "fleets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    site_id: Mapped[int] = mapped_column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    site: Mapped["Site"] = relationship("Site", back_populates="fleets")


# ─── NEW: Device Shadow ──────────────────────────────────────────────────────

class DeviceShadow(Base):
    __tablename__ = "device_shadow"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), unique=True, index=True)
    desired_state: Mapped[Optional[str]] = mapped_column(Text)   # JSON object
    reported_state: Mapped[Optional[str]] = mapped_column(Text)  # JSON object
    last_sync: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sync_status: Mapped[str] = mapped_column(String(32), default="unknown")  # in_sync, pending, drift_detected, unknown

    device: Mapped["Device"] = relationship("Device", back_populates="shadow")


# ─── NEW: Command Bus ────────────────────────────────────────────────────────

class DeviceCommand(Base):
    __tablename__ = "device_commands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    command_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default=new_uuid, index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), index=True)
    command_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[Optional[str]] = mapped_column(Text)   # JSON
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, sent, executing, succeeded, failed, cancelled, timeout
    result: Mapped[Optional[str]] = mapped_column(Text)    # JSON result from agent
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[Optional[str]] = mapped_column(String(64))  # username

    device: Mapped["Device"] = relationship("Device", back_populates="commands")


# ─── NEW: Device Event Timeline ──────────────────────────────────────────────

class DeviceEvent(Base):
    __tablename__ = "device_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # event_type: online, offline, reboot, ip_change, hostname_change, app_install, app_remove,
    #             ota_update, ota_rollback, policy_applied, command_executed, config_change, alert
    event_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    severity: Mapped[str] = mapped_column(String(16), default="info")  # info, warning, critical
    message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    device: Mapped["Device"] = relationship("Device", back_populates="events")


# ─── NEW: Network Discovery ──────────────────────────────────────────────────

class DiscoveredDevice(Base):
    __tablename__ = "discovered_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_device_id: Mapped[str] = mapped_column(String(128), index=True)  # which agent found it
    hostname: Mapped[Optional[str]] = mapped_column(String(256))
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False)
    mac_address: Mapped[Optional[str]] = mapped_column(String(32))
    vendor: Mapped[Optional[str]] = mapped_column(String(128))
    open_ports: Mapped[Optional[str]] = mapped_column(Text)   # JSON array
    protocols: Mapped[Optional[str]] = mapped_column(Text)    # JSON array: modbus, mqtt, http, snmp
    device_type: Mapped[Optional[str]] = mapped_column(String(64))  # plc, camera, printer, sensor, unknown
    is_managed: Mapped[bool] = mapped_column(Boolean, default=False)
    managed_device_id: Mapped[Optional[str]] = mapped_column(String(128))
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ─── NEW: Application Lifecycle ─────────────────────────────────────────────

class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    package_path: Mapped[Optional[str]] = mapped_column(String(512))
    checksum: Mapped[Optional[str]] = mapped_column(String(128))
    install_command: Mapped[Optional[str]] = mapped_column(Text)
    uninstall_command: Mapped[Optional[str]] = mapped_column(Text)
    start_command: Mapped[Optional[str]] = mapped_column(Text)
    stop_command: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(64))

    deployments: Mapped[list["ApplicationDeployment"]] = relationship("ApplicationDeployment", back_populates="app", cascade="all, delete-orphan")


class ApplicationDeployment(Base):
    __tablename__ = "application_deployments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    app_id: Mapped[int] = mapped_column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="installing")  # installed, running, stopped, crashed, uninstalled
    version: Mapped[Optional[str]] = mapped_column(String(64))
    installed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    error: Mapped[Optional[str]] = mapped_column(Text)

    app: Mapped["Application"] = relationship("Application", back_populates="deployments")
    device: Mapped["Device"] = relationship("Device", back_populates="app_deployments")


# ─── NEW: OTA Platform ───────────────────────────────────────────────────────

class OTAPackage(Base):
    __tablename__ = "ota_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(512))
    file_size: Mapped[Optional[int]] = mapped_column(Integer)
    checksum: Mapped[Optional[str]] = mapped_column(String(128))
    release_notes: Mapped[Optional[str]] = mapped_column(Text)
    target_platform: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(64))

    deployments: Mapped[list["OTADeployment"]] = relationship("OTADeployment", back_populates="package", cascade="all, delete-orphan")


class OTADeployment(Base):
    __tablename__ = "ota_deployments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    package_id: Mapped[int] = mapped_column(Integer, ForeignKey("ota_packages.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[str] = mapped_column(String(128), ForeignKey("devices.device_id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, downloading, installing, succeeded, failed, rolled_back
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    error: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(64))

    package: Mapped["OTAPackage"] = relationship("OTAPackage", back_populates="deployments")
    device: Mapped["Device"] = relationship("Device", back_populates="ota_deployments")


# ─── NEW: Policy Engine ──────────────────────────────────────────────────────

class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    scope: Mapped[str] = mapped_column(String(32), nullable=False)  # org, site, fleet, device
    scope_id: Mapped[Optional[str]] = mapped_column(String(128))   # id or device_id depending on scope
    rules: Mapped[str] = mapped_column(Text, default="{}")          # JSON policy rules object
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(64))


# ─── NEW: Rules Engine ───────────────────────────────────────────────────────

class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    trigger_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # trigger_type: telemetry_threshold, device_offline, ota_fail, command_fail, custom
    trigger_condition: Mapped[str] = mapped_column(Text, default="{}")  # JSON condition spec
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # action_type: create_alert, send_command, ota_rollback, webhook
    action_config: Mapped[str] = mapped_column(Text, default="{}")      # JSON action config
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    scope: Mapped[str] = mapped_column(String(32), default="global")   # global, fleet, device
    scope_id: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(64))

    executions: Mapped[list["RuleExecution"]] = relationship("RuleExecution", back_populates="rule", cascade="all, delete-orphan")


class RuleExecution(Base):
    __tablename__ = "rule_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rule_id: Mapped[int] = mapped_column(Integer, ForeignKey("rules.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    trigger_data: Mapped[Optional[str]] = mapped_column(Text)   # JSON: what triggered it
    action_result: Mapped[Optional[str]] = mapped_column(Text)  # JSON: what happened
    success: Mapped[bool] = mapped_column(Boolean, default=True)

    rule: Mapped["Rule"] = relationship("Rule", back_populates="executions")
