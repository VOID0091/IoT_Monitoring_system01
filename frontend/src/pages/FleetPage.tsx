import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building, Plus, Trash2, MapPin, Layers, Cpu, RefreshCw, X } from 'lucide-react'
import { fleetApi, devicesApi } from '@/api/client'
import { cn } from '@/lib/utils'

export default function FleetPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [fleets, setFleets] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newOrg, setNewOrg] = useState({ name: '', description: '' })
  const [newSite, setNewSite] = useState({ org_id: '', name: '', location: '', description: '' })
  const [newFleet, setNewFleet] = useState({ site_id: '', name: '', description: '', tags: '' })
  const [assignState, setAssignState] = useState<Record<string, { org_id: string; site_id: string; fleet_id: string }>>({})
  const [fleetHealths, setFleetHealths] = useState<Record<number, any>>({})

  async function loadData() {
    try {
      setLoading(true)
      const [oRes, sRes, fRes, dRes] = await Promise.all([
        fleetApi.listOrgs(),
        fleetApi.listSites(),
        fleetApi.listFleets(),
        devicesApi.list(),
      ])
      setOrgs(oRes.data); setSites(sRes.data); setFleets(fRes.data); setDevices(dRes.data)
      const healthObj: Record<number, any> = {}
      for (const f of fRes.data) {
        try { const hRes = await fleetApi.getFleetHealth(f.id); healthObj[f.id] = hRes.data } catch {}
      }
      setFleetHealths(healthObj)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newOrg.name) return
    try { await fleetApi.createOrg(newOrg); setNewOrg({ name: '', description: '' }); loadData() }
    catch { alert('Error creating organization') }
  }
  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newSite.name || !newSite.org_id) return
    try {
      await fleetApi.createSite({ org_id: parseInt(newSite.org_id), name: newSite.name, location: newSite.location, description: newSite.description })
      setNewSite({ org_id: '', name: '', location: '', description: '' }); loadData()
    } catch { alert('Error creating site') }
  }
  const handleCreateFleet = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newFleet.name || !newFleet.site_id) return
    try {
      await fleetApi.createFleet({ site_id: parseInt(newFleet.site_id), name: newFleet.name, description: newFleet.description, tags: newFleet.tags ? newFleet.tags.split(',').map(t => t.trim()) : [] })
      setNewFleet({ site_id: '', name: '', description: '', tags: '' }); loadData()
    } catch { alert('Error creating fleet') }
  }

  const handleAssignChange = (deviceId: string, key: 'org_id' | 'site_id' | 'fleet_id', val: string) => {
    setAssignState(prev => {
      const current = prev[deviceId] ?? { org_id: '', site_id: '', fleet_id: '' }
      const updated = { ...current, [key]: val }
      if (key === 'org_id') { updated.site_id = ''; updated.fleet_id = '' }
      else if (key === 'site_id') { updated.fleet_id = '' }
      return { ...prev, [deviceId]: updated }
    })
  }
  const handleAssignDevice = async (deviceId: string) => {
    const state = assignState[deviceId]; if (!state) return
    try {
      await fleetApi.assignDevice(deviceId, { org_id: state.org_id ? parseInt(state.org_id) : undefined, site_id: state.site_id ? parseInt(state.site_id) : undefined, fleet_id: state.fleet_id ? parseInt(state.fleet_id) : undefined })
      loadData()
    } catch { alert('Error assigning device') }
  }

  const scoreColor = (s: number) => s >= 80 ? 'text-green-600 bg-green-50 border-green-200' : s >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200'

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-80 card animate-pulse bg-slate-100" />)}
      </div>
    </div>
  )

  const inputCls = 'form-input text-xs py-1.5'
  const selectCls = 'form-select text-xs py-1.5'

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Fleet Architecture</h2>
          <p className="page-subtitle">Manage Organizations → Sites → Fleets and assign devices to your hierarchy</p>
        </div>
        <button onClick={loadData} className="btn btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Organizations', value: orgs.length, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
          { label: 'Sites', value: sites.length, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Fleets', value: fleets.length, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('card text-center border', bg)}>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{label}</p>
            <p className={cn('font-mono text-2xl font-extrabold', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Three column hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Organizations */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100"><Building className="w-4 h-4 text-sky-600" /></div>
            <h3 className="text-sm font-bold text-slate-700">Organizations</h3>
            <span className="badge badge-info ml-auto">{orgs.length}</span>
          </div>
          <form onSubmit={handleCreateOrg} className="space-y-2">
            <input placeholder="Organization name *" value={newOrg.name} onChange={e => setNewOrg(p => ({ ...p, name: e.target.value }))} className={inputCls} required />
            <input placeholder="Description" value={newOrg.description} onChange={e => setNewOrg(p => ({ ...p, description: e.target.value }))} className={inputCls} />
            <button className="btn btn-primary btn-sm w-full"><Plus className="w-3.5 h-3.5" /> Add Organization</button>
          </form>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {orgs.length === 0 && <p className="text-xs text-slate-400 text-center py-4 italic">No organizations yet</p>}
            {orgs.map(org => (
              <div key={org.id} className="flex items-start justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-all">
                <div>
                  <p className="text-xs font-bold text-slate-700">{org.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{org.description || 'No description'}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1">{org.site_count ?? 0} sites</p>
                </div>
                <button onClick={() => { if(confirm('Delete this organization?')) fleetApi.deleteOrg(org.id).then(loadData) }}
                  className="btn btn-ghost btn-sm p-1 text-slate-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sites */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-100"><MapPin className="w-4 h-4 text-emerald-600" /></div>
            <h3 className="text-sm font-bold text-slate-700">Sites</h3>
            <span className="badge badge-success ml-auto">{sites.length}</span>
          </div>
          <form onSubmit={handleCreateSite} className="space-y-2">
            <select value={newSite.org_id} onChange={e => setNewSite(p => ({ ...p, org_id: e.target.value }))} className={selectCls} required>
              <option value="">Select Organization *</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <input placeholder="Site name *" value={newSite.name} onChange={e => setNewSite(p => ({ ...p, name: e.target.value }))} className={inputCls} required />
            <input placeholder="Location (e.g. London, UK)" value={newSite.location} onChange={e => setNewSite(p => ({ ...p, location: e.target.value }))} className={inputCls} />
            <button className="btn btn-sm w-full" style={{ background: '#059669', color: 'white', borderColor: '#047857' }}><Plus className="w-3.5 h-3.5" /> Add Site</button>
          </form>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {sites.length === 0 && <p className="text-xs text-slate-400 text-center py-4 italic">No sites yet</p>}
            {sites.map(site => {
              const org = orgs.find(o => o.id === site.org_id)
              return (
                <div key={site.id} className="flex items-start justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-all">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-700">{site.name}</p>
                      {site.location && <span className="badge badge-success text-[9px]">{site.location}</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{org ? `${org.name}` : 'No Organization'}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">{site.fleet_count ?? 0} fleets</p>
                  </div>
                  <button onClick={() => { if(confirm('Delete site?')) fleetApi.deleteSite(site.id).then(loadData) }}
                    className="btn btn-ghost btn-sm p-1 text-slate-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Fleets */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-100"><Layers className="w-4 h-4 text-amber-600" /></div>
            <h3 className="text-sm font-bold text-slate-700">Fleets</h3>
            <span className="badge badge-warning ml-auto">{fleets.length}</span>
          </div>
          <form onSubmit={handleCreateFleet} className="space-y-2">
            <select value={newFleet.site_id} onChange={e => setNewFleet(p => ({ ...p, site_id: e.target.value }))} className={selectCls} required>
              <option value="">Select Site *</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="Fleet name *" value={newFleet.name} onChange={e => setNewFleet(p => ({ ...p, name: e.target.value }))} className={inputCls} required />
            <input placeholder="Tags (comma separated)" value={newFleet.tags} onChange={e => setNewFleet(p => ({ ...p, tags: e.target.value }))} className={inputCls} />
            <button className="btn btn-sm w-full" style={{ background: '#d97706', color: 'white', borderColor: '#b45309' }}><Plus className="w-3.5 h-3.5" /> Add Fleet</button>
          </form>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {fleets.length === 0 && <p className="text-xs text-slate-400 text-center py-4 italic">No fleets yet</p>}
            {fleets.map(fleet => {
              const site = sites.find(s => s.id === fleet.site_id)
              const health = fleetHealths[fleet.id]
              return (
                <div key={fleet.id} className="flex items-start justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-all">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700">{fleet.name}</p>
                    <p className="text-[10px] text-slate-400">{site ? site.name : 'No Site'}</p>
                    {fleet.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {fleet.tags.map((t: string) => <span key={t} className="chip">{t}</span>)}
                      </div>
                    )}
                    {health && (
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border', scoreColor(health.health_score))}>
                        {health.health_score}% · {health.online_count}/{health.device_count} online
                      </span>
                    )}
                  </div>
                  <button onClick={() => { if(confirm('Delete fleet?')) fleetApi.deleteFleet(fleet.id).then(loadData) }}
                    className="btn btn-ghost btn-sm p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Device Assignment Table */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200"><Cpu className="w-4 h-4 text-slate-500" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Device Assignments</h3>
            <p className="text-[11px] text-slate-400">Assign edge nodes to your fleet hierarchy</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Current Assignment</th>
                <th>Organization</th>
                <th>Site</th>
                <th>Fleet</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(device => {
                const devAssign = assignState[device.device_id] ?? { org_id: '', site_id: '', fleet_id: '' }
                const currOrg = orgs.find(o => o.id === device.org_id)
                const currSite = sites.find(s => s.id === device.site_id)
                const currFleet = fleets.find(f => f.id === device.fleet_id)
                const activeSites = sites.filter(s => s.org_id === parseInt(devAssign.org_id))
                const activeFleets = fleets.filter(f => f.site_id === parseInt(devAssign.site_id))

                return (
                  <tr key={device.device_id}>
                    <td>
                      <p className="font-bold text-slate-700">{device.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{device.device_id}</p>
                    </td>
                    <td className="text-xs text-slate-500">
                      {currOrg ? (
                        <div className="space-y-0.5">
                          <p><span className="text-slate-400">Org:</span> {currOrg.name}</p>
                          {currSite && <p><span className="text-slate-400">Site:</span> {currSite.name}</p>}
                          {currFleet && <p><span className="text-slate-400">Fleet:</span> {currFleet.name}</p>}
                        </div>
                      ) : <span className="italic text-slate-400">Unassigned</span>}
                    </td>
                    <td>
                      <select value={devAssign.org_id} onChange={e => handleAssignChange(device.device_id, 'org_id', e.target.value)} className="form-select text-xs py-1">
                        <option value="">Select Org</option>
                        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={devAssign.site_id} disabled={!devAssign.org_id} onChange={e => handleAssignChange(device.device_id, 'site_id', e.target.value)} className="form-select text-xs py-1 disabled:opacity-40">
                        <option value="">Select Site</option>
                        {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={devAssign.fleet_id} disabled={!devAssign.site_id} onChange={e => handleAssignChange(device.device_id, 'fleet_id', e.target.value)} className="form-select text-xs py-1 disabled:opacity-40">
                        <option value="">Select Fleet</option>
                        {activeFleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </td>
                    <td className="text-right">
                      <button onClick={() => handleAssignDevice(device.device_id)} disabled={!devAssign.org_id} className="btn btn-primary btn-sm disabled:opacity-40">
                        Assign
                      </button>
                    </td>
                  </tr>
                )
              })}
              {devices.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 italic text-xs">No devices registered yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
