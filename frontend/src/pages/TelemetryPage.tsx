import { useEffect, useState } from 'react'
import { devicesApi, telemetryApi } from '@/api/client'
import { useTelemetryStore, useDeviceStore } from '@/store/store'
import { cn, metricColor } from '@/lib/utils'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Activity } from 'lucide-react'

const METRICS = [
  { key: 'cpu_percent', label: 'CPU %', color: '#0ea5e9', warn: 75, crit: 90 },
  { key: 'ram_percent', label: 'RAM %', color: '#22c55e', warn: 80, crit: 95 },
  { key: 'temperature', label: 'Temp °C', color: '#f59e0b', warn: 70, crit: 85 },
  { key: 'disk_percent', label: 'Disk %', color: '#a78bfa', warn: 80, crit: 95 },
]

export default function TelemetryPage() {
  const { devices, setDevices } = useDeviceStore()
  const { historyByDevice, setHistory } = useTelemetryStore()
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['cpu_percent', 'ram_percent']))
  const [timeRange, setTimeRange] = useState(60)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    devicesApi.list().then((r) => {
      setDevices(r.data)
      if (r.data.length > 0 && !selectedDevice) setSelectedDevice(r.data[0].device_id)
    })
  }, [])

  useEffect(() => {
    if (!selectedDevice) return
    setLoading(true)
    telemetryApi.history(selectedDevice, timeRange)
      .then((r) => { setHistory(selectedDevice, r.data) })
      .finally(() => setLoading(false))
  }, [selectedDevice, timeRange])

  const history = (selectedDevice ? historyByDevice[selectedDevice] : []) ?? []
  const chartData = history.map((t) => ({
    t: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    cpu_percent: t.cpu_percent ?? null,
    ram_percent: t.ram_percent ?? null,
    temperature: t.temperature ?? null,
    disk_percent: t.disk_percent ?? null,
    net_bytes_sent: t.net_bytes_sent ?? null,
    net_bytes_recv: t.net_bytes_recv ?? null,
  }))

  const toggleMetric = (key: string) => {
    setSelectedMetrics((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const latestRow = history[history.length - 1]
  const deviceName = devices.find(d => d.device_id === selectedDevice)?.name ?? selectedDevice

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Telemetry Explorer</h2>
          <p className="page-subtitle">Live and historical metric charts for any registered device</p>
        </div>
      </div>

      {/* Controls toolbar */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}
          className="form-select" style={{ width: 'auto', minWidth: 200 }}>
          <option value="">Select device…</option>
          {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.name}</option>)}
        </select>

        <div className="flex items-center gap-1">
          {[30, 60, 100, 200].map((n) => (
            <button key={n} onClick={() => setTimeRange(n)}
              className={cn('btn btn-sm font-mono', timeRange === n ? 'btn-primary' : 'btn-secondary')}>
              {n}pts
            </button>
          ))}
        </div>

        {/* Metric toggles */}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {METRICS.map(({ key, label, color }) => (
            <button key={key} onClick={() => toggleMetric(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                selectedMetrics.has(key)
                  ? 'text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              )}
              style={selectedMetrics.has(key) ? { background: color, borderColor: color } : {}}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Latest metric KPIs */}
      {latestRow && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {METRICS.map(({ key, label, color, warn, crit }) => {
            const val = (latestRow as any)[key]
            return (
              <div key={key} className="card">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                </div>
                <p className={cn('font-mono text-2xl font-extrabold', val !== null ? metricColor(val, warn, crit) : 'text-slate-300')}>
                  {val !== null ? val.toFixed(1) : '—'}
                </p>
                {val !== null && (
                  <div className="progress-bar mt-2">
                    <div className="progress-fill" style={{ width: `${Math.min(val, 100)}%`, background: color }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Main line chart */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100">
            <Activity className="w-4 h-4 text-sky-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">
            {selectedDevice ? `${deviceName} — Telemetry History` : 'Select a device above'}
          </h3>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
            Loading telemetry data…
          </div>
        ) : chartData.length < 2 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Activity className="w-8 h-8 opacity-30" />
            <p className="text-sm">Not enough data points yet.</p>
            <p className="text-xs">Deploy the agent on this device to start collecting telemetry.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={Math.floor(chartData.length / 8)} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#f8fafc' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: any, n: any) => [v !== null ? `${Number(v).toFixed(1)}` : '—', String(n)]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
              {METRICS.filter(({ key }) => selectedMetrics.has(key)).map(({ key, label, color }) => (
                <Line key={key} type="monotone" dataKey={key} name={label} stroke={color}
                  strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Network I/O chart */}
      {chartData.some((d) => d.net_bytes_sent !== null) && (
        <div className="card">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Network I/O (bytes/s)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="sent-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.20} /><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recv-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.20} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={Math.floor(chartData.length / 8)} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#f8fafc' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="net_bytes_sent" name="Sent" stroke="#0ea5e9" strokeWidth={1.5} fill="url(#sent-grad)" dot={false} />
              <Area type="monotone" dataKey="net_bytes_recv" name="Recv" stroke="#22c55e" strokeWidth={1.5} fill="url(#recv-grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
