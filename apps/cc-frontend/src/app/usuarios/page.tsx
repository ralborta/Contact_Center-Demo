'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import PageHeader from '@/components/PageHeader'
import { usersApi, profilesApi } from '@/lib/api'
import { UserCog, Plus, Trash2, UserCheck, UserX } from 'lucide-react'

interface Profile {
  id: string
  name: string
  slug: string
  description?: string
}

interface UserRow {
  id: string
  username: string
  profileId: string
  profile: { id: string; name: string; slug: string }
  active: boolean
  createdAt: string
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', profileId: '' })
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (profiles.length > 0 && !form.profileId) {
      setForm((f) => ({ ...f, profileId: profiles[0].id }))
    }
  }, [profiles])

  async function load() {
    try {
      setLoading(true)
      const [usersData, profilesData] = await Promise.all([
        usersApi.getAll(),
        profilesApi.getAll(),
      ])
      setUsers(Array.isArray(usersData) ? usersData : [])
      setProfiles(Array.isArray(profilesData) ? profilesData : [])
      if (profilesData?.length && !form.profileId) {
        setForm((f) => ({ ...f, profileId: profilesData[0].id }))
      }
    } catch (e: any) {
      if (e.response?.status === 403) {
        setError('No tiene permisos para ver usuarios.')
      } else {
        setError('Error al cargar datos.')
      }
      setUsers([])
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.username.trim() || !form.password || form.password.length < 6) {
      setError('Usuario y contraseña (mín. 6 caracteres) son obligatorios.')
      return
    }
    if (!form.profileId) {
      setError('Seleccione un perfil.')
      return
    }
    try {
      await usersApi.create({
        username: form.username.trim(),
        password: form.password,
        profileId: form.profileId,
        active: true,
      })
      setShowCreate(false)
      setForm({ username: '', password: '', profileId: profiles[0]?.id ?? '' })
      load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear usuario.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este usuario?')) return
    setDeletingId(id)
    setError('')
    try {
      await usersApi.delete(id)
      load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al eliminar.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        icon={UserCog}
        title="Usuarios y perfiles"
        action={
          <button
            onClick={() => { setShowCreate(true); setError(''); setForm({ ...form, username: '', password: '' }) }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-error-container text-error rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-on-surface-variant">Cargando...</p>
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant text-left">
                <th className="px-4 py-3 label-caps">Usuario</th>
                <th className="px-4 py-3 label-caps">Perfil</th>
                <th className="px-4 py-3 label-caps">Estado</th>
                <th className="px-4 py-3 label-caps">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#E5E7EB] hover:bg-surface-container-low text-on-surface">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">{u.profile?.name ?? u.profile?.slug ?? '-'}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="status-pill bg-emerald-100 text-status-success inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Activo
                      </span>
                    ) : (
                      <span className="status-pill bg-surface-container-high text-on-surface-variant inline-flex items-center gap-1">
                        <UserX className="w-3 h-3" /> Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(u.id)}
                      disabled={deletingId === u.id}
                      className="p-2 text-status-error hover:bg-error-container rounded-lg disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="p-6 text-center text-on-surface-variant">No hay usuarios.</p>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-[#151c27]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-xl shadow-elevate w-full max-w-md p-6 border border-[#E5E7EB]">
            <h2 className="text-lg font-semibold mb-4 text-on-surface">Nuevo usuario</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label-caps mb-1 block">Usuario</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="field-input"
                  placeholder="nombre.usuario"
                  required
                />
              </div>
              <div>
                <label className="label-caps mb-1 block">Contraseña (mín. 6)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="field-input"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="label-caps mb-1 block">Perfil</label>
                <select
                  value={form.profileId}
                  onChange={(e) => setForm({ ...form, profileId: e.target.value })}
                  className="field-input"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
