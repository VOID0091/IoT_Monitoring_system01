import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatUptime(seconds: number): string {
  if (!seconds) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatRelativeTime(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    online: 'text-green-400',
    warning: 'text-amber-400',
    critical: 'text-red-400',
    maintenance: 'text-blue-400',
    offline: 'text-slate-500',
  }
  return map[status] ?? 'text-slate-500'
}

export function getStatusBg(status: string): string {
  const map: Record<string, string> = {
    online: 'bg-green-500/10 border-green-500/20 text-green-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    critical: 'bg-red-500/10 border-red-500/20 text-red-400',
    maintenance: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    offline: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  }
  return map[status] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'
}

export function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-blue-400',
  }
  return map[severity] ?? 'text-slate-400'
}

export function metricColor(value: number, warn: number, crit: number): string {
  if (value >= crit) return 'text-red-400'
  if (value >= warn) return 'text-amber-400'
  return 'text-green-400'
}

export function metricBarColor(value: number, warn: number, crit: number): string {
  if (value >= crit) return 'bg-red-500'
  if (value >= warn) return 'bg-amber-500'
  return 'bg-sky-500'
}
