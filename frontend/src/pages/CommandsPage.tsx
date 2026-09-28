import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal, Play, Trash2, ShieldAlert, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { commandsApi, devicesApi, fleetApi } from '@/api/client'
import { cn, formatRelativeTime } from '@/lib/utils'

export default function CommandsPage() {
  const [commands, setCommands] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [fleets, setFleets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Dispatch parameters
  const [targetType, setTargetType] = useState<'device' | 'fleet'>('device')
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [selectedFleet, setSelectedFleet] = useState<string>('')
  const [commandType, setCommandType] = useState<string>('')
  const [payload, setPayload] = useState<string>('{}')
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const [cmdRes, devRes, fleetRes] = await Promise.all([
        commandsApi.list(),
        devicesApi.list(),
        fleetApi.listFleets(),
      ])
      setCommands(cmdRes.data)
      setDevices(devRes.data)
      setFleets(fleetRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(async () => {
      try {
        const cmdRes = await commandsApi.list()
        setCommands(cmdRes.data)
      } catch (e) {}
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const presets = [
    { label: 'Reboot Device', type: 'reboot', payload: '{}' },
    { label: 'Restart Agent', type: 'restart_agent', payload: '{}' },
    { label: 'Clear Logs', type: 'clean_logs', payload: '{"days": 7}' },
    { label: 'Configure Diagnostics', type: 'set_diagnostics', payload: '{"interval_seconds": 60}' },
  ]

  const handleApplyPreset = (p: typeof presets[0]) => {
    setCommandType(p.type)
    setPayload(p.payload)
  }

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commandType) return
    setSubmitting(true)
    try {
      let parsedPayload = {}
      try {
        if (payload.trim()) parsedPayload = JSON.parse(payload)
      } catch (err) {
        alert('Invalid JSON in payload')
        setSubmitting(false)
        return
      }

      if (targetType === 'device') {
        if (!selectedDevice) {
          alert('Please select a device')
          setSubmitting(false)
          return
        }
        await commandsApi.dispatch({
          device_id: selectedDevice,
          command_type: commandType,
          payload: parsedPayload,
        })
      } else {
        if (!selectedFleet) {
          alert('Please select a fleet')
          setSubmitting(false)
          return
        }
        await fleetApi.bulkAction({
          fleet_id: parseInt(selectedFleet),
          command_type: commandType,
          payload: parsedPayload,
        })
      }

      alert('Command dispatched successfully')
      loadData()
    } catch (err) {
      alert('Error dispatching command')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelCommand = async (commandId: string) => {
    try {
      await commandsApi.cancel(commandId)
      loadData()
    } catch (err) {
      alert('Error cancelling command')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
      case 'sent': return <Play className="w-3.5 h-3.5 text-sky-500" />
      case 'executing': return <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
      case 'succeeded': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
      case 'failed': return <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
      default: return <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'succeeded': return 'badge-success'
      case 'failed': return 'badge-critical'
      case 'executing': return 'badge-warning'
      case 'sent': return 'badge-info'
      default: return 'badge-offline'
    }
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Terminal className="w-5 h-5 text-sky-500" /> Remote Command Execution
          </h2>
          <p className="page-subtitle">Dispatch real-time instructions and actions to edge nodes via MQTT.</p>
        </div>
        <button onClick={loadData} className="btn btn-secondary p-2" title="Refresh logs">
          <RefreshCw className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Command Form Panel */}
        <div className="card space-y-4 h-fit">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
            Dispatch Command Action
          </h3>

          <form onSubmit={handleDispatch} className="space-y-4">
            {/* Target Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Target Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType('device')}
                  className={cn('flex-1 btn btn-sm border',
                    targetType === 'device'
                      ? 'btn-primary'
                      : 'btn-secondary text-slate-600')}
                >
                  Single Device
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('fleet')}
                  className={cn('flex-1 btn btn-sm border',
                    targetType === 'fleet'
                      ? 'btn-primary'
                      : 'btn-secondary text-slate-600')}
                >
                  Fleet (Bulk)
                </button>
              </div>
            </div>

            {/* Target Pickers */}
            {targetType === 'device' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Target Device</label>
                <select
                  value={selectedDevice}
                  onChange={e => setSelectedDevice(e.target.value)}
                  className="form-select text-xs"
                >
                  <option value="">Select Target Device...</option>
                  {devices.map(d => (
                    <option key={d.device_id} value={d.device_id}>
                      {d.name} ({d.device_id}) [{d.status}]
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Target Fleet Group</label>
                <select
                  value={selectedFleet}
                  onChange={e => setSelectedFleet(e.target.value)}
                  className="form-select text-xs"
                >
                  <option value="">Select Fleet...</option>
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Presets Strip */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Operations Presets</label>
              <div className="flex gap-1.5 flex-wrap">
                {presets.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="btn btn-secondary btn-sm py-1 px-2 border-slate-200 text-slate-600 hover:border-slate-400"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Command Inputs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Command Action Name</label>
              <input
                placeholder="e.g. reboot"
                value={commandType}
                onChange={e => setCommandType(e.target.value)}
                className="form-input font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">JSON Parameters Payload</label>
              <textarea
                placeholder="{}"
                rows={4}
                value={payload}
                onChange={e => setPayload(e.target.value)}
                className="form-input font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !commandType}
              className="btn btn-primary w-full flex items-center justify-center gap-1.5 py-2 font-bold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Dispatch Command
            </button>
          </form>
        </div>

        {/* Command History / Tracking Panel */}
        <div className="card lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
            MQTT Command Transmission Log
          </h3>

          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
            {loading && commands.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">Loading command audits...</div>
            ) : commands.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No edge commands recorded.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Device Details</th>
                    <th>Command Type</th>
                    <th>Status</th>
                    <th>Triggered By</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commands.map(cmd => {
                    const dev = devices.find(d => d.device_id === cmd.device_id)
                    return (
                      <tr key={cmd.command_id}>
                        <td className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                          {formatRelativeTime(cmd.created_at)}
                        </td>
                        <td>
                          <p className="font-semibold text-slate-800">{dev ? dev.name : 'Unknown PLC'}</p>
                          <p className="text-[10px] font-mono text-slate-400">{cmd.device_id}</p>
                        </td>
                        <td>
                          <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded">
                            {cmd.command_type}
                          </span>
                          {cmd.payload && cmd.payload !== '{}' && (
                            <pre className="text-[10px] text-slate-400 mt-1.5 font-mono max-w-[240px] truncate bg-slate-50 p-1 rounded border border-slate-100">
                              {cmd.payload}
                            </pre>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(cmd.status)}
                            <span className={cn('badge uppercase font-bold text-[10px]', getStatusBadgeClass(cmd.status))}>
                              {cmd.status}
                            </span>
                          </div>
                        </td>
                        <td className="text-slate-500 font-semibold">{cmd.created_by || 'system'}</td>
                        <td className="text-right">
                          {cmd.status === 'pending' && (
                            <button
                              onClick={() => handleCancelCommand(cmd.command_id)}
                              className="btn btn-danger btn-sm py-1 px-2 text-[10px]"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
