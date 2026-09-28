import { useEffect, useState } from 'react'
import { HeartPulse, ShieldAlert, Layers, Bell, CheckCircle2, RefreshCw } from 'lucide-react'
import { devicesApi, fleetApi, alertsApi } from '@/api/client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { motion } from 'framer-motion'

const RULES = [
  { id: 1, name: 'CPU Overload Check', condition: 'cpu_percent > 85', action: 'Dispatch warning alert', active: true },
  { id: 2, name: 'High Temperature Safeguard', condition: 'temperature > 80', action: 'Dispatch critical alert + cooldown command', active: true },
  { id: 3, name: 'Disk Space Alert', condition: 'disk_percent > 90', action: 'Dispatch warning alert + clear log task', active: true },
  { id: 4, name: 'Offline Heartbeat Monitor', condition: 'status == offline', action: 'Flag as disconnected after 30s timeout', active: true },
  { id: 5, name: 'RAM Pressure Policy', condition: 'ram_percent > 92', action: 'Dispatch critical alert + memory flush', active: false },
]

export default function HealthPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      setLoading(true)
      const [devRes, alertRes] = await Promise.all([
        devicesApi.list(),
        alertsApi.list({ limit: 50 }),
      ])
      setDevices(devRes.data)
      setAlerts(alertRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const getHealthScore = (d: any) => {
    if (d.status === 'offline') return 0
    if (d.status === 'critical') return 42
    if (d.status === 'warning') return 73
    return 97
  }

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-green-600' : s >= 50 ? 'text-amber-600' : 'text-red-600'
  const scoreBar = (s: number) =>
    s >= 80 ? 'bg-green-500' : s >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const scoreBadge = (s: number) =>
    s >= 80 ? 'bg-green-50 border-green-200' : s >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  const avgScore = devices.length > 0
    ? Math.round(devices.reduce((acc, d) => acc + getHealthScore(d), 0) / devices.length)
    : 0

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64 card animate-pulse bg-slate-100" />
        <div className="h-64 card animate-pulse bg-slate-100" />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Health & Rule Engine</h2>
          <p className="page-subtitle">Fleet health indices, policy automation, and violation audit trail</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('card px-4 py-2 text-center border', scoreBadge(avgScore))}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fleet Health</p>
            <p className={cn('font-mono text-xl font-extrabold', scoreColor(avgScore))}>{avgScore}%</p>
          </div>
          <button onClick={loadData} className="btn btn-secondary">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device Health Indices */}
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100">
              <Layers className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Device Health Index</h3>
            <span className="badge badge-info ml-auto">{devices.length} devices</span>
          </div>

          {devices.length === 0 ? (
            <div className="empty-state py-10">
              <HeartPulse className="w-8 h-8 text-slate-300" />
              <p className="text-slate-500 font-semibold">No devices registered</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {devices.map((device, i) => {
                const score = getHealthScore(device)
                return (
                  <motion.div
                    key={device.device_id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 transition-all"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('status-dot flex-shrink-0', device.status)} />
                        <p className="font-bold text-slate-700 text-sm truncate">{device.name}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {device.device_id} · {device.platform || 'Unknown platform'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Score</p>
                        <span className={cn('font-mono font-extrabold text-sm', scoreColor(score))}>{score}%</span>
                      </div>
                      <div className="w-20 progress-bar">
                        <div className={cn('progress-fill', scoreBar(score))} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Policy Rules */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-100">
              <Bell className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Automated Policies</h3>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {RULES.map((rule) => (
              <div key={rule.id}
                className={cn('p-2.5 rounded-xl border space-y-1.5 transition-all',
                  rule.active ? 'border-slate-100 bg-white' : 'border-slate-100 bg-slate-50 opacity-50'
                )}>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-700">{rule.name}</p>
                  <span className={cn('badge text-[10px]', rule.active ? 'badge-online' : 'badge-offline')}>
                    {rule.active ? 'active' : 'paused'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  <span className="text-slate-400 font-semibold">IF </span>
                  <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-sky-700 font-mono text-[10px]">{rule.condition}</code>
                </p>
                <p className="text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-500">THEN</span> {rule.action}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Violation / Alert feed */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="p-1.5 rounded-lg bg-red-50 border border-red-100">
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Policy Violation Audit</h3>
            <p className="text-[11px] text-slate-400">Alerts triggered by automated rule conditions</p>
          </div>
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2.5 text-green-700 bg-green-50 border border-green-100 rounded-xl p-3.5 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              All policy checks healthy — no recent violations.
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className={cn('p-2.5 rounded-xl text-xs flex justify-between items-center border', `alert-${alert.severity}`)}>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700 leading-snug">{alert.message}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Device: {alert.device_id} · Alert #{alert.id}
                  </p>
                </div>
                <span className="text-slate-400 text-[10px] font-mono whitespace-nowrap ml-4">
                  {formatRelativeTime(alert.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
