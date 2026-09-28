import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────

export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'operator' | 'viewer'
  is_active: boolean
  created_at: string
  last_login?: string
}

export interface Device {
  id: number
  device_id: string
  name: string
  hostname?: string
  ip_address?: string
  mac_address?: string
  platform?: string
  os_version?: string
  agent_version?: string
  status: 'online' | 'offline' | 'warning' | 'critical' | 'maintenance'
  group_name?: string
  location?: string
  description?: string
  last_seen?: string
  created_at: string
  capabilities: Array<{ capability: string; value?: string }>
}

export interface Telemetry {
  id: number
  device_id: string
  cpu_percent?: number
  ram_percent?: number
  ram_used_mb?: number
  ram_total_mb?: number
  disk_percent?: number
  disk_used_gb?: number
  disk_total_gb?: number
  temperature?: number
  uptime_seconds?: number
  net_bytes_sent?: number
  net_bytes_recv?: number
  timestamp: string
}

export interface Alert {
  id: number
  device_id: string
  severity: 'info' | 'warning' | 'critical'
  category: string
  message: string
  acknowledged: boolean
  resolved: boolean
  created_at: string
  resolved_at?: string
}

export interface AuditLog {
  id: number
  user_id?: number
  username?: string
  action: string
  resource?: string
  resource_id?: string
  details?: string
  ip_address?: string
  timestamp: string
}

// ─── Auth Store ───────────────────────────────────────────

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false })
      },
    }),
    { name: 'auth-store', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
)

// ─── Theme Store ──────────────────────────────────────────

interface ThemeState {
  theme: 'dark' | 'light'
  toggleTheme: () => void
  setTheme: (t: 'dark' | 'light') => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'theme-store' }
  )
)

// ─── Device Store ─────────────────────────────────────────

interface DeviceState {
  devices: Device[]
  selectedDeviceId: string | null
  setDevices: (devices: Device[]) => void
  upsertDevice: (device: Device) => void
  updateDeviceStatus: (deviceId: string, status: Device['status']) => void
  setSelectedDevice: (id: string | null) => void
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  devices: [],
  selectedDeviceId: null,
  setDevices: (devices) => set({ devices }),
  upsertDevice: (device) =>
    set((s) => {
      const idx = s.devices.findIndex((d) => d.device_id === device.device_id)
      if (idx >= 0) {
        const updated = [...s.devices]
        updated[idx] = device
        return { devices: updated }
      }
      return { devices: [...s.devices, device] }
    }),
  updateDeviceStatus: (deviceId, status) =>
    set((s) => ({
      devices: s.devices.map((d) => (d.device_id === deviceId ? { ...d, status } : d)),
    })),
  setSelectedDevice: (id) => set({ selectedDeviceId: id }),
}))

// ─── Telemetry Store ──────────────────────────────────────

interface TelemetryState {
  latestByDevice: Record<string, Telemetry>
  historyByDevice: Record<string, Telemetry[]>
  upsertLatest: (t: Telemetry) => void
  setHistory: (deviceId: string, history: Telemetry[]) => void
  appendHistory: (t: Telemetry) => void
}

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  latestByDevice: {},
  historyByDevice: {},
  upsertLatest: (t) =>
    set((s) => ({ latestByDevice: { ...s.latestByDevice, [t.device_id]: t } })),
  setHistory: (deviceId, history) =>
    set((s) => ({ historyByDevice: { ...s.historyByDevice, [deviceId]: history } })),
  appendHistory: (t) =>
    set((s) => {
      const history = s.historyByDevice[t.device_id] || []
      const updated = [...history, t].slice(-200)
      return { historyByDevice: { ...s.historyByDevice, [t.device_id]: updated } }
    }),
}))

// ─── Alert Store ──────────────────────────────────────────

interface AlertState {
  alerts: Alert[]
  alertStats: { critical: number; warning: number; info: number; total_unresolved: number }
  setAlerts: (alerts: Alert[]) => void
  prependAlert: (alert: Alert) => void
  setAlertStats: (stats: any) => void
}

export const useAlertStore = create<AlertState>()((set) => ({
  alerts: [],
  alertStats: { critical: 0, warning: 0, info: 0, total_unresolved: 0 },
  setAlerts: (alerts) => set({ alerts }),
  prependAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 500) })),
  setAlertStats: (stats) => set({ alertStats: stats }),
}))

// ─── UI Store ─────────────────────────────────────────────

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'ui-store' }
  )
)
