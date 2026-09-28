import { useEffect, useRef, useCallback } from 'react'
import { useTelemetryStore, useDeviceStore, useAlertStore } from '@/store/store'

export function useWebSocket(clientId: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { upsertLatest, appendHistory } = useTelemetryStore()
  const { updateDeviceStatus, upsertDevice } = useDeviceStore()
  const { prependAlert } = useAlertStore()

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const url = `${protocol}://${host}/ws/${clientId}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        handleMessage(msg)
      } catch { /* ignore */ }
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 3s...')
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = (err) => {
      console.error('[WS] Error', err)
    }

    // Ping keepalive every 25s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 25000)

    return () => {
      clearInterval(pingInterval)
      ws.close()
    }
  }, [clientId])

  function handleMessage(msg: any) {
    const { event, device_id, data } = msg
    switch (event) {
      case 'device.telemetry':
        if (data && device_id) {
          const t = { ...data, device_id }
          upsertLatest(t)
          appendHistory(t)
        }
        break
      case 'device.heartbeat':
        if (device_id) updateDeviceStatus(device_id, 'online')
        break
      case 'device.status':
        if (device_id && data?.status) updateDeviceStatus(device_id, data.status)
        break
      case 'device.capabilities':
        // handled by full device reload
        break
      case 'alert':
        if (data) prependAlert(data)
        break
    }
  }

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return wsRef
}
