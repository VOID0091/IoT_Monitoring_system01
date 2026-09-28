import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { networkApi } from '@/api/client'
import { cn, getStatusBg, formatRelativeTime } from '@/lib/utils'
import { Network, RefreshCw, Wifi } from 'lucide-react'

export default function NetworkPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { const r = await networkApi.overview(); setData(r.data) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])

  if (loading && !data) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-24 card animate-pulse bg-slate-100" />)}
      </div>
      <div className="h-64 card animate-pulse bg-slate-100" />
    </div>
  )

  const devices: any[] = data?.devices ?? []
  const groups: Record<string, any[]> = {}
  devices.forEach((d) => { const g = d.group_name ?? 'Ungrouped'; groups[g] = groups[g] ?? []; groups[g].push(d) })

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Network Topology</h2>
          <p className="page-subtitle">Real-time device connectivity, IP mapping and group allocation</p>
        </div>
        <button onClick={load} className="btn btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Nodes', value: data?.total ?? 0, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Online', value: data?.online ?? 0, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Warning', value: data?.warning ?? 0, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Critical', value: data?.critical ?? 0, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'Offline', value: data?.offline ?? 0, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
        ].map(({ label, value, color, bg }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={cn('card text-center border', bg)}>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{label}</p>
            <p className={cn('font-mono text-2xl font-extrabold', color)}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Device groups */}
      {Object.entries(groups).map(([group, devs]) => (
        <div key={group} className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100">
              <Network className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">{group}</h3>
            <span className="badge badge-info">{devs.length} devices</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {['Status', 'Name', 'IP Address', 'MAC', 'Hostname', 'Last Seen'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devs.map((d) => (
                  <motion.tr key={d.device_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('status-dot', d.status)} />
                        <span className={cn('badge uppercase', getStatusBg(d.status))}>{d.status}</span>
                      </div>
                    </td>
                    <td className="font-semibold text-slate-700">{d.name}</td>
                    <td className="font-mono text-slate-600">{d.ip_address ?? '—'}</td>
                    <td className="font-mono text-slate-400 text-[11px]">{d.mac_address ?? '—'}</td>
                    <td className="text-slate-500">{d.hostname ?? '—'}</td>
                    <td className="text-slate-400">{d.last_seen ? formatRelativeTime(d.last_seen) : 'Never'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {Object.keys(groups).length === 0 && (
        <div className="card">
          <div className="empty-state py-16">
            <Wifi className="w-10 h-10 text-slate-300" />
            <p className="font-semibold text-slate-500">No network data</p>
            <p className="text-xs text-slate-400">Register devices to see the network topology.</p>
          </div>
        </div>
      )}
    </div>
  )
}
