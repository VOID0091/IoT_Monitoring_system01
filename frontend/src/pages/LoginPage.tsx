import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Radio, Zap, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react'
import { authApi } from '@/api/client'
import { useAuthStore } from '@/store/store'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(username, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const me = await authApi.me()
      setUser(me.data)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — dark branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-[#0f172a] p-10 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#0ea5e9 1px, transparent 1px), linear-gradient(90deg, #0ea5e9 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />

        {/* Glow orbs */}
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <Radio className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <p className="text-slate-200 font-bold text-sm">Phantomation</p>
              <p className="text-sky-400 text-[10px] font-mono uppercase tracking-widest">DeviceOps v1.0</p>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-white leading-tight mt-12 mb-4">
            Industrial Device<br />Operating Platform
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Unified fleet telemetry, remote command execution, OTA updates, and real-time alert management — all in one platform.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-3">
          {[
            { icon: '⚡', label: 'Real-time MQTT telemetry ingestion' },
            { icon: '🛰️', label: 'Remote command dispatch & OTA updates' },
            { icon: '🔔', label: 'Automated alert policy engine' },
            { icon: '🔐', label: 'JWT role-based access control' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-xs text-slate-400">
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
          <p className="text-xs text-slate-600 pt-2">© 2026 Phantomation Intelligence</p>
        </div>
      </div>

      {/* Right panel — light login form */}
      <div className="flex-1 bg-[#f1f5f9] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center">
              <Radio className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-slate-700 font-bold text-sm">Phantomation DeviceOps</p>
              <p className="text-sky-500 text-[10px] font-mono uppercase tracking-widest">Industrial IoT Platform</p>
            </div>
          </div>

          {/* Card */}
          <div className="card shadow-xl border border-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-slate-800">Sign in</h2>
              <p className="text-sm text-slate-500 mt-1">Enter your operator credentials to continue</p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input font-mono"
                  placeholder="admin"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input font-mono pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg w-full mt-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {loading ? 'Authenticating…' : 'Sign In'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-slate-300" />
              <p className="text-xs text-slate-400">
                Default: <span className="font-mono text-slate-500 font-semibold">admin / admin123</span>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Secured with JWT authentication · Role-based access control
          </p>
        </motion.div>
      </div>
    </div>
  )
}
