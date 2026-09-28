import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Cpu, Activity, Bell, ScrollText,
  Network, Settings, Users, ChevronLeft, ChevronRight,
  Radio, LogOut, Terminal, AppWindow,
  CloudLightning, Search, HeartPulse, Building2
} from 'lucide-react'
import { useUIStore, useAuthStore, useAlertStore } from '@/store/store'
import { cn } from '@/lib/utils'

const navSections = [
  {
    label: 'Operations',
    items: [
      { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/fleet',        icon: Building2,       label: 'Fleet' },
      { to: '/devices',      icon: Cpu,             label: 'Devices' },
      { to: '/discovery',    icon: Search,          label: 'Discovery' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/commands',     icon: Terminal,        label: 'Commands' },
      { to: '/applications', icon: AppWindow,       label: 'Applications' },
      { to: '/ota',          icon: CloudLightning,  label: 'OTA Updates' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/telemetry',    icon: Activity,        label: 'Telemetry' },
      { to: '/alerts',       icon: Bell,            label: 'Alerts',   badge: true },
      { to: '/health',       icon: HeartPulse,      label: 'Health & Rules' },
      { to: '/logs',         icon: ScrollText,      label: 'Audit Logs' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/network',      icon: Network,         label: 'Network' },
      { to: '/settings',     icon: Settings,        label: 'Settings' },
      { to: '/users',        icon: Users,           label: 'Users' },
    ],
  },
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, logout } = useAuthStore()
  const { alertStats } = useAlertStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={cn('sidebar', sidebarCollapsed && 'collapsed')}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 border-b border-white/5"
           style={{ height: 'var(--topbar-h)' }}>
        <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
             style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)' }}>
          <Radio className="w-4 h-4" style={{ color: '#38bdf8' }} />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold tracking-widest uppercase"
                      style={{ color: '#38bdf8' }}>Phantomation</span>
                <span className="text-sm font-semibold text-white tracking-wide">DeviceOps</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            {/* Section label */}
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-4 pt-3 pb-1"
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: 'rgba(148,163,184,0.5)' }}>
                    {section.label}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {section.items.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 group tooltip-trigger',
                    isActive
                      ? 'text-sky-300'
                      : 'text-slate-500 hover:text-slate-200'
                  )
                }
                style={({ isActive }) => isActive ? {
                  background: 'rgba(14,165,233,0.12)',
                  color: '#7dd3fc',
                } : {}}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('w-4 h-4 flex-shrink-0 transition-colors',
                      isActive ? 'text-sky-400' : ''
                    )} />
                    <AnimatePresence>
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="whitespace-nowrap font-medium text-sm"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Active indicator bar */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full"
                        style={{ background: '#0ea5e9' }}
                      />
                    )}

                    {/* Alert badge */}
                    {badge && alertStats.total_unresolved > 0 && (
                      <span className={cn(
                        'absolute bg-red-500 text-white text-[9px] font-bold rounded-full leading-none flex items-center justify-center',
                        sidebarCollapsed ? 'top-0.5 right-0.5 w-4 h-4' : 'right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5'
                      )}>
                        {alertStats.total_unresolved > 99 ? '99+' : alertStats.total_unresolved}
                      </span>
                    )}

                    {/* Tooltip on collapsed */}
                    {sidebarCollapsed && (
                      <div className="tooltip">{label}</div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User + collapse */}
      <div className="border-t p-2 space-y-1" style={{ borderColor: 'var(--sidebar-border)' }}>
        {/* User */}
        <div className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-lg')}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs"
               style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8' }}>
            {(user?.username?.[0] ?? 'U').toUpperCase()}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.username}</p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#38bdf8' }}>{user?.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-slate-600 hover:text-red-400 transition-all text-sm"
          style={{ background: 'transparent' }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-1.5 rounded-lg transition-all text-slate-600 hover:text-slate-400"
          style={{ background: 'transparent' }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />
          }
        </button>
      </div>
    </aside>
  )
}
