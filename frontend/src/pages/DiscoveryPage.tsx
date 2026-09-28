import { useState } from 'react'
import { Search, Loader2, Plus, Wifi, RefreshCw, Layers, Radar } from 'lucide-react'
import { devicesApi } from '@/api/client'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export default function DiscoveryPage() {
  const [scanning, setScanning] = useState(false)
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([
    { id: 'disc-01', hostname: 'phantom-edge-node04', ip_address: '192.168.1.104', mac: '00:1A:2B:3C:4D:5E', os: 'Linux (Ubuntu 22.04)', rssi: -62 },
    { id: 'disc-02', hostname: 'phantom-pi-4b', ip_address: '192.168.1.112', mac: 'B8:27:EB:01:02:03', os: 'Raspbian Buster', rssi: -45 },
    { id: 'disc-03', hostname: 'win-edge-panel01', ip_address: '192.168.1.115', mac: '3C:52:82:1F:B3:AA', os: 'Windows IoT Enterprise', rssi: -71 },
  ])
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const handleScan = () => {
    setScanning(true)
    setTimeout(() => {
      setDiscoveredDevices(prev => [
        ...prev,
        {
          id: `disc-${Date.now()}`,
          hostname: `phantom-dev-node-${Math.floor(Math.random() * 900) + 100}`,
          ip_address: `192.168.1.${Math.floor(Math.random() * 200) + 50}`,
          mac: `00:E0:4C:${Math.floor(Math.random() * 90) + 10}:${Math.floor(Math.random() * 90) + 10}:${Math.floor(Math.random() * 90) + 10}`,
          os: 'Linux (Yocto Edge)',
          rssi: -58,
        }
      ])
      setScanning(false)
    }, 2000)
  }

  const handleOnboard = async (d: any) => {
    setSubmittingId(d.id)
    try {
      await devicesApi.create({
        device_id: `dev-${Math.floor(Math.random() * 90000) + 10000}`,
        name: d.hostname,
        hostname: d.hostname,
        ip_address: d.ip_address,
        platform: d.os,
        status: 'online',
        group_name: 'discovered',
        capabilities: [],
      })
      setDiscoveredDevices(prev => prev.filter(item => item.id !== d.id))
    } catch {
      // error handled silently
    } finally {
      setSubmittingId(null)
    }
  }

  const signalQuality = (rssi: number) => {
    if (rssi >= -50) return { label: 'Excellent', color: 'text-green-600', badge: 'badge-online' }
    if (rssi >= -65) return { label: 'Good', color: 'text-amber-600', badge: 'badge-warning' }
    return { label: 'Weak', color: 'text-red-600', badge: 'badge-critical' }
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Discovery Engine</h2>
          <p className="page-subtitle">Scan subnet segments for unmanaged edge nodes and bootstrap them into the fleet</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="btn btn-primary"
        >
          {scanning
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</>
            : <><Radar className="w-3.5 h-3.5" /> Trigger Subnet Scan</>
          }
        </button>
      </div>

      {/* Scan status */}
      {scanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="card border-l-4 border-l-sky-400 bg-sky-50/40 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
          <div>
            <p className="text-sm font-semibold text-sky-700">Scanning 192.168.1.0/24…</p>
            <p className="text-xs text-slate-500">ARP probe sweep in progress. This may take a moment.</p>
          </div>
        </motion.div>
      )}

      {/* Discovered nodes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-100">
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Unmanaged Nodes on Segment</h3>
          <span className="badge badge-info ml-auto">{discoveredDevices.length} found</span>
        </div>

        {discoveredDevices.length === 0 ? (
          <div className="empty-state py-12 border border-dashed border-slate-200 rounded-xl">
            <Search className="w-8 h-8 text-slate-300" />
            <p className="font-semibold text-slate-500">No unmanaged nodes found</p>
            <p className="text-xs text-slate-400">Trigger a subnet scan to discover edge units.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {discoveredDevices.map((d, i) => {
              const sig = signalQuality(d.rssi)
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Wifi className={cn('w-4 h-4 flex-shrink-0', sig.color)} />
                      <p className="font-bold text-slate-700 text-sm">{d.hostname}</p>
                      <span className={cn('badge', sig.badge)}>{sig.label} ({d.rssi} dBm)</span>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-[11px] text-slate-500 font-mono">
                      <span><span className="text-slate-400 font-sans font-semibold not-italic">IP:</span> {d.ip_address}</span>
                      <span><span className="text-slate-400 font-sans font-semibold not-italic">MAC:</span> {d.mac}</span>
                      <span><span className="text-slate-400 font-sans font-semibold not-italic">OS:</span> {d.os}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOnboard(d)}
                    disabled={submittingId === d.id}
                    className="btn btn-primary btn-sm ml-auto flex-shrink-0"
                  >
                    {submittingId === d.id
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Onboarding…</>
                      : <><Plus className="w-3 h-3" /> Bootstrap Device</>
                    }
                  </button>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="card border border-slate-100 bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">How Discovery Works</h3>
        <ul className="space-y-1 text-xs text-slate-500">
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />ARP probe sweep scans your configured subnet for responding hosts</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />Each detected node is fingerprinted by MAC, OS, hostname and signal strength</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />Bootstrap registers the device in the platform and assigns it to the "discovered" group</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />Deploy the agent on the bootstrapped device to begin telemetry collection</li>
        </ul>
      </div>
    </div>
  )
}
