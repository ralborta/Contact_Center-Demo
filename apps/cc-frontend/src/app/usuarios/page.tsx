'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import { usersApi } from '@/lib/api'

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [form, setForm] = useState({ username: '', password: '', profileId: '' })

  async function load() {
    const [u, p] = await Promise.all([usersApi.list(), usersApi.profiles()])
    setUsers(u)
    setProfiles(p)
  }
  useEffect(() => { load().catch(console.error) }, [])

  async function create() {
    await usersApi.create(form)
    setForm({ username: '', password: '', profileId: '' })
    load()
  }

  return (
    <PageShell title="Usuarios" subtitle="Acceso a la consola">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="surface-card p-5 space-y-3">
          <h3 className="font-display font-semibold">Nuevo usuario</h3>
          <input className="field-input" placeholder="Usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="field-input" type="password" placeholder="Contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="field-input" value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })}>
            <option value="">Perfil</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-primary" onClick={create}>Crear</button>
        </div>
        <div className="lg:col-span-2 surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/80 text-left">
              <tr>
                <th className="px-4 py-3 label-caps">Usuario</th>
                <th className="px-4 py-3 label-caps">Perfil</th>
                <th className="px-4 py-3 label-caps">Estado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-outline-variant/40">
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3">{u.profile?.name || u.profile?.slug}</td>
                  <td className="px-4 py-3">{u.active ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  )
}
