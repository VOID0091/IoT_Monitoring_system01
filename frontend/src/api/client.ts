import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Inject auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// ─── Auth ─────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
}

// ─── Devices ──────────────────────────────────────────────
export const devicesApi = {
  list: (params?: { status?: string; group?: string; search?: string }) =>
    api.get('/devices', { params }),
  get: (id: string) => api.get(`/devices/${id}`),
  create: (data: any) => api.post('/devices', data),
  update: (id: string, data: any) => api.put(`/devices/${id}`, data),
  delete: (id: string) => api.delete(`/devices/${id}`),
  command: (id: string, command: string, params?: any) =>
    api.post(`/devices/${id}/command`, { command, params }),
  groups: () => api.get('/devices/groups/list'),
}

// ─── Telemetry ────────────────────────────────────────────
export const telemetryApi = {
  latest: (deviceId: string) => api.get(`/telemetry/${deviceId}/latest`),
  history: (deviceId: string, limit = 100) =>
    api.get(`/telemetry/${deviceId}/history`, { params: { limit } }),
  allLatest: () => api.get('/telemetry/summary/all'),
}

// ─── Alerts ───────────────────────────────────────────────
export const alertsApi = {
  list: (params?: any) => api.get('/alerts', { params }),
  stats: () => api.get('/alerts/stats'),
  acknowledge: (ids: number[]) => api.post('/alerts/acknowledge', { alert_ids: ids }),
  resolve: (ids: number[]) => api.post('/alerts/resolve', { alert_ids: ids }),
}

// ─── Logs ─────────────────────────────────────────────────
export const logsApi = {
  list: (params?: any) => api.get('/logs', { params }),
}

// ─── Users ────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
}

// ─── Network ──────────────────────────────────────────────
export const networkApi = {
  overview: () => api.get('/network/overview'),
}

// ─── Device Shadow ────────────────────────────────────────
export const shadowApi = {
  get: (deviceId: string) => api.get(`/shadow/${deviceId}`),
  updateDesired: (deviceId: string, desired: any) => api.put(`/shadow/${deviceId}/desired`, desired),
  sync: (deviceId: string, reported: any) => api.post(`/shadow/${deviceId}/sync`, reported),
}

// ─── Command Bus ──────────────────────────────────────────
export const commandsApi = {
  list: (params?: any) => api.get('/commands', { params }),
  dispatch: (data: { device_id: string; command_type: string; payload?: any }) => api.post('/commands', data),
  cancel: (commandId: string) => api.delete(`/commands/${commandId}`),
}

// ─── Device Timeline (Events) ─────────────────────────────
export const eventsApi = {
  list: (params?: any) => api.get('/events', { params }),
  deviceEvents: (deviceId: string, params?: any) => api.get(`/events/${deviceId}`, { params }),
}

// ─── Fleet Management ─────────────────────────────────────
export const fleetApi = {
  listOrgs: () => api.get('/fleet/orgs'),
  createOrg: (data: any) => api.post('/fleet/orgs', data),
  deleteOrg: (id: number) => api.delete(`/fleet/orgs/${id}`),
  listSites: (params?: { org_id?: number }) => api.get('/fleet/sites', { params }),
  createSite: (data: any) => api.post('/fleet/sites', data),
  deleteSite: (id: number) => api.delete(`/fleet/sites/${id}`),
  listFleets: (params?: { site_id?: number }) => api.get('/fleet/fleets', { params }),
  createFleet: (data: any) => api.post('/fleet/fleets', data),
  deleteFleet: (id: number) => api.delete(`/fleet/fleets/${id}`),
  getFleetHealth: (id: number) => api.get(`/fleet/fleets/${id}/health`),
  assignDevice: (deviceId: string, data: { org_id?: number; site_id?: number; fleet_id?: number }) =>
    api.put(`/fleet/devices/${deviceId}/assign`, data),
  bulkAction: (data: { fleet_id?: number; device_ids?: string[]; command_type: string; payload?: any }) =>
    api.post('/fleet/bulk-action', data),
}

// ─── Application Lifecycle ───────────────────────────────
export const appsApi = {
  list: () => api.get('/apps'),
  create: (data: any) => api.post('/apps', data),
  get: (id: number) => api.get(`/apps/${id}`),
  delete: (id: number) => api.delete(`/apps/${id}`),
  deviceApps: (deviceId: string) => api.get(`/apps/device/${deviceId}`),
  install: (deviceId: string, appId: number) => api.post(`/apps/device/${deviceId}/install`, { app_id: appId }),
  action: (deviceId: string, appId: number, action: string) =>
    api.post(`/apps/device/${deviceId}/${appId}/action`, { action }),
}

// ─── OTA Platform ─────────────────────────────────────────
export const otaApi = {
  listPackages: () => api.get('/ota/packages'),
  uploadPackage: (formData: FormData) =>
    api.post('/ota/packages', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  createDeployment: (data: { package_id: number; device_ids: string[] }) => api.post('/ota/deploy', data),
  listDeployments: (params?: any) => api.get('/ota/deployments', { params }),
  rollback: (depId: number) => api.post(`/ota/deployments/${depId}/rollback`),
}

export default api
