'use client'

import { useEffect, useState } from 'react'
import {
  Ban,
  CalendarClock,
  ClipboardList,
  Phone,
} from 'lucide-react'
import PageShell from '@/components/PageShell'
import { Avatar, IconAction, StatusBadge } from '@/components/ui'
import {
  APPT_STATUS_LABEL,
  CHANGE_ORIGIN_LABEL,
  WA_CHAT_STATUS_LABEL,
  appointmentsApi,
  doctorsApi,
  formatArgentina,
  patientsApi,
  whatsappApi,
} from '@/lib/api'

export default function CitasPage() {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [needsOnly, setNeedsOnly] = useState(false)
  const [highlightId, setHighlightId] = useState('')
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
    const cita = params.get('cita')
    if (cita) setHighlightId(cita)
    doctorsApi.list().then(setDoctors)
    patientsApi.list().then(setPatients)
  }, [])

  useEffect(() => {
    if (!highlightId || items.length === 0) return
    const el = document.getElementById(`cita-${highlightId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, items])

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
    const reason =
      prompt(byDoctor ? 'Motivo de cancelación del doctor' : 'Motivo de cancelación') || ''
    if (byDoctor) {
      await whatsappApi.doctorCancel({
        appointmentId: id,
        reason: reason || 'Cambio de agenda del doctor',
      })
      setMessage('Cancelada por doctor · se avisó al paciente por WhatsApp')
    } else {
      await appointmentsApi.cancel(id, { byDoctor: false, reason, blockSlot: false })
      setMessage('Cita cancelada')
    }
    load()
  }

  async function doctorReschedule(id: string) {
    const reason =
      prompt('Motivo del cambio de horario (doctor)') || 'El doctor necesita cambiar el horario'
    await whatsappApi.doctorReschedule({ appointmentId: id, reason })
    setMessage('Se pidió reprogramación · opciones enviadas por WhatsApp')
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
      icon={ClipboardList}
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

      <div className="surface-card overflow-x-auto mb-8 shadow-soft">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Doctor</th>
              <th>Estado</th>
              <th>Cambio</th>
              <th>WhatsApp</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const lastChange = a.changes?.[0]
              const active =
                a.status === 'RESERVED' ||
                a.status === 'CONFIRMED' ||
                a.status === 'RESCHEDULED' ||
                a.status === 'NEEDS_RESCHEDULE'
              const statusKey = a.needsReschedule ? 'NEEDS_RESCHEDULE' : a.status
              return (
              <tr
                key={a.id}
                id={`cita-${a.id}`}
                className={highlightId === a.id ? 'bg-primary-50/80 ring-2 ring-inset ring-primary/30' : ''}
              >
                <td className="whitespace-nowrap">
                  {a.slot ? formatArgentina(a.slot.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </td>
                <td>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      firstName={a.patient?.firstName}
                      lastName={a.patient?.lastName}
                      size="sm"
                    />
                    <span className="font-medium truncate">
                      {a.patient?.firstName} {a.patient?.lastName}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      firstName={a.doctor?.firstName}
                      lastName={a.doctor?.lastName}
                      size="sm"
                    />
                    <span className="truncate">
                      Dr(a). {a.doctor?.lastName}
                      {a.specialty?.name ? (
                        <span className="text-on-surface-variant"> · {a.specialty.name}</span>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td>
                  <StatusBadge
                    status={statusKey}
                    label={APPT_STATUS_LABEL[a.status] || a.status}
                  />
                </td>
                <td className="text-xs max-w-[180px]">
                  {lastChange ? (
                    <div>
                      <p className="font-semibold">
                        {CHANGE_ORIGIN_LABEL[lastChange.origin] || lastChange.origin}
                      </p>
                      <p className="text-on-surface-variant truncate" title={lastChange.reason || a.reason || ''}>
                        {lastChange.reason || a.reason || '—'}
                      </p>
                    </div>
                  ) : (
                    <span className="text-outline">{a.reason || '—'}</span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {a.whatsappConversation ? (
                    <a
                      href={`/whatsapp?chat=${a.whatsappConversation.id}`}
                      className="text-primary font-semibold hover:underline text-xs"
                    >
                      {WA_CHAT_STATUS_LABEL[a.whatsappConversation.status] ||
                        a.whatsappConversation.status}
                    </a>
                  ) : (
                    <span className="text-outline text-xs">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.interactions?.[0]?.id && (
                      <IconAction
                        icon={Phone}
                        label="Llamada"
                        href={`/llamadas/${a.interactions[0].id}`}
                        tone="primary"
                      />
                    )}
                    {active && (
                      <>
                        <IconAction
                          icon={Ban}
                          label="Cancelar (doctor)"
                          tone="danger"
                          onClick={() => cancel(a.id, true)}
                        />
                        <IconAction
                          icon={CalendarClock}
                          label="Reprogramar (doctor)"
                          tone="amber"
                          onClick={() => doctorReschedule(a.id)}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <section className="surface-card p-5 mb-6 shadow-soft">
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
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName} · DNI {p.documentId}</option>
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