import { useEffect, useState } from 'react'
import { AppWindow, Plus, Trash2, Cpu, Play, Square, RotateCcw, AlertTriangle, Download, Loader2, RefreshCw } from 'lucide-react'
import { appsApi, devicesApi } from '@/api/client'
import { cn, formatRelativeTime } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  installed:  'badge-info',
  installing: 'badge-pending',
  running:    'badge-online',
  stopped:    'badge-warning',
  failed:     'badge-critical',
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [deviceDeployments, setDeviceDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDeployments, setLoadingDeployments] = useState(false)
  const [newApp, setNewApp] = useState({ name: '', version: '1.0.0', description: '', install_command: '', uninstall_command: '', start_command: '', stop_command: '' })
  const [installAppId, setInstallAppId] = useState<string>('')
  const [submittingApp, setSubmittingApp] = useState(false)
  const [submittingInstall, setSubmittingInstall] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const [appRes, devRes] = await Promise.all([appsApi.list(), devicesApi.list()])
      setApps(appRes.data); setDevices(devRes.data)
      if (devRes.data.length > 0 && !selectedDevice) setSelectedDevice(devRes.data[0].device_id)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadDeviceApps(deviceId: string) {
    if (!deviceId) return
    try { setLoadingDeployments(true); const r = await appsApi.deviceApps(deviceId); setDeviceDeployments(r.data) }
    catch (e) { console.error(e) } finally { setLoadingDeployments(false) }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedDevice) loadDeviceApps(selectedDevice) }, [selectedDevice])

  const handleRegisterApp = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newApp.name || !newApp.version) return
    setSubmittingApp(true)
    try {
      await appsApi.create(newApp)
      setNewApp({ name: '', version: '1.0.0', description: '', install_command: '', uninstall_command: '', start_command: '', stop_command: '' })
      loadData()
    } catch { alert('Error registering application') } finally { setSubmittingApp(false) }
  }

  const handleDeleteApp = async (appId: number) => {
    if (!confirm('Delete this application from registry?')) return
    try { await appsApi.delete(appId); loadData() } catch { alert('Error deleting application') }
  }

  const handleInstallApp = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedDevice || !installAppId) return
    setSubmittingInstall(true)
    try { await appsApi.install(selectedDevice, parseInt(installAppId)); setInstallAppId(''); loadDeviceApps(selectedDevice) }
    catch { alert('Error installing application') } finally { setSubmittingInstall(false) }
  }

  const handleAction = async (appId: number, action: string) => {
    if (!selectedDevice) return
    try { await appsApi.action(selectedDevice, appId, action); setTimeout(() => loadDeviceApps(selectedDevice), 1000) }
    catch { alert(`Error performing '${action}'`) }
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-80 card animate-pulse bg-slate-100" />
        <div className="lg:col-span-2 h-80 card animate-pulse bg-slate-100" />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Application Center</h2>
          <p className="page-subtitle">Deploy, manage and control edge application lifecycles across registered devices</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-info">{apps.length} apps in registry</span>
          <button onClick={loadData} className="btn btn-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* App Registry panel */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100"><Plus className="w-4 h-4 text-sky-600" /></div>
            <h3 className="text-sm font-bold text-slate-700">Register Application</h3>
          </div>

          <form onSubmit={handleRegisterApp} className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="App name *" value={newApp.name} onChange={e => setNewApp(p => ({ ...p, name: e.target.value }))} className="form-input text-xs py-1.5 col-span-2" required />
              <input placeholder="1.0.0" value={newApp.version} onChange={e => setNewApp(p => ({ ...p, version: e.target.value }))} className="form-input text-xs py-1.5" />
            </div>
            <input placeholder="Description" value={newApp.description} onChange={e => setNewApp(p => ({ ...p, description: e.target.value }))} className="form-input text-xs py-1.5" />
            <input placeholder="Install command" value={newApp.install_command} onChange={e => setNewApp(p => ({ ...p, install_command: e.target.value }))} className="form-input text-xs py-1.5 font-mono" />
            <input placeholder="Start command" value={newApp.start_command} onChange={e => setNewApp(p => ({ ...p, start_command: e.target.value }))} className="form-input text-xs py-1.5 font-mono" />
            <input placeholder="Stop command" value={newApp.stop_command} onChange={e => setNewApp(p => ({ ...p, stop_command: e.target.value }))} className="form-input text-xs py-1.5 font-mono" />
            <button type="submit" disabled={submittingApp || !newApp.name} className="btn btn-primary btn-sm w-full">
              {submittingApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add to Registry
            </button>
          </form>

          {/* Catalog list */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Registry Catalog ({apps.length})</p>
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {apps.length === 0
                ? <p className="text-xs text-slate-400 text-center py-4 italic">No applications registered yet</p>
                : apps.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-all">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{app.name} <span className="font-mono font-normal text-[10px] text-slate-400">v{app.version}</span></p>
                      {app.start_command && <p className="text-[9px] font-mono text-slate-400 truncate max-w-[150px]">{app.start_command}</p>}
                    </div>
                    <button onClick={() => handleDeleteApp(app.id)} className="btn btn-ghost btn-sm p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Device App Manager */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200"><Cpu className="w-4 h-4 text-slate-500" /></div>
              <h3 className="text-sm font-bold text-slate-700">Device Application Manager</h3>
            </div>
            <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} className="form-select text-xs" style={{ width: 'auto', minWidth: 180 }}>
              <option value="">Select Device</option>
              {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.name}</option>)}
            </select>
          </div>

          {/* Quick install */}
          {selectedDevice && apps.length > 0 && (
            <form onSubmit={handleInstallApp} className="flex items-end gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Install from Catalog</label>
                <select value={installAppId} onChange={e => setInstallAppId(e.target.value)} className="form-select text-xs">
                  <option value="">Choose application…</option>
                  {apps.map(a => <option key={a.id} value={a.id}>{a.name} (v{a.version})</option>)}
                </select>
              </div>
              <button type="submit" disabled={submittingInstall || !installAppId} className="btn btn-primary btn-sm flex-shrink-0">
                {submittingInstall ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Install
              </button>
            </form>
          )}

          {/* Installed apps */}
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Installed Lifecycles</p>
            {loadingDeployments ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : deviceDeployments.length === 0 ? (
              <div className="empty-state py-10 border border-dashed border-slate-200 rounded-xl">
                <AppWindow className="w-7 h-7 text-slate-300" />
                <p className="text-slate-400 font-semibold text-sm">No applications installed</p>
                <p className="text-xs text-slate-400">Use the install form above to deploy apps to this device.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {deviceDeployments.map(dep => {
                  const catalogApp = apps.find(a => a.id === dep.app_id)
                  return (
                    <div key={dep.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-700 text-sm">{catalogApp?.name ?? 'Unknown App'}</p>
                          <span className="font-mono text-[10px] text-slate-400">v{dep.version}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">ID: {dep.id} · App: {dep.app_id}</p>
                        {dep.error && <p className="text-[10px] text-red-600 font-mono"><span className="font-bold">Error:</span> {dep.error}</p>}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={cn('badge uppercase', STATUS_BADGE[dep.status] ?? 'badge-offline')}>
                          {dep.status === 'installing' && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
                          {dep.status}
                        </span>
                        <div className="flex items-center gap-0.5 border-l border-slate-100 pl-2">
                          <button onClick={() => handleAction(dep.app_id, 'start')} disabled={dep.status === 'running' || dep.status === 'installing'}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 disabled:opacity-30 transition-all" title="Start">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAction(dep.app_id, 'stop')} disabled={dep.status === 'stopped' || dep.status === 'installing'}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 disabled:opacity-30 transition-all" title="Stop">
                            <Square className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAction(dep.app_id, 'restart')} disabled={dep.status === 'installing'}
                            className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 hover:text-sky-600 disabled:opacity-30 transition-all" title="Restart">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAction(dep.app_id, 'uninstall')} disabled={dep.status === 'installing'}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-all" title="Uninstall">
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
      </div>
    </div>
  )
}
