import { useEffect, useState } from 'react'
import { CloudLightning, Upload, Plus, Cpu, RefreshCw, Loader2, CheckCircle2, AlertTriangle, PackageOpen } from 'lucide-react'
import { otaApi, devicesApi } from '@/api/client'
import { cn, formatRelativeTime } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  pending:     'badge-offline',
  downloading: 'badge-info',
  flashing:    'badge-warning',
  success:     'badge-success',
  failed:      'badge-critical',
  rolled_back: 'badge-offline',
}

export default function OtaPage() {
  const [packages, setPackages] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadName, setUploadName] = useState('')
  const [uploadVer, setUploadVer] = useState('1.0.0')
  const [notes, setNotes] = useState('')
  const [platform, setPlatform] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedPkgId, setSelectedPkgId] = useState<string>('')
  const [targetDevices, setTargetDevices] = useState<string[]>([])
  const [deploying, setDeploying] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const [pkgRes, devRes, depRes] = await Promise.all([otaApi.listPackages(), devicesApi.list(), otaApi.listDeployments()])
      setPackages(pkgRes.data); setDevices(devRes.data); setDeployments(depRes.data)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(async () => {
      try { const d = await otaApi.listDeployments(); setDeployments(d.data) } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!uploadName || !selectedFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('name', uploadName); fd.append('version', uploadVer)
      fd.append('release_notes', notes); fd.append('target_platform', platform)
      fd.append('file', selectedFile)
      await otaApi.uploadPackage(fd)
      setUploadName(''); setUploadVer('1.0.0'); setNotes(''); setPlatform(''); setSelectedFile(null)
      loadData()
    } catch { alert('Error uploading package') } finally { setUploading(false) }
  }

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedPkgId || targetDevices.length === 0) return
    setDeploying(true)
    try {
      await otaApi.createDeployment({ package_id: parseInt(selectedPkgId), device_ids: targetDevices })
      setSelectedPkgId(''); setTargetDevices([]); loadData()
    } catch { alert('Error initiating OTA deployment') } finally { setDeploying(false) }
  }

  const toggleDevice = (id: string) =>
    setTargetDevices(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])

  const handleRollback = async (depId: number) => {
    if (!confirm('Rollback this deployment?')) return
    try { await otaApi.rollback(depId); loadData() } catch { alert('Error rolling back') }
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="h-12 card animate-pulse bg-slate-100" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-80 card animate-pulse bg-slate-100" />
        <div className="lg:col-span-2 h-80 card animate-pulse bg-slate-100" />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">OTA Update Center</h2>
          <p className="page-subtitle">Manage firmware packages, staged rollouts, and deployment tracking across the fleet</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-info">{packages.length} packages</span>
          <span className="badge badge-warning">{deployments.filter(d => d.status === 'flashing' || d.status === 'downloading').length} active</span>
          <button onClick={loadData} className="btn btn-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upload panel */}
        <div className="card space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100"><Upload className="w-4 h-4 text-sky-600" /></div>
            <h3 className="text-sm font-bold text-slate-700">Upload Package</h3>
          </div>

          <form onSubmit={handleUpload} className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="Package name *" value={uploadName} onChange={e => setUploadName(e.target.value)} className="form-input text-xs py-1.5 col-span-2" required />
              <input placeholder="1.0.0" value={uploadVer} onChange={e => setUploadVer(e.target.value)} className="form-input text-xs py-1.5" />
            </div>
            <input placeholder="Target platform (x86_64, arm64)" value={platform} onChange={e => setPlatform(e.target.value)} className="form-input text-xs py-1.5" />
            <textarea placeholder="Release notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="form-input text-xs py-1.5" />
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center">
              <input type="file" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} className="text-xs text-slate-500 w-full" />
              {selectedFile && <p className="text-xs text-green-600 font-semibold mt-1">✓ {selectedFile.name}</p>}
            </div>
            <button type="submit" disabled={uploading || !uploadName || !selectedFile} className="btn btn-primary btn-sm w-full">
              {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Plus className="w-3.5 h-3.5" /> Upload Package</>}
            </button>
          </form>

          {/* Package catalog */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Package Repository ({packages.length})</p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {packages.length === 0
                ? <p className="text-xs text-slate-400 text-center py-4 italic">No packages uploaded yet</p>
                : packages.map(pkg => (
                  <div key={pkg.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-slate-700">{pkg.name} <span className="font-mono font-normal text-[10px] text-slate-400">v{pkg.version}</span></p>
                      {pkg.target_platform && <span className="chip">{pkg.target_platform}</span>}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 truncate">SHA256: {pkg.checksum ?? '—'}</p>
                    <p className="text-[10px] text-slate-400">{pkg.file_size ? `${(pkg.file_size / (1024 * 1024)).toFixed(2)} MB` : ''}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Deploy panel */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-100"><CloudLightning className="w-4 h-4 text-amber-600" /></div>
            <h3 className="text-sm font-bold text-slate-700">Create Deployment</h3>
          </div>

          <form onSubmit={handleDeploy} className="space-y-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Select Package</label>
                <select value={selectedPkgId} onChange={e => setSelectedPkgId(e.target.value)} className="form-select text-xs">
                  <option value="">Choose OTA Package…</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name} v{p.version} — {p.target_platform || 'All'}</option>)}
                </select>
              </div>
              <button type="submit" disabled={deploying || !selectedPkgId || targetDevices.length === 0} className="btn btn-primary">
                {deploying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deploying…</> : <><CloudLightning className="w-3.5 h-3.5" /> Deploy to {targetDevices.length || '—'} Devices</>}
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Target Devices</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-white">
                {devices.map(device => {
                  const active = targetDevices.includes(device.device_id)
                  return (
                    <button key={device.device_id} type="button" onClick={() => toggleDevice(device.device_id)}
                      className={cn('flex items-center gap-1.5 p-2 rounded-lg text-left text-[11px] border transition-all',
                        active ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300')}>
                      <Cpu className="w-3 h-3 flex-shrink-0" />
                      <div className="truncate">
                        <p className="truncate font-semibold">{device.name}</p>
                        <p className="text-[9px] text-slate-400 truncate font-normal">{device.device_id}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </form>

          {/* Deployment status table */}
          <div>
            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Live Rollout Status</h4>
            {deployments.length === 0 ? (
              <div className="empty-state py-10 border border-dashed border-slate-200 rounded-xl">
                <PackageOpen className="w-7 h-7 text-slate-300" />
                <p className="text-slate-400 font-semibold text-sm">No deployments yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Pkg ID</th>
                      <th>Device</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployments.map(dep => (
                      <tr key={dep.id}>
                        <td className="font-mono text-[10px] text-slate-400 whitespace-nowrap">{formatRelativeTime(dep.created_at)}</td>
                        <td className="font-bold text-slate-600">#{dep.package_id}</td>
                        <td className="font-mono text-[11px] text-slate-500">{dep.device_id}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="progress-bar w-16"><div className="progress-fill bg-sky-500" style={{ width: `${dep.progress}%` }} /></div>
                            <span className="font-mono text-[10px] text-slate-400">{dep.progress}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className={cn('badge uppercase', STATUS_BADGE[dep.status] ?? 'badge-offline')}>{dep.status}</span>
                        </td>
                        <td className="text-right">
                          {dep.status !== 'rolled_back' && dep.status !== 'failed' && (
                            <button onClick={() => handleRollback(dep.id)} className="btn btn-danger btn-sm py-1 px-2 text-[10px]">Rollback</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
