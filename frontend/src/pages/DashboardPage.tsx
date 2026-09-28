import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDeviceStore, useTelemetryStore, useAlertStore } from '@/store/store'
import { devicesApi, alertsApi } from '@/api/client'
import { formatUptime, getStatusBg, metricColor, metricBarColor, formatRelativeTime } from '@/lib/utils'
import { Cpu, Thermometer, Clock, AlertTriangle, CheckCircle2, Server, Wifi, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import type { Device, Telemetry, Alert } from '@/store/store'

export default function DashboardPage() {
  const { devices, setDevices } = useDeviceStore()
  const { latestByDevice } = useTelemetryStore()
  const { alerts, alertStats, setAlerts, setAlertStats } = useAlertStore()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const load = async () => {
    try {
      const [devRes, alertRes, statsRes] = await Promise.all([
        devicesApi.list(),
        alertsApi.list({ resolved: false, limit: 20 }),
        alertsApi.stats(),
      ])
      setDevices(devRes.data)
      setAlerts(alertRes.data)
      setAlertStats(statsRes.data)
      const uniqueGroups = [...new Set(devRes.data.map((d: Device) => d.group_name).filter(Boolean))]
      setGroups(uniqueGroups as string[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const filteredDevices = selectedGroup
    ? devices.filter((d) => d.group_name === selectedGroup)
    : devices

  const onlineCount = devices.filter((d) => d.status === 'online').length
  const warningCount = devices.filter((d) => d.status === 'warning').length
  const criticalCount = devices.filter((d) => d.status === 'critical').length
  const offlineCount = devices.filter((d) => d.status === 'offline').length

  if (loading) return <LoadingState />

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Phantomation DeviceOps</h2>
          <p className="page-subtitle">Industrial Device Operating Platform & Fleet Telemetry Hub</p>
        </div>
        <button onClick={load} className="btn btn-secondary flex items-center gap-1.5 font-semibold">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Fleet
        </button>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Online Controllers" value={onlineCount} total={devices.length} status="online" icon={<CheckCircle2 className="w-4 h-4" />} />
        <KpiCard label="Warning Alerts" value={warningCount} total={devices.length} status="warning" icon={<AlertTriangle className="w-4 h-4" />} />
        <KpiCard label="Critical Incidents" value={criticalCount} total={devices.length} status="critical" icon={<AlertTriangle className="w-4 h-4" />} />
        <KpiCard label="Offline Units" value={offlineCount} total={devices.length} status="offline" icon={<Wifi className="w-4 h-4" />} />
      </div>

      {/* Main bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device grid (2 cols wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Connected Fleet Status</h3>
            {/* Group filter */}
            {groups.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className={cn('btn btn-sm py-1 px-3',
                    !selectedGroup ? 'btn-primary' : 'btn-secondary text-slate-600')}
                >All</button>
                {groups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGroup(g)}
                    className={cn('btn btn-sm py-1 px-3',
                      selectedGroup === g ? 'btn-primary' : 'btn-secondary text-slate-600')}
                  >{g}</button>
                ))}
              </div>
            )}
          </div>

          {/* Device cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredDevices.length === 0 ? (
              <div className="col-span-2 card text-center py-16">
                <div className="empty-state">
                  <Server className="w-10 h-10 text-slate-300" />
                  <p className="font-semibold text-slate-700">No registered devices</p>
                  <p className="text-xs text-slate-500">Go to the Devices page to register your first PLC/agent.</p>
                </div>
              </div>
            ) : (
              filteredDevices.map((device) => (
                <DeviceCard key={device.device_id} device={device} telemetry={latestByDevice[device.device_id]} />
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Alert panel */}
          <AlertPanel alerts={alerts} stats={alertStats} />
          {/* Network status */}
          <NetworkStatusPanel devices={devices} />
        </div>
      </div>

      {/* Telemetry chart strip */}
      {devices.filter(d => d.status !== 'offline').length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Real-Time Core Performance</h3>
          <TelemetryChartStrip devices={devices} />
        </div>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, total, status, icon }: {
  label: string; value: number; total: number; status: string; icon: React.ReactNode
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const colors: Record<string, string> = {
    online: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
    offline: 'text-slate-600 bg-slate-50 border-slate-200',
  }
  const barColors: Record<string, string> = {
    online: 'bg-green-500', warning: 'bg-amber-500', critical: 'bg-red-500', offline: 'bg-slate-400'
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={cn('p-1.5 rounded-lg border text-xs', colors[status])}>{icon}</span>
      </div>
      <div className="font-mono text-3xl font-extrabold text-slate-800 mb-1">{value}</div>
      <div className="progress-bar mb-1.5">
        <div className={cn('progress-fill', barColors[status])} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-400 font-semibold">{pct}% of fleet ({total} total)</div>
    </motion.div>
  )
}

// ─── Device Card ───────────────────────────────────────────────────────────────

function DeviceCard({ device, telemetry }: { device: Device; telemetry?: Telemetry }) {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => navigate(`/devices/${device.device_id}`)}
      className={cn('card card-interactive',
        device.status === 'critical' && 'border-red-300 glow-red',
        device.status === 'warning' && 'border-amber-300'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('status-dot flex-shrink-0', device.status)} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-sky-600 transition-colors">
              {device.name}
            </p>
            <p className="text-xs text-slate-400 font-mono truncate">{device.hostname ?? device.ip_address ?? '—'}</p>
          </div>
        </div>
        <span className={cn('badge uppercase', getStatusBg(device.status))}>
          {device.status}
        </span>
      </div>

      {/* Metrics */}
      {telemetry ? (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="CPU usage" value={telemetry.cpu_percent} unit="%" warn={75} crit={90} />
          <Metric label="RAM usage" value={telemetry.ram_percent} unit="%" warn={80} crit={95} />
          <Metric label="Core temp" value={telemetry.temperature} unit="°C" warn={70} crit={85} />
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col justify-between">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Uptime</div>
            <div className="font-mono text-xs text-slate-700 font-bold">{formatUptime(telemetry.uptime_seconds ?? 0)}</div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
          No agent telemetry received yet
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
        <span className="font-mono">{device.ip_address ?? '—'}</span>
        <span>{device.last_seen ? formatRelativeTime(device.last_seen) : 'Never'}</span>
      </div>
    </motion.div>
  )
}

function Metric({ label, value, unit, warn, crit }: {
  label: string; value?: number; unit: string; warn: number; crit: number
}) {
  const v = value ?? 0
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn('font-mono text-sm font-extrabold', metricColor(v, warn, crit))}>
        {value !== undefined ? `${v.toFixed(1)}${unit}` : '—'}
      </div>
      {value !== undefined && (
        <div className="progress-bar mt-1" style={{ height: 3 }}>
          <div className={cn('progress-fill', metricBarColor(v, warn, crit))} style={{ width: `${Math.min(v, 100)}%` }} />
        </div>
      )}
    </div>
  )
}

// ─── Alert Panel ───────────────────────────────────────────────────────────────

function AlertPanel({ alerts, stats }: { alerts: Alert[]; stats: any }) {
  const unresolved = alerts.filter((a) => !a.resolved)
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active Operations Alerts</h3>
        <div className="flex items-center gap-1.5">
          {stats.critical > 0 && <span className="badge badge-critical font-mono font-bold text-[10px]">{stats.critical} Critical</span>}
          {stats.warning > 0 && <span className="badge badge-warning font-mono font-bold text-[10px]">{stats.warning} Warning</span>}
        </div>
      </div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {unresolved.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-100 rounded-lg p-3 text-xs font-semibold">
            <CheckCircle2 className="w-4.5 h-4.5 text-green-500" />
            All systems running within specs.
          </div>
        ) : (
          unresolved.map((a) => (
            <div key={a.id} className={cn('p-2.5 rounded-lg text-xs border border-slate-100', `alert-${a.severity}`)}>
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-slate-700 font-semibold leading-tight">{a.message}</span>
                <span className="text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(a.created_at)}</span>
              </div>
              <span className="text-slate-400 font-mono text-[10px] mt-1 block font-bold">{a.device_id}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Network Status Panel ──────────────────────────────────────────────────────

function NetworkStatusPanel({ devices }: { devices: Device[] }) {
  const statusCounts: Record<string, number> = {}
  devices.forEach((d) => { statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1 })

  return (
    <div className="card">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Fleet Allocation</h3>
      <div className="space-y-2.5">
        {[
          { status: 'online', label: 'Online', color: 'bg-green-500' },
          { status: 'warning', label: 'Warning', color: 'bg-amber-500' },
          { status: 'critical', label: 'Critical', color: 'bg-red-500' },
          { status: 'maintenance', label: 'Maintenance', color: 'bg-blue-500' },
          { status: 'offline', label: 'Offline', color: 'bg-slate-400' },
        ].map(({ status, label, color }) => {
          const count = statusCounts[status] ?? 0
          const pct = devices.length > 0 ? (count / devices.length) * 100 : 0
          return (
            <div key={status} className="flex items-center gap-2 text-xs">
              <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', color)} />
              <span className="text-slate-600 font-semibold w-24">{label}</span>
              <div className="flex-1 progress-bar">
                <div className={cn('progress-fill', color)} style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-slate-500 font-bold w-6 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Telemetry Chart Strip ─────────────────────────────────────────────────────

function TelemetryChartStrip({ devices }: { devices: Device[] }) {
  const { historyByDevice } = useTelemetryStore()
  const activeDevices = devices.filter((d) => historyByDevice[d.device_id]?.length > 1).slice(0, 3)

  if (activeDevices.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {activeDevices.map((device) => {
        const history = historyByDevice[device.device_id] ?? []
        const chartData = history.slice(-30).map((t) => ({
          t: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          cpu: t.cpu_percent ?? 0,
          ram: t.ram_percent ?? 0,
        }))
        return (
          <div key={device.device_id} className="bento-dark text-slate-200 font-sans p-4 shadow-lg border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={cn('status-dot', device.status)} />
                <span className="text-xs font-bold text-slate-200 truncate">{device.name}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">CPU / RAM %</span>
            </div>
            <ResponsiveContainer width="100%" height={70}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`cpu-${device.device_id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`ram-${device.device_id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="cpu" stroke="#0ea5e9" strokeWidth={1.5} fill={`url(#cpu-${device.device_id})`} dot={false} />
                <Area type="monotone" dataKey="ram" stroke="#10b981" strokeWidth={1.5} fill={`url(#ram-${device.device_id})`} dot={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#f8fafc' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v: any, n: any) => [`${v.toFixed(1)}%`, String(n).toUpperCase()]}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-16 card animate-pulse bg-slate-200" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-28 animate-pulse bg-slate-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-96 card animate-pulse bg-slate-200" />
        <div className="h-96 card animate-pulse bg-slate-200" />
      </div>
    </div>
  )
}
