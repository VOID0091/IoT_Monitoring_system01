import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/store'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import DevicesPage from '@/pages/DevicesPage'
import DeviceDetailPage from '@/pages/DeviceDetailPage'
import TelemetryPage from '@/pages/TelemetryPage'
import AlertsPage from '@/pages/AlertsPage'
import LogsPage from '@/pages/LogsPage'
import NetworkPage from '@/pages/NetworkPage'
import SettingsPage from '@/pages/SettingsPage'
import UsersPage from '@/pages/UsersPage'

// DeviceOps imports
import FleetPage from '@/pages/FleetPage'
import CommandsPage from '@/pages/CommandsPage'
import ApplicationsPage from '@/pages/ApplicationsPage'
import OtaPage from '@/pages/OtaPage'
import HealthPage from '@/pages/HealthPage'
import DiscoveryPage from '@/pages/DiscoveryPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="fleet" element={<FleetPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="devices/:deviceId" element={<DeviceDetailPage />} />
          <Route path="commands" element={<CommandsPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="ota" element={<OtaPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="discovery" element={<DiscoveryPage />} />
          <Route path="telemetry" element={<TelemetryPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="network" element={<NetworkPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
