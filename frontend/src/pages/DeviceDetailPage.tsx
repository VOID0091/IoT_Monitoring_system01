import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Terminal, RotateCcw, Network, Server, Cpu, MemoryStick,
  Thermometer, HardDrive, Clock, ChevronDown, Activity,
  Settings2, AppWindow, History, Play, Square, Loader2, Download, Trash2
} from 'lucide-react'
import { devicesApi, telemetryApi, alertsApi, shadowApi, appsApi, eventsApi } from '@/api/client'
import { useTelemetryStore } from '@/store/store'
import { cn, formatUptime, formatRelativeTime, getStatusBg, metricColor, metricBarColor } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Device, Telemetry, Alert } from '@/store/store'

export default function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const [device, setDevice] = useState<Device | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [commandOpen, setCommandOpen] = useState(false)
  const { historyByDevice, latestByDevice, setHistory } = useTelemetryStore()

  // Tabs state
  const [activeTab, setActiveTab] = useState<'metrics' | 'shadow' | 'apps' | 'timeline'>('metrics')

  // Device Shadow Tab State
  const [shadow, setShadow] = useState<any>({ desired: {}, reported: {}, diff: {} })
  const [desiredText, setDesiredText] = useState('{}')
  const [updatingShadow, setUpdatingShadow] = useState(false)

  // Device Apps Tab State
  const [deviceApps, setDeviceApps] = useState<any[]>([])
  const [catalogApps, setCatalogApps] = useState<any[]>([])
  const [selectedAppId, setSelectedAppId] = useState('')
  const [installingApp, setInstallingApp] = useState(false)

  // Device Timeline Tab State
  const [timelineEvents, setTimelineEvents] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  async function loadCoreData() {
    if (!deviceId) return
    try {
      const [devRes, telRes, alertRes] = await Promise.all([
        devicesApi.get(deviceId),
        telemetryApi.history(deviceId, 100),
        alertsApi.list({ device_id: deviceId, resolved: false }),
      ])
      setDevice(devRes.data)
      setHistory(deviceId, telRes.data)
      setAlerts(alertRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Load active tab dependencies
  useEffect(() => {
    loadCoreData()
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) return
    if (activeTab === 'shadow') {
      shadowApi.get(deviceId).then(res => {
        setShadow(res.data)
        setDesiredText(JSON.stringify(res.data.desired || {}, null, 2))
      }).catch(console.error)
    } else if (activeTab === 'apps') {
      Promise.all([
        appsApi.deviceApps(deviceId),
        appsApi.list()
      ]).then(([devAppsRes, listRes]) => {
        setDeviceApps(devAppsRes.data)
        setCatalogApps(listRes.data)
      }).catch(console.error)
    } else if (activeTab === 'timeline') {
      setLoadingTimeline(true)
      eventsApi.deviceEvents(deviceId).then(res => {
        setTimelineEvents(res.data)
      }).catch(console.error).finally(() => setLoadingTimeline(false))
    }
  }, [activeTab, deviceId])

  const handleUpdateShadow = async () => {
    if (!deviceId) return
    setUpdatingShadow(true)
    try {
      const parsed = JSON.parse(desiredText)
      const res = await shadowApi.updateDesired(deviceId, parsed)
      setShadow(res.data)
      alert('Desired state updated successfully. Agent shadow diff dispatched.')
    } catch (err) {
      alert('Invalid JSON or update error')
    } finally {
      setUpdatingShadow(false)
    }
  }

  const handleInstallApp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceId || !selectedAppId) return
    setInstallingApp(true)
    try {
      await appsApi.install(deviceId, parseInt(selectedAppId))
      alert('Installation command dispatched via Shadow State')
      setSelectedAppId('')
      // Refresh apps
      const appsRes = await appsApi.deviceApps(deviceId)
      setDeviceApps(appsRes.data)
    } catch (err) {
      alert('Error initiating application install')
    } finally {
      setInstallingApp(false)
    }
  }

  const handleAppAction = async (appId: number, action: string) => {
    if (!deviceId) return
    try {
      await appsApi.action(deviceId, appId, action)
      alert(`Lifecycle action '${action}' dispatched`)
      setTimeout(async () => {
        const appsRes = await appsApi.deviceApps(deviceId)
        setDeviceApps(appsRes.data)
      }, 1000)
    } catch (err) {
      alert(`Action '${action}' failed to dispatch`)
    }
  }

  const history = historyByDevice[deviceId!] ?? []
  const latest = latestByDevice[deviceId!] ?? (history.length > 0 ? history[history.length - 1] : null)

  const chartData = history.slice(-60).map((t) => ({
    t: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cpu: t.cpu_percent ?? 0,
    ram: t.ram_percent ?? 0,
    temp: t.temperature ?? 0,
    disk: t.disk_percent ?? 0,
  }))

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 card animate-pulse bg-slate-200" />)}</div>
  if (!device) return <div className="card text-slate-500 text-center py-12">Device not found</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/devices')} className="btn btn-secondary p-2" title="Back to devices">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <span className={cn('status-dot w-3 h-3', device.status)} />
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">{device.name}</h2>
              <p className="text-xs text-slate-400 font-mono leading-none mt-1">{device.device_id}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={cn('badge uppercase font-bold text-xs', getStatusBg(device.status))}>{device.status}</span>
          <button onClick={() => setCommandOpen(!commandOpen)}
            className="btn btn-primary flex items-center gap-1.5 font-semibold text-xs py-2">
            <Terminal className="w-4 h-4" /> Operations Commands <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', commandOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Command panel */}
      {commandOpen && <CommandPanel deviceId={device.device_id} onClose={() => setCommandOpen(false)} />}

      {/* Info grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'IP Address', value: device.ip_address ?? '—', icon: <Network className="w-4 h-4 text-sky-500" />, mono: true },
          { label: 'Hostname', value: device.hostname ?? '—', icon: <Server className="w-4 h-4 text-indigo-500" />, mono: true },
          { label: 'Platform Adapter', value: device.platform ?? '—', icon: <Cpu className="w-4 h-4 text-green-500" />, mono: false },
          { label: 'Last Heartbeat', value: device.last_seen ? formatRelativeTime(device.last_seen) : 'Never', icon: <Clock className="w-4 h-4 text-amber-500" />, mono: false },
        ].map(({ label, value, icon, mono }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1.5">{icon}{label}</div>
            <p className={cn('text-sm text-slate-800 font-bold truncate', mono && 'font-mono')}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1.5 border-b border-slate-200 pb-px">
        {[
          { id: 'metrics', label: 'Metrics & Telemetry', icon: <Activity className="w-4 h-4" /> },
          { id: 'shadow', label: 'Device Shadow State', icon: <Settings2 className="w-4 h-4" /> },
          { id: 'apps', label: 'Container Apps', icon: <AppWindow className="w-4 h-4" /> },
          { id: 'timeline', label: 'Audit Timeline', icon: <History className="w-4 h-4" /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 -mb-px',
              activeTab === t.id
                ? 'border-sky-500 text-sky-600 bg-white font-extrabold shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50')}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: Live Metrics */}
      {activeTab === 'metrics' && (
        <div className="space-y-4">
          {latest && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="CPU load" value={latest.cpu_percent} unit="%" warn={75} crit={90} icon={<Cpu className="w-4 h-4" />} />
              <MetricCard label="RAM usage" value={latest.ram_percent} unit="%" warn={80} crit={95} icon={<MemoryStick className="w-4 h-4" />}
                sub={latest.ram_used_mb ? `${(latest.ram_used_mb / 1024).toFixed(1)} / ${(latest.ram_total_mb! / 1024).toFixed(1)} GB` : undefined} />
              <MetricCard label="Core Temp" value={latest.temperature} unit="°C" warn={70} crit={85} icon={<Thermometer className="w-4 h-4" />} />
              <MetricCard label="Disk Volume" value={latest.disk_percent} unit="%" warn={80} crit={95} icon={<HardDrive className="w-4 h-4" />}
                sub={latest.disk_used_gb ? `${latest.disk_used_gb.toFixed(1)} / ${latest.disk_total_gb?.toFixed(1)} GB` : undefined} />
            </div>
          )}

          {chartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TelemetryChart title="CPU & RAM Telemetry History" data={chartData}
                series={[{ key: 'cpu', color: '#0ea5e9', label: 'CPU Load' }, { key: 'ram', color: '#22c55e', label: 'RAM Usage' }]} />
              <TelemetryChart title="Temperature and Storage Usage" data={chartData}
                series={[{ key: 'temp', color: '#f59e0b', label: 'Core Temp (°C)' }, { key: 'disk', color: '#8b5cf6', label: 'Storage Load (%)' }]} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Capabilities */}
            <div className="card">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Reported Agent Capabilities</h3>
              {device.capabilities.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No capabilities reported from device adapter.</p>
              ) : (
                <div className="space-y-2">
                  {device.capabilities.map((cap) => (
                    <div key={cap.capability} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-600 font-semibold">{cap.capability}</span>
                      <span className="font-mono text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded">{cap.value ?? 'Enabled'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active alerts */}
            <div className="card">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Active Node Incidents</h3>
              {alerts.length === 0 ? (
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700 font-semibold">
                  No active incidents or warning anomalies detected.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {alerts.map((a) => (
                    <div key={a.id} className={cn('p-2.5 rounded-lg text-xs border border-slate-100', `alert-${a.severity}`)}>
                      <p className="text-slate-800 font-semibold">{a.message}</p>
                      <p className="text-slate-400 mt-1 font-mono text-[10px]">{formatRelativeTime(a.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Device Shadow */}
      {activeTab === 'shadow' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Desired config editor */}
          <div className="card space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Desired State (Config)</h3>
            <p className="text-[11px] text-slate-400">Configure parameters to update the target state of this device.</p>
            <textarea
              value={desiredText}
              onChange={e => setDesiredText(e.target.value)}
              rows={15}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg font-mono text-xs text-sky-400 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleUpdateShadow}
              disabled={updatingShadow}
              className="btn btn-primary w-full flex items-center justify-center gap-1.5"
            >
              {updatingShadow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
              Publish Target State
            </button>
          </div>

          {/* Reported state viewer */}
          <div className="card space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Reported State (Actual)</h3>
            <p className="text-[11px] text-slate-400">The current status and settings reported from the agent loop.</p>
            <pre className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg font-mono text-xs text-green-400 max-h-[350px] overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(shadow.reported || {}, null, 2)}
            </pre>
          </div>

          {/* Computed diff state */}
          <div className="card space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Calculated State Delta</h3>
            <p className="text-[11px] text-slate-400">Differences awaiting local synchronisation on the edge.</p>
            <pre className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg font-mono text-xs text-rose-400 max-h-[320px] overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(shadow.diff || {}, null, 2)}
            </pre>
            <p className="text-[10px] text-slate-500 italic leading-snug">
              Delta is automatically generated by comparing the Desired state configuration with latest metrics reported from your edge nodes.
            </p>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Applications */}
      {activeTab === 'apps' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quick Install Catalog */}
          <div className="card space-y-3 h-fit">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-sky-500" /> Deploy Repository App
            </h3>
            {catalogApps.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No apps configured in regional repositories.</p>
            ) : (
              <form onSubmit={handleInstallApp} className="space-y-3">
                <select
                  value={selectedAppId}
                  onChange={e => setSelectedAppId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select app target...</option>
                  {catalogApps.map(a => <option key={a.id} value={a.id}>{a.name} (v{a.version})</option>)}
                </select>
                <button
                  type="submit"
                  disabled={installingApp || !selectedAppId}
                  className="btn btn-primary w-full flex items-center justify-center gap-1.5"
                >
                  {installingApp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Deploy Container App
                </button>
              </form>
            )}
          </div>

          {/* Running Deployments */}
          <div className="card lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Active Node Deployments</h3>
            {deviceApps.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No applications or Docker workloads running on this node.</p>
            ) : (
              <div className="space-y-2">
                {deviceApps.map(dep => {
                  const catalog = catalogApps.find(c => c.id === dep.app_id)
                  return (
                    <div key={dep.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{catalog ? catalog.name : 'Container Service'} <span className="font-mono text-[10px] text-slate-400 ml-1">v{dep.version}</span></p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">Deployment ID: {dep.id} | Service Target: {dep.app_id}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={cn('badge uppercase text-[10px]',
                          dep.status === 'running' ? 'badge-online' :
                          dep.status === 'stopped' ? 'badge-warning' : 'badge-offline'
                        )}>
                          {dep.status}
                        </span>

                        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                          <button
                            onClick={() => handleAppAction(dep.app_id, 'start')}
                            disabled={dep.status === 'running'}
                            className="btn btn-ghost p-1 text-slate-500 hover:text-green-600 disabled:opacity-30"
                            title="Start"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAppAction(dep.app_id, 'stop')}
                            disabled={dep.status === 'stopped'}
                            className="btn btn-ghost p-1 text-slate-500 hover:text-amber-600 disabled:opacity-30"
                            title="Stop"
                          >
                            <Square className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAppAction(dep.app_id, 'restart')}
                            className="btn btn-ghost p-1 text-slate-500 hover:text-sky-600"
                            title="Restart"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAppAction(dep.app_id, 'uninstall')}
                            className="btn btn-ghost p-1 text-slate-500 hover:text-red-600"
                            title="Uninstall"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Timeline History */}
      {activeTab === 'timeline' && (
        <div className="card space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Device Operations History Log</h3>
          {loadingTimeline ? (
            <p className="text-xs text-slate-400 italic">Retrieving telemetry events...</p>
          ) : timelineEvents.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No recorded events found in database.</p>
          ) : (
            <div className="space-y-4 max-h-[480px] overflow-y-auto pl-4 border-l-2 border-slate-200">
              {timelineEvents.map((evt, idx) => (
                <div key={idx} className="relative pl-4 text-xs">
                  {/* node dot */}
                  <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-sky-500 border-2 border-white ring-2 ring-sky-50" />
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-bold text-slate-800">{evt.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        Severity: <span className="text-slate-600 font-semibold">{evt.severity || 'info'}</span> | Type: <span className="text-slate-600 font-semibold">{evt.event_type}</span>
                      </p>
                      {evt.event_data && (
                        <pre className="text-[10px] font-mono text-slate-300 bg-slate-900 border border-slate-800 p-2.5 rounded-lg mt-2 overflow-x-auto">
                          {evt.event_data}
                        </pre>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold whitespace-nowrap">
                      {formatRelativeTime(evt.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, unit, warn, crit, icon, sub }: {
  label: string; value?: number; unit: string; warn: number; crit: number; icon: React.ReactNode; sub?: string
}) {
  const v = value ?? 0
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={cn('text-slate-400', value !== undefined && metricColor(v, warn, crit))}>{icon}</span>
      </div>
      <div className={cn('metric-value mb-2', value !== undefined ? metricColor(v, warn, crit) : 'text-slate-400')}>
        {value !== undefined ? `${v.toFixed(1)}` : '—'}<span className="text-xs font-normal ml-0.5 opacity-60">{unit}</span>
      </div>
      {value !== undefined && (
        <div className="progress-bar">
          <div className={cn('progress-fill', metricBarColor(v, warn, crit))} style={{ width: `${Math.min(v, 100)}%` }} />
        </div>
      )}
      {sub && <p className="text-xs text-slate-400 font-mono mt-1 font-semibold">{sub}</p>}
    </div>
  )
}

function TelemetryChart({ title, data, series }: { title: string; data: any[]; series: { key: string; color: string; label: string }[] }) {
  return (
    <div className="bento-dark text-slate-200 border border-slate-800 p-4 shadow-lg">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            {series.map(({ key, color }) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#f8fafc' }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v: any, n: any) => [`${Number(v).toFixed(1)}`, String(n)]}
          />
          {series.map(({ key, color, label }) => (
            <Area key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={1.5}
              fill={`url(#grad-${key})`} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function CommandPanel({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const [cmd, setCmd] = useState('')
  const [params, setParams] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const send = async () => {
    if (!cmd) return
    setStatus('sending')
    try {
      let parsedParams: any = {}
      if (params.trim()) parsedParams = JSON.parse(params)
      await devicesApi.command(deviceId, cmd, parsedParams)
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 2000)
    } catch { setStatus('error') }
  }

  const presets = [
    { label: 'Reboot System', cmd: 'reboot', params: '{}' },
    { label: 'Set Hostname', cmd: 'hostname', params: '{"hostname": "plc-node-01"}' },
    { label: 'Set Static IP', cmd: 'network', params: '{"interface": "eth0", "dhcp": false, "ip_address": "192.168.1.15", "netmask": "255.255.255.0", "gateway": "192.168.1.1", "dns": ["8.8.8.8"]}' },
    { label: 'Set DHCP Mode', cmd: 'network', params: '{"interface": "eth0", "dhcp": true}' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card border-sky-200 bg-sky-50/20 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Edge Remote Execution Panel</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs font-semibold">✕ Close</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((p) => (
          <button key={p.label} onClick={() => { setCmd(p.cmd); setParams(p.params) }}
            className="btn btn-secondary btn-sm font-semibold text-slate-600 border-slate-200">
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">Target Action/Command</label>
          <input value={cmd} onChange={(e) => setCmd(e.target.value)}
            className="form-input font-mono"
            placeholder="e.g. reboot" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">Payload parameters (JSON Object)</label>
          <input value={params} onChange={(e) => setParams(e.target.value)}
            className="form-input font-mono"
            placeholder='e.g. {}' />
        </div>
      </div>
      <button onClick={send} disabled={!cmd || status === 'sending'}
        className={cn('btn mt-3.5 font-bold', {
          'btn-primary': status === 'idle',
          'bg-slate-200 text-slate-400 cursor-not-allowed': status === 'sending',
          'bg-green-600 text-white': status === 'sent',
          'bg-red-600 text-white': status === 'error',
        })}>
        {status === 'idle' && 'Send Command'}
        {status === 'sending' && 'Sending Command...'}
        {status === 'sent' && '✓ Dispatched'}
        {status === 'error' && '✗ Dispatch Failed'}
      </button>
    </motion.div>
  )
}
