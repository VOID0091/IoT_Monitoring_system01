import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Plus, RefreshCw, Cpu, Edit2 } from 'lucide-react'
import { devicesApi } from '@/api/client'
import { useDeviceStore } from '@/store/store'
import { cn, getStatusBg, formatRelativeTime } from '@/lib/utils'

const STATUS_FILTERS = ['all', 'online', 'warning', 'critical', 'maintenance', 'offline']

export default function DevicesPage() {
  const { devices, setDevices } = useDeviceStore()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const [devRes, grpRes] = await Promise.all([devicesApi.list(), devicesApi.groups()])
      setDevices(devRes.data)
      setGroups(grpRes.data.groups ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = devices.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (groupFilter && d.group_name !== groupFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return d.name.toLowerCase().includes(q) || d.hostname?.toLowerCase().includes(q) ||
        d.ip_address?.toLowerCase().includes(q) || d.device_id.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Page Title & Toolbar */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Device Fleet</h2>
          <p className="page-subtitle">Manage, configure, and monitor all industrial edge controllers</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" /> Register New Device
        </button>
      </div>

      {/* Toolbar filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="form-input pl-9"
            placeholder="Search by name, ID, IP, or hostname..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="form-select w-48"
        >
          <option value="">All Groups</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        <button onClick={load} className="btn btn-secondary p-2" title="Refresh list">
          <RefreshCw className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((s) => {
          const count = s === 'all' ? devices.length : devices.filter((d) => d.status === s).length
          const isActive = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'btn btn-sm capitalize',
                isActive ? 'btn-primary' : 'btn-secondary text-slate-600 border-slate-200'
              )}
            >
              {s} <span className={cn('ml-1.5 px-1.5 py-0.5 rounded text-[10px]', isActive ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500')}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Device table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="empty-state">
            <Cpu className="w-12 h-12 text-slate-300" />
            <p className="font-semibold text-slate-700">No matching devices found</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">Try refining your search criteria or register a new device to get started.</p>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {['Status', 'Device details', 'Network & IP', 'Platform adapter', 'Fleet Group', 'Last heartbeat', ''].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((device) => (
                  <tr
                    key={device.device_id}
                    onClick={() => navigate(`/devices/${device.device_id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={cn('status-dot', device.status)} />
                        <span className={cn('badge uppercase', getStatusBg(device.status))}>
                          {device.status}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-semibold text-slate-800 hover:text-sky-600 transition-colors">{device.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{device.device_id}</p>
                      </div>
                    </td>
                    <td>
                      <p className="font-mono text-slate-700 text-xs font-semibold">{device.ip_address ?? '—'}</p>
                      <p className="text-xs text-slate-400 font-mono">{device.hostname ?? '—'}</p>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-700">{device.platform ?? '—'}</span>
                    </td>
                    <td>
                      {device.group_name ? (
                        <span className="badge badge-info">{device.group_name}</span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-slate-500 text-xs">
                        {device.last_seen ? formatRelativeTime(device.last_seen) : 'Never'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/devices/${device.device_id}`) }}
                          className="btn btn-ghost p-1.5"
                          title="Configure"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddDeviceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ device_id: '', name: '', hostname: '', ip_address: '', group_name: '', location: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await devicesApi.create(form)
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to create device')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-md shadow-2xl">
        <h2 className="text-base font-bold text-slate-800 mb-1">Register New Industrial Controller</h2>
        <p className="text-xs text-slate-500 mb-4">Registering a new device allows it to securely connect using the Phantomation Edge Agent.</p>
        
        {error && <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs font-semibold">{error}</div>}
        
        <form onSubmit={submit} className="space-y-3">
          {[
            { key: 'device_id', label: 'Unique Device ID *', placeholder: 'e.g. edge-plc-01' },
            { key: 'name', label: 'Display Name *', placeholder: 'e.g. Assembly Line PLC' },
            { key: 'hostname', label: 'Hostname / Domain', placeholder: 'e.g. plc-01.local' },
            { key: 'ip_address', label: 'IP Address', placeholder: 'e.g. 192.168.1.50' },
            { key: 'group_name', label: 'Fleet Group', placeholder: 'e.g. Plant-Alpha' },
            { key: 'location', label: 'Physical Location', placeholder: 'e.g. Section 4, Bay A' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
              <input
                className="form-input font-mono"
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required={key === 'device_id' || key === 'name'}
              />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
