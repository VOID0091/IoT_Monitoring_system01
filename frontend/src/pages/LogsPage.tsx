import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, ScrollText, Search } from 'lucide-react'
import { logsApi } from '@/api/client'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { AuditLog } from '@/store/store'

const ACTION_COLORS: Record<string, string> = {
  login:         'text-green-700 bg-green-50 border-green-200',
  logout:        'text-slate-600 bg-slate-50 border-slate-200',
  create_device: 'text-sky-700 bg-sky-50 border-sky-200',
  update_device: 'text-amber-700 bg-amber-50 border-amber-200',
  delete_device: 'text-red-700 bg-red-50 border-red-200',
  create_user:   'text-sky-700 bg-sky-50 border-sky-200',
  update_user:   'text-amber-700 bg-amber-50 border-amber-200',
  delete_user:   'text-red-700 bg-red-50 border-red-200',
  send_command:  'text-purple-700 bg-purple-50 border-purple-200',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await logsApi.list({ limit: 200 })
      setLogs(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = logs.filter((l) => {
    if (actionFilter && !l.action.includes(actionFilter)) return false
    if (search) {
      const q = search.toLowerCase()
      return l.username?.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) ||
        l.resource_id?.toLowerCase().includes(q) || l.ip_address?.includes(q)
    }
    return true
  })

  const actions = [...new Set(logs.map((l) => l.action))]

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Audit Logs</h2>
          <p className="page-subtitle">Complete chronological record of all platform actions and events</p>
        </div>
        <button onClick={load} className="btn btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="form-input pl-8"
            placeholder="Search user, action, resource, IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          className="form-select" style={{ width: 'auto', minWidth: 150 }}>
          <option value="">All Actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-xs text-slate-400 font-semibold ml-auto">
          {filtered.length} / {logs.length} entries
        </span>
      </div>

      {loading ? (
        <div className="space-y-1">
          {[...Array(10)].map((_, i) => <div key={i} className="h-12 card animate-pulse bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state py-12">
            <ScrollText className="w-8 h-8 text-slate-300" />
            <p className="font-semibold text-slate-500">No logs found</p>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                {['Time', 'User', 'Action', 'Resource', 'IP Address'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td className="font-mono text-slate-400 whitespace-nowrap">{formatRelativeTime(log.timestamp)}</td>
                  <td className="font-semibold text-slate-700">{log.username ?? '—'}</td>
                  <td>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase font-semibold',
                      ACTION_COLORS[log.action] ?? 'text-slate-500 bg-slate-50 border-slate-200')}>
                      {log.action}
                    </span>
                  </td>
                  <td className="font-mono text-slate-500">
                    {log.resource}{log.resource_id ? `/${log.resource_id}` : ''}
                  </td>
                  <td className="font-mono text-slate-400">{log.ip_address ?? '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
