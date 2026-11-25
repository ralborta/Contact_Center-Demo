'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import {
  APPT_STATUS_LABEL,
  appointmentsApi,
  doctorsApi,
  formatLaPaz,
  patientsApi,
} from '@/lib/api'

export default function CitasPage() {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [needsOnly, setNeedsOnly] = useState(false)
  const [doctors, setDoctors] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ patientId: '', slotId: '', doctorId: '' })
  const [blockForm, setBlockForm] = useState({ doctorId: '', from: '', to: '', reason: '' })
  const [message, setMessage] = useState('')

  async function load() {
    const params: any = {}
    if (filter) params.status = filter
    if (needsOnly) params.needsReschedule = 'true'
    const data = await appointmentsApi.list(params)
    setItems(data)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('needsReschedule') === 'true') setNeedsOnly(true)
    doctorsApi.list().then(setDoctors)
    patientsApi.list().then(setPatients)
  }, [])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, needsOnly])

  async function createAppt() {
    await appointmentsApi.create({ patientId: form.patientId, slotId: form.slotId })
    setShowCreate(false)
    setMessage('Cita creada')
    load()
  }

  async function cancel(id: string, byDoctor: boolean) {
    const reason = prompt(byDoctor ? 'Motivo de cancelación del doctor' : 'Motivo de cancelación') || ''
    await appointmentsApi.cancel(id, { byDoctor, reason, blockSlot: false })
    setMessage(byDoctor ? 'Cancelada por doctor · se generó aviso' : 'Cita cancelada')
    load()
  }

  async function loadAvailability(doctorId: string) {
    setForm((f) => ({ ...f, doctorId, slotId: '' }))
    const slots = await appointmentsApi.availability({
      doctorId,
      from: new Date().toISOString(),
      to: new Date(Date.now() + 14 * 86400000).toISOString(),
    })
    setAvailability(slots)
  }

  async function blockAgenda() {
    await appointmentsApi.blockDoctor(blockForm.doctorId, blockForm)
    setMessage('Agenda bloqueada · pacientes afectados marcados para reprogramar')
    setNeedsOnly(true)
    load()
  }

  return (
    <PageShell
      title="Citas"
      subtitle="Gestión, reprogramación y cancelaciones"
      actions={
        <>
          <button className="btn-secondary" onClick={() => setNeedsOnly((v) => !v)}>
            {needsOnly ? 'Ver todas' : 'Solo afectados'}
          </button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Nueva cita</button>
        </>
      }
    >
      {message && <p className="mb-4 text-sm text-status-success bg-green-50 border border-green-200 rounded-lg px-3 py-2">{message}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="field-input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(APPT_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="surface-card overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted/80 text-left">
            <tr>
              <th className="px-4 py-3 label-caps">Fecha</th>
              <th className="px-4 py-3 label-caps">Paciente</th>
              <th className="px-4 py-3 label-caps">Doctor</th>
              <th className="px-4 py-3 label-caps">Estado</th>
              <th className="px-4 py-3 label-caps">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-outline-variant/40">
                <td className="px-4 py-3 whitespace-nowrap">
                  {a.slot ? formatLaPaz(a.slot.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </td>
                <td className="px-4 py-3">{a.patient?.firstName} {a.patient?.lastName}</td>
                <td className="px-4 py-3">Dr(a). {a.doctor?.lastName} · {a.specialty?.name}</td>
                <td className="px-4 py-3">
                  <span className={`status-pill ${a.needsReschedule ? 'bg-accent-soft text-accent' : 'bg-primary-100 text-primary'}`}>
                    {APPT_STATUS_LABEL[a.status] || a.status}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                  {a.interactions?.[0]?.id && (
                    <a href={`/llamadas/${a.interactions[0].id}`} className="text-primary font-semibold">
                      Llamada
                    </a>
                  )}
                  <button className="text-status-error font-semibold" onClick={() => cancel(a.id, false)}>Cancelar</button>
                  <button className="text-accent font-semibold" onClick={() => cancel(a.id, true)}>Cancelar doctor</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="surface-card p-5 mb-6">
        <h3 className="font-display text-lg font-semibold mb-1">Bloquear agenda del doctor</h3>
        <p className="text-sm text-on-surface-variant mb-4">Cancela citas afectadas y crea cola de avisos salientes</p>
        <div className="grid md:grid-cols-4 gap-3">
          <select className="field-input" value={blockForm.doctorId} onChange={(e) => setBlockForm({ ...blockForm, doctorId: e.target.value })}>
            <option value="">Doctor</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>Dr(a). {d.lastName}</option>)}
          </select>
          <input type="datetime-local" className="field-input" value={blockForm.from} onChange={(e) => setBlockForm({ ...blockForm, from: e.target.value })} />
          <input type="datetime-local" className="field-input" value={blockForm.to} onChange={(e) => setBlockForm({ ...blockForm, to: e.target.value })} />
          <input className="field-input" placeholder="Motivo" value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
        </div>
        <button className="btn-danger mt-3" onClick={blockAgenda} disabled={!blockForm.doctorId || !blockForm.reason}>
          Bloquear y avisar
        </button>
      </section>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="surface-card p-6 w-full max-w-lg space-y-3">
            <h3 className="font-display text-xl font-semibold">Nueva cita</h3>
            <select className="field-input" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
              <option value="">Paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName} · CI {p.documentId}</option>
              ))}
            </select>
            <select className="field-input" value={form.doctorId} onChange={(e) => loadAvailability(e.target.value)}>
              <option value="">Doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>Dr(a). {d.lastName} — {d.specialty?.name}</option>
              ))}
            </select>
            <select className="field-input" value={form.slotId} onChange={(e) => setForm({ ...form, slotId: e.target.value })}>
              <option value="">Horario</option>
              {availability.map((s) => (
                <option key={s.slotId} value={s.slotId}>{s.mensaje}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cerrar</button>
              <button className="btn-primary" onClick={createAppt} disabled={!form.patientId || !form.slotId}>Reservar</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
