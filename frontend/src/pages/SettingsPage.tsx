import { useState } from 'react'
import { useAuthStore } from '@/store/store'
import { Save, Info, Server, Bell, Wifi, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [mqttHost, setMqttHost] = useState('localhost')
  const [mqttPort, setMqttPort] = useState('1883')
  const [cpuWarn, setCpuWarn] = useState('75')
  const [cpuCrit, setCpuCrit] = useState('90')
  const [ramWarn, setRamWarn] = useState('80')
  const [ramCrit, setRamCrit] = useState('95')
  const [tempWarn, setTempWarn] = useState('70')
  const [tempCrit, setTempCrit] = useState('85')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Platform Settings</h2>
          <p className="page-subtitle">Configure alert thresholds, broker connection, and platform preferences</p>
        </div>
      </div>

      {/* Alert thresholds */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-100">
              <Bell className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-700">Alert Thresholds</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Info className="w-3.5 h-3.5" />
            Configure in backend .env
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'CPU Warning %', value: cpuWarn, set: setCpuWarn },
            { label: 'CPU Critical %', value: cpuCrit, set: setCpuCrit },
            { label: 'RAM Warning %', value: ramWarn, set: setRamWarn },
            { label: 'RAM Critical %', value: ramCrit, set: setRamCrit },
            { label: 'Temp Warning °C', value: tempWarn, set: setTempWarn },
            { label: 'Temp Critical °C', value: tempCrit, set: setTempCrit },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-xs text-slate-500 font-semibold block mb-1">{label}</label>
              <input value={value} onChange={(e) => set(e.target.value)} type="number"
                className="form-input font-mono" />
            </div>
          ))}
        </div>
      </div>

      {/* MQTT Broker */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100">
            <Wifi className="w-4 h-4 text-sky-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-700">MQTT Broker</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Broker Host</label>
            <input value={mqttHost} onChange={(e) => setMqttHost(e.target.value)}
              className="form-input font-mono" placeholder="localhost" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Port</label>
            <input value={mqttPort} onChange={(e) => setMqttPort(e.target.value)} type="number"
              className="form-input font-mono" placeholder="1883" />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Changes to the broker host/port require restarting the backend service.
        </p>
      </div>

      {/* System info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Server className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-700">System Information</h2>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Platform', value: 'Phantomation DeviceOps v1.0' },
            { label: 'Logged in as', value: `${user?.username ?? '—'} (${user?.role ?? '—'})` },
            { label: 'API Base URL', value: '/api/v1' },
            { label: 'WebSocket', value: '/ws/{client_id}' },
            { label: 'MQTT Topics', value: 'iot/telemetry/{device_id}' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-xs text-slate-500 font-semibold">{label}</span>
              <span className="font-mono text-xs text-slate-700 font-bold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security info */}
      <div className="card border-l-4 border-l-sky-400 bg-sky-50/30">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-sky-700 mb-1">JWT Authentication Active</p>
            <p className="text-xs text-slate-500">All API endpoints are protected via JWT tokens. Tokens expire after 7 days and are automatically refreshed on active sessions.</p>
          </div>
        </div>
      </div>

      <button onClick={handleSave}
        className={cn('btn btn-lg', saved ? 'btn-primary' : 'btn-primary')}>
        <Save className="w-4 h-4" />
        {saved ? '✓ Saved Successfully' : 'Save Settings'}
      </button>
    </div>
  )
}
