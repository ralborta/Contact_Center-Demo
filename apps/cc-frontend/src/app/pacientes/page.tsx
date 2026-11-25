'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { patientsApi } from '@/lib/api'

export default function PacientesPage() {
  const [items, setItems] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', documentId: '', phone: '', insurance: '',
  })

  async function load(query?: string) {
    setItems(await patientsApi.list(query))
  }
  useEffect(() => { load().catch(console.error) }, [])

  async function create() {
    await patientsApi.create(form)
    setShow(false)
    load()
  }

  return (
    <PageShell
      title="Pacientes"
      subtitle="Fichas e historial de citas"
      actions={<button className="btn-primary" onClick={() => setShow(true)}>Nuevo paciente</button>}
    >
      <div className="mb-4 flex gap-2">
        <input
          className="field-input max-w-md"
          placeholder="Buscar por nombre, CI o teléfono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(q)}
        />
        <button className="btn-secondary" onClick={() => load(q)}>Buscar</button>
      </div>
      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted/80 text-left">
            <tr>
              <th className="px-4 py-3 label-caps">Nombre</th>
              <th className="px-4 py-3 label-caps">CI</th>
              <th className="px-4 py-3 label-caps">Teléfono</th>
              <th className="px-4 py-3 label-caps">Seguro</th>
              <th className="px-4 py-3 label-caps"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-outline-variant/40">
                <td className="px-4 py-3 font-medium">{p.firstName} {p.lastName}</td>
                <td className="px-4 py-3">{p.documentId}</td>
                <td className="px-4 py-3">{p.phone}</td>
                <td className="px-4 py-3">{p.insurance || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/pacientes/${p.id}`} className="text-primary font-semibold">Ficha</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="surface-card p-6 w-full max-w-md space-y-3">
            <h3 className="font-display text-xl font-semibold">Nuevo paciente</h3>
            {(['firstName', 'lastName', 'documentId', 'phone', 'insurance'] as const).map((k) => (
              <input
                key={k}
                className="field-input"
                placeholder={k}
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            ))}
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setShow(false)}>Cerrar</button>
              <button className="btn-primary" onClick={create}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
