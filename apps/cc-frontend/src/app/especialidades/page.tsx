'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { specialtiesApi } from '@/lib/api'

export default function EspecialidadesPage() {
  const [items, setItems] = useState<any[]>([])
  const [form, setForm] = useState({ code: '', name: '', description: '' })

  async function load() {
    setItems(await specialtiesApi.list())
  }
  useEffect(() => { load().catch(console.error) }, [])

  async function create() {
    await specialtiesApi.create(form)
    setForm({ code: '', name: '', description: '' })
    load()
  }

  return (
    <PageShell
      title="Especialidades"
      subtitle="Catálogo clínico"
      actions={<Link href="/doctores" className="btn-secondary">Doctores</Link>}
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="surface-card p-5 space-y-3 lg:col-span-1">
          <h3 className="font-display font-semibold">Nueva</h3>
          <input className="field-input" placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="field-input" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field-input" placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn-primary" onClick={create}>Crear</button>
        </div>
        <div className="lg:col-span-2 space-y-2">
          {items.map((s) => (
            <div key={s.id} className="surface-card px-4 py-3 flex justify-between items-center">
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-on-surface-variant">{s.code} · {s._count?.doctors ?? 0} doctores</p>
              </div>
              <span className={`status-pill ${s.active ? 'bg-green-100 text-status-success' : 'bg-surface-muted'}`}>
                {s.active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
