import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, Shield, Users as UsersIcon, X } from 'lucide-react'
import { usersApi } from '@/api/client'
import { useAuthStore } from '@/store/store'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { User } from '@/store/store'

const ROLE_STYLES: Record<string, string> = {
  admin:    'badge-critical',
  operator: 'badge-warning',
  viewer:   'badge-info',
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const { user: me } = useAuthStore()

  const load = async () => {
    setLoading(true)
    try { const r = await usersApi.list(); setUsers(r.data) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const deleteUser = async (id: number) => {
    if (!confirm('Delete this user?')) return
    await usersApi.delete(id)
    await load()
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">User Management</h2>
          <p className="page-subtitle">Role-based access control — Admin only</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* RBAC info banner */}
      <div className="card border border-sky-100 bg-sky-50/40 flex items-start gap-3">
        <Shield className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          <span className="font-bold text-sky-700">Viewer</span> — read-only dashboard access ·{' '}
          <span className="font-bold text-amber-700">Operator</span> — send commands and manage devices ·{' '}
          <span className="font-bold text-red-700">Admin</span> — full platform control including user management
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 card animate-pulse bg-slate-100" />)}</div>
      ) : users.length === 0 ? (
        <div className="card">
          <div className="empty-state py-12">
            <UsersIcon className="w-8 h-8 text-slate-300" />
            <p className="font-semibold text-slate-500">No users found</p>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                {['User', 'Email', 'Role', 'Status', 'Last Login', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="group">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-sky-600 uppercase">{u.username[0]}</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">{u.username}</p>
                        {u.id === me?.id && <span className="text-[10px] text-sky-500 font-semibold">You</span>}
                      </div>
                    </div>
                  </td>
                  <td className="text-slate-500">{u.email}</td>
                  <td>
                    <span className={cn('badge uppercase', ROLE_STYLES[u.role] ?? 'badge-info')}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={cn('badge', u.is_active ? 'badge-online' : 'badge-offline')}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="font-mono text-slate-400">
                    {u.last_login ? formatRelativeTime(u.last_login) : 'Never'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditUser(u)}
                        className="btn btn-ghost btn-sm p-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {u.id !== me?.id && (
                        <button onClick={() => deleteUser(u.id)}
                          className="btn btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <UserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {editUser && <UserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load() }} />}
    </div>
  )
}

function UserModal({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    username: user?.username ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'viewer',
    is_active: user?.is_active ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      if (user) {
        const payload: any = { email: form.email, role: form.role, is_active: form.is_active }
        if (form.password) payload.password = form.password
        await usersApi.update(user.id, payload)
      } else {
        await usersApi.create(form)
      }
      onSaved()
    } catch (err: any) { setError(err.response?.data?.detail ?? 'Failed to save user') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="card w-full max-w-md shadow-xl border border-slate-200"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-700">{user ? 'Edit User' : 'Create User'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          {!user && (
            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-1">Username *</label>
              <input required value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                className="form-input font-mono" placeholder="username" />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Email *</label>
            <input required type="email" value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              className="form-input" placeholder="user@example.com" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">
              {user ? 'New Password (leave blank to keep)' : 'Password *'}
            </label>
            <input type="password" required={!user} value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              className="form-input font-mono" placeholder="••••••••" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Role</label>
            <select value={form.role}
              onChange={(e) => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'operator' | 'viewer' }))}
              className="form-select">
              <option value="viewer">Viewer — Read only</option>
              <option value="operator">Operator — Commands & devices</option>
              <option value="admin">Admin — Full access</option>
            </select>
          </div>
          {user && (
            <label className="flex items-center gap-2 text-xs text-slate-500 font-semibold cursor-pointer">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded accent-sky-500" />
              Active account
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Saving…' : user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
