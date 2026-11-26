'use client'

import { useEffect, useState } from 'react'
import { FileText, Users } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { Avatar, IconAction } from '@/components/ui'
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
      icon={Users}
      title="Pacientes"
      subtitle="Fichas e historial de citas"
      actions={<button className="btn-primary" onClick={() => setShow(true)}>Nuevo paciente</button>}
    >
      <div className="mb-4 flex gap-2">
        <input
          className="field-input max-w-md"
          placeholder="Buscar por nombre, DNI o teléfono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(q)}
        />
        <button className="btn-secondary" onClick={() => load(q)}>Buscar</button>
      </div>
      <div className="surface-card overflow-x-auto shadow-soft">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Teléfono</th>
              <th>Seguro</th>
              <th className="text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar firstName={p.firstName} lastName={p.lastName} size="sm" />
                    <span className="font-medium truncate">
                      {p.firstName} {p.lastName}
                    </span>
                  </div>
                </td>
                <td className="tabular-nums">{p.documentId}</td>
                <td className="tabular-nums">{p.phone}</td>
                <td>{p.insurance || '—'}</td>
                <td className="text-right">
                  <IconAction
                    icon={FileText}
                    label="Ficha"
                    href={`/pacientes/${p.id}`}
                    tone="primary"
                  />
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