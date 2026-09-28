import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useUIStore } from '@/store/store'
import { useWebSocket } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

const clientId = `frontend-${Math.random().toString(36).substring(2, 10)}`

export default function AppLayout() {
  const { sidebarCollapsed } = useUIStore()

  // Start WebSocket
  useWebSocket(clientId)

  return (
    <div className="min-h-screen" style={{ background: 'var(--content-bg)' }}>
      <Sidebar />
      <div className={cn('main-content', sidebarCollapsed && 'sidebar-collapsed')}>
        <TopBar />
        <main className="p-5 lg:p-6 fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
