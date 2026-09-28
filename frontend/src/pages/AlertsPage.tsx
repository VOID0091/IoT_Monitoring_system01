import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, RefreshCw, Bell, AlertTriangle, Info } from 'lucide-react'
import { alertsApi } from '@/api/client'
import { useAlertStore } from '@/store/store'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Alert } from '@/store/store'

const SEVERITY_FILTERS = ['all', 'critical', 'warning', 'info']

export default function AlertsPage() {
  const { alerts, setAlerts, setAlertStats } = useAlertStore()
  const [loading, setLoading] = useState(true)
  const [sevFilter, setSevFilter] = useState('all')
  const [showResolved, setShowResolved] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [acting, setActing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [alertRes, statsRes] = await Promise.all([
        alertsApi.list({ resolved: showResolved ? undefined : false, limit: 200 }),
        alertsApi.stats(),
      ])
      setAlerts(alertRes.data)
      setAlertStats(statsRes.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [showResolved])

  const filtered = alerts.filter((a) => sevFilter === 'all' || a.severity === sevFilter)

  const toggleSelect = (id: number) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const acknowledge = async () => {
    if (!selected.size) return
    setActing(true)
    await alertsApi.acknowledge([...selected])
    setSelected(new Set())
    await load()
    setActing(false)
  }

  const resolve = async () => {
    if (!selected.size) return
    setActing(true)
    await alertsApi.resolve([...selected])
    setSelected(new Set())
    await load()
    setActing(false)
  }

  const critCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length
  const warnCount = alerts.filter(a => a.severity === 'warning' && !a.resolved).length

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Operations Alerts</h2>
          <p className="page-subtitle">Monitor, acknowledge and resolve system alerts across the fleet</p>
        </div>
        <div className="flex items-center gap-2">
          {critCount > 0 && <span className="badge badge-critical">{critCount} Critical</span>}
          {warnCount > 0 && <span className="badge badge-warning">{warnCount} Warning</span>}
        </div>
      </div>

      {/* Toolbar */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Severity filters */}
          <div className="flex items-center gap-1">
            {SEVERITY_FILTERS.map((s) => {
              const count = s === 'all' ? alerts.length : alerts.filter((a) => a.severity === s).length
              return (
                <button key={s} onClick={() => setSevFilter(s)}
                  className={cn('btn btn-sm capitalize',
                    sevFilter === s ? 'btn-primary' : 'btn-secondary')}>
                  {s} <span className="ml-1 opacity-60 font-mono">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Show resolved toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-500 font-medium cursor-pointer ml-auto">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded accent-sky-500" />
            Show resolved
          </label>

          <button onClick={load} className="btn btn-secondary btn-sm">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {selected.size > 0 && (
            <>
              <button onClick={acknowledge} disabled={acting}
                className="btn btn-sm" style={{ background: '#d97706', color: 'white', borderColor: '#b45309' }}>
                Acknowledge ({selected.size})
              </button>
              <button onClick={resolve} disabled={acting}
                className="btn btn-sm" style={{ background: '#16a34a', color: 'white', borderColor: '#15803d' }}>
                Resolve ({selected.size})
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="h-16 card animate-pulse bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <Bell className="w-8 h-8 text-slate-300" />
            <p className="font-semibold text-slate-500">No alerts found</p>
            <p className="text-xs text-slate-400">
              {sevFilter !== 'all' ? `No ${sevFilter} alerts to display.` : 'All systems are operating normally.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((alert) => (
            <AlertRow key={alert.id} alert={alert} selected={selected.has(alert.id)} onToggle={() => toggleSelect(alert.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertRow({ alert, selected, onToggle }: { alert: Alert; selected: boolean; onToggle: () => void }) {
  const severityClass: Record<string, string> = {
    critical: 'alert-critical',
    warning: 'alert-warning',
    info: 'alert-info',
  }

  const SevIcon = alert.severity === 'critical' ? AlertTriangle :
    alert.severity === 'warning' ? AlertTriangle : Info

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all border border-transparent',
        severityClass[alert.severity] ?? 'card',
        selected && 'ring-2 ring-sky-400/40 ring-offset-1',
        alert.resolved && 'opacity-50',
      )}
      onClick={onToggle}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} onClick={(e) => e.stopPropagation()}
        className="mt-0.5 rounded flex-shrink-0 accent-sky-500" />

      <SevIcon className={cn('w-4 h-4 flex-shrink-0 mt-0.5',
        alert.severity === 'critical' ? 'text-red-500' :
        alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('badge uppercase',
              alert.severity === 'critical' ? 'badge-critical' :
              alert.severity === 'warning' ? 'badge-warning' : 'badge-info')}>
              {alert.severity}
            </span>
            {alert.category && (
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{alert.category}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {alert.acknowledged && (
              <span className="badge badge-info text-[10px]">ACK</span>
            )}
            {alert.resolved && (
              <span className="badge badge-success text-[10px]">RESOLVED</span>
            )}
            <span className="text-xs font-mono text-slate-400">{formatRelativeTime(alert.created_at)}</span>
          </div>
        </div>
        <p className="text-sm text-slate-700 font-medium mt-1 leading-snug">{alert.message}</p>
        <p className="text-xs font-mono text-slate-400 mt-0.5 font-bold">{alert.device_id}</p>
      </div>
    </motion.div>
  )
}
