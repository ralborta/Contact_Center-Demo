'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { doctorsApi, specialtiesApi } from '@/lib/api'

export default function DoctoresPage() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [specialties, setSpecialties] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', specialtyId: '', consultorio: '', defaultDurationMin: 30,
  })

  async function load() {
    const [d, s] = await Promise.all([doctorsApi.list(), specialtiesApi.list()])
    setDoctors(d)
    setSpecialties(s)
  }

  useEffect(() => { load().catch(console.error) }, [])

  async function create() {
    await doctorsApi.create({
      ...form,
      schedules: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '12:00', slotDuration: form.defaultDurationMin },
        { dayOfWeek: 3, startTime: '08:00', endTime: '12:00', slotDuration: form.defaultDurationMin },
        { dayOfWeek: 5, startTime: '08:00', endTime: '12:00', slotDuration: form.defaultDurationMin },
      ],
    })
    setShow(false)
    load()
  }

  return (
    <PageShell
      title="Doctores"
      subtitle="Plantel médico, consultorios y horarios"
      actions={
        <>
          <Link href="/especialidades" className="btn-secondary">Especialidades</Link>
          <button className="btn-primary" onClick={() => setShow(true)}>Nuevo doctor</button>
        </>
      }
    >
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {doctors.map((d) => (
          <article key={d.id} className="surface-card p-5">
            <p className="label-caps text-primary">{d.specialty?.name}</p>
            <h3 className="font-display text-xl font-semibold mt-1">
              Dr(a). {d.firstName} {d.lastName}
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Consultorio {d.consultorio || '—'} · {d.defaultDurationMin} min
            </p>
            <p className="text-xs mt-2">
              <span className={`status-pill ${d.status === 'ACTIVE' ? 'bg-green-100 text-status-success' : 'bg-surface-muted text-outline'}`}>
                {d.status}
              </span>
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="btn-secondary text-[10px]"
                onClick={() => doctorsApi.generateSlots(d.id, 4).then(() => alert('Slots generados'))}
              >
                Generar agenda 4 sem
              </button>
            </div>
            <div className="mt-3 text-xs text-on-surface-variant">
              {(d.schedules || []).slice(0, 4).map((s: any) => (
                <div key={s.id}>D{s.dayOfWeek}: {s.startTime}-{s.endTime}</div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="surface-card p-6 w-full max-w-md space-y-3">
            <h3 className="font-display text-xl font-semibold">Nuevo doctor</h3>
            <input className="field-input" placeholder="Nombre" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="field-input" placeholder="Apellido" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <select className="field-input" value={form.specialtyId} onChange={(e) => setForm({ ...form, specialtyId: e.target.value })}>
              <option value="">Especialidad</option>
              {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="field-input" placeholder="Consultorio" value={form.consultorio} onChange={(e) => setForm({ ...form, consultorio: e.target.value })} />
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
