'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserCog className="w-8 h-8 text-blue-600" />
            Usuarios y perfiles
          </h1>
          <button
            onClick={() => { setShowCreate(true); setError(''); setForm({ ...form, username: '', password: '' }) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 text-left text-sm font-medium text-gray-700">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="text-gray-800">
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3">{u.profile?.name ?? u.profile?.slug ?? '-'}</td>
                    <td className="px-4 py-3">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <UserCheck className="w-4 h-4" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <UserX className="w-4 h-4" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
              <p className="p-6 text-center text-gray-500">No hay usuarios.</p>
            )}
          </div>
        )}

        {/* Modal crear usuario */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold mb-4">Nuevo usuario</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="nombre.usuario"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña (mín. 6)</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                  <select
                    value={form.profileId}
                    onChange={(e) => setForm({ ...form, profileId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
