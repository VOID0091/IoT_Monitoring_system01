import { useLocation } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { useDeviceStore, useAlertStore } from '@/store/store'
import { cn } from '@/lib/utils'
import React from 'react'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/fleet': 'Fleet Management',
  '/devices': 'Devices',
  '/commands': 'Command Execution',
  '/applications': 'Application Deployments',
  '/ota': 'OTA Update Manager',
  '/health': 'Health & Rule Engine',
  '/discovery': 'Device Discovery',
  '/telemetry': 'Telemetry Explorer',
  '/alerts': 'Active Alerts',
  '/logs': 'Audit Logs',
  '/network': 'Network Settings',
  '/settings': 'Platform Settings',
  '/users': 'User Management',
}

interface TopBarProps {
  wsConnected?: boolean
}

export default function TopBar({ wsConnected = true }: TopBarProps) {
  const { devices } = useDeviceStore()
  const { alertStats } = useAlertStore()
  const location = useLocation()

  // Find page title, fallback to checking dynamic route prefixes
  let title = pageTitles[location.pathname]
  if (!title) {
    if (location.pathname.startsWith('/devices/')) {
      title = 'Device Details'
    } else {
      title = 'Phantomation DeviceOps'
    }
  }

  const onlineCount = devices.filter((d) => d.status === 'online').length
  const totalCount = devices.length

  return (
    <header className="topbar gap-4 flex items-center justify-between px-6 border-b border-[#e2e8f0]" style={{ background: '#ffffff' }}>
      {/* Page title */}
      <h1 className="text-base font-bold text-slate-800 tracking-tight flex-1">{title}</h1>

      {/* Status strip */}
      <div className="flex items-center gap-5 text-xs font-medium">
        {/* Device count */}
        <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
          <span className="status-dot online" />
          <span className="font-mono font-semibold text-slate-800">{onlineCount}/{totalCount}</span>
          <span className="text-slate-500">devices</span>
        </div>

        {/* Active alerts */}
        {alertStats.total_unresolved > 0 && (
          <div className={cn(
            'flex items-center gap-1.5 font-mono px-2.5 py-1 rounded-md',
            alertStats.critical > 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
          )}>
            <span className={cn('status-dot', alertStats.critical > 0 ? 'critical' : 'warning')} />
            <span className="font-bold">{alertStats.total_unresolved} alert{alertStats.total_unresolved !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* WS status */}
        <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md', wsConnected ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500')}>
          {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline font-semibold">{wsConnected ? 'Connected' : 'Offline'}</span>
        </div>

        {/* Time */}
        <LiveClock />
      </div>
    </header>
  )
}

function LiveClock() {
  const [time, setTime] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="font-mono text-slate-500 hidden md:block bg-slate-100 px-2.5 py-1 rounded-md font-semibold">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}
