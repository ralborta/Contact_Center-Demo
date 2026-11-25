'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MessageCircle, Phone, X } from 'lucide-react'
import PageShell from '@/components/PageShell'
import {
  APPT_STATUS_LABEL,
  CHANGE_ORIGIN_LABEL,
  WA_CHAT_STATUS_LABEL,
  doctorsApi,
  formatLaPaz,
  specialtiesApi,
  whatsappApi,
} from '@/lib/api'

type AgendaAppointment = {
  id: string
  status?: string
  reason?: string | null
  voiceConversationId?: string | null
  patient?: {
    firstName: string
    lastName: string
    documentId?: string
    phone?: string | null
  } | null
  specialty?: { name: string } | null
  interactions?: Array<{
    id: string
    providerConversationId?: string | null
    resultCode?: string | null
    startedAt?: string
  }>
  whatsappConversation?: {
    id: string
    status?: string
    lastMessageAt?: string | null
  } | null
  changes?: Array<{
    origin?: string
    reason?: string | null
    toStatus?: string
    createdAt?: string
  }>
}

type Slot = {
  id: string
  startsAt: string
  endsAt: string
  status: string
  appointment?: AgendaAppointment | null
}

function isCancelledAppt(status?: string) {
  return status === 'CANCELLED_BY_PATIENT' || status === 'CANCELLED_BY_DOCTOR'
}

function dayKey(iso: string) {
  return formatLaPaz(iso, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function dayLabel(iso: string) {
  return formatLaPaz(iso, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function linkedCall(appt?: AgendaAppointment | null) {
  if (!appt) return null
  const byVoice = appt.voiceConversationId
    ? appt.interactions?.find((i) => i.providerConversationId === appt.voiceConversationId)
    : null
  return byVoice || appt.interactions?.[0] || null
}

export default function AgendaPage() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [specialties, setSpecialties] = useState<any[]>([])
  const [doctorId, setDoctorId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [view, setView] = useState<'day' | 'week'>('week')
  const [loading, setLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function reloadAgenda() {
    if (!doctorId) return
    setLoading(true)
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + (view === 'day' ? 1 : 7))
    try {
      const data = await doctorsApi.agenda(doctorId, from.toISOString(), to.toISOString())
      setSlots(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([doctorsApi.list(), specialtiesApi.list()]).then(([d, s]) => {
      setDoctors(d)
      setSpecialties(s)
      if (d[0]) setDoctorId(d[0].id)
    })
  }, [])

  useEffect(() => {
    if (!doctorId) return
    setSelectedSlot(null)
    void reloadAgenda()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, view])

  const filteredDoctors = useMemo(
    () => (specialtyId ? doctors.filter((d) => d.specialtyId === specialtyId) : doctors),
    [doctors, specialtyId],
  )

  useEffect(() => {
    if (!specialtyId) return
    if (!filteredDoctors.some((d) => d.id === doctorId)) {
      setDoctorId(filteredDoctors[0]?.id || '')
    }
  }, [specialtyId, filteredDoctors, doctorId])

  const selected = doctors.find((d) => d.id === doctorId)

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) {
      const k = dayKey(s.startsAt)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(s)
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: dayLabel(items[0].startsAt),
      items,
      free: items.filter((i) => i.status === 'FREE' && !isCancelledAppt(i.appointment?.status)).length,
      reserved: items.filter(
        (i) => i.status === 'RESERVED' && !isCancelledAppt(i.appointment?.status),
      ).length,
      cancelled: items.filter((i) => isCancelledAppt(i.appointment?.status)).length,
      blocked: items.filter((i) => i.status === 'BLOCKED').length,
    }))
  }, [slots])

  const totals = useMemo(
    () => ({
      free: slots.filter((s) => s.status === 'FREE' && !isCancelledAppt(s.appointment?.status)).length,
      reserved: slots.filter(
        (s) => s.status === 'RESERVED' && !isCancelledAppt(s.appointment?.status),
      ).length,
      cancelled: slots.filter((s) => isCancelledAppt(s.appointment?.status)).length,
      blocked: slots.filter((s) => s.status === 'BLOCKED').length,
    }),
    [slots],
  )

  const detailAppt = selectedSlot?.appointment
  const detailPatient = detailAppt?.patient
  const detailCall = linkedCall(detailAppt)
  const detailName = detailPatient
    ? `${detailPatient.firstName} ${detailPatient.lastName}`
    : null

  return (
    <PageShell
      title="Agenda"
      subtitle={
        selected
          ? `Dr(a). ${selected.firstName} ${selected.lastName} · ${selected.specialty?.name}${
              selected.consultorio ? ` · Cons. ${selected.consultorio}` : ''
            }`
          : 'Seleccione un doctor'
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            className={view === 'day' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('day')}
          >
            Día
          </button>
          <button
            className={view === 'week' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('week')}
          >
            Semana
          </button>
        </div>
      }
    >
      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <aside className="space-y-4">
          <div className="surface-card p-4 space-y-3">
            <p className="label-caps">Filtros</p>
            <div>
              <label className="label-caps mb-1 block">Especialidad</label>
              <select
                className="field-input"
                value={specialtyId}
                onChange={(e) => setSpecialtyId(e.target.value)}
              >
                <option value="">Todas</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps mb-1 block">Médico</label>
              <select
                className="field-input"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                {filteredDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.lastName}, {d.firstName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="surface-card p-4 space-y-2">
            <p className="label-caps flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Resumen del rango
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="status-pill bg-green-50 text-status-success border border-status-success/20">
                {totals.free} libres
              </span>
              <span className="status-pill bg-primary-50 text-primary border border-primary/20">
                {totals.reserved} reservados
              </span>
              <span className="status-pill bg-red-50 text-status-error border border-status-error/20">
                {totals.cancelled} cancelados
              </span>
              <span className="status-pill bg-surface-muted text-on-surface-variant border border-outline-variant">
                {totals.blocked} bloqueados
              </span>
            </div>
          </div>

          <div className="surface-card p-3 max-h-[420px] overflow-y-auto space-y-1">
            <p className="label-caps px-2 py-1">Médicos</p>
            {filteredDoctors.map((d) => {
              const active = d.id === doctorId
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDoctorId(d.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-all ${
                    active
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'hover:bg-primary-50 text-on-surface'
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight">
                    Dr(a). {d.lastName}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${active ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                    {d.firstName} · {d.specialty?.name}
                  </p>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="space-y-4">
          {loading && (
            <div className="surface-card p-6 text-sm text-on-surface-variant animate-pulse-soft">
              Cargando agenda…
            </div>
          )}
          {!loading && byDay.length === 0 && (
            <div className="surface-card p-8 text-center text-sm text-outline">
              Sin slots en este rango. Genere slots desde Doctores o ejecute el seed.
            </div>
          )}
          {!loading &&
            byDay.map((day) => (
              <section key={day.key} className="surface-card overflow-hidden">
                <header className="px-4 py-3 border-b border-outline-variant/50 flex flex-wrap items-center justify-between gap-2 bg-surface-muted/40">
                  <h3 className="font-display text-lg font-semibold text-on-surface capitalize">
                    {day.label}
                  </h3>
                  <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="text-status-success">{day.free} libres</span>
                    <span className="text-primary">{day.reserved} citas</span>
                    {day.cancelled > 0 && (
                      <span className="text-status-error">{day.cancelled} canc.</span>
                    )}
                    {day.blocked > 0 && (
                      <span className="text-on-surface-variant">{day.blocked} bloq.</span>
                    )}
                  </div>
                </header>
                <div className="divide-y divide-outline-variant/40">
                  {day.items.map((s) => {
                    const appt = s.appointment
                    const cancelled = isCancelledAppt(appt?.status)
                    const clickable =
                      !cancelled && s.status === 'RESERVED' && Boolean(appt)
                    const tone = cancelled
                      ? 'border-l-status-error bg-red-50/40'
                      : s.status === 'FREE'
                        ? 'border-l-status-success bg-green-50/40'
                        : s.status === 'BLOCKED'
                          ? 'border-l-outline bg-surface-muted/50'
                          : 'border-l-primary bg-primary-50/50'
                    const pill = cancelled
                      ? 'CANCELADO'
                      : s.status === 'FREE'
                        ? 'LIBRE'
                        : s.status === 'BLOCKED'
                          ? 'BLOQUEADO'
                          : 'RESERVADO'
                    const patientName = appt?.patient
                      ? `${appt.patient.firstName} ${appt.patient.lastName}`
                      : null
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!clickable}
                        onClick={() => clickable && setSelectedSlot(s)}
                        className={`w-full text-left border-l-4 px-4 py-3 flex flex-wrap justify-between gap-2 ${tone} ${
                          clickable
                            ? 'cursor-pointer hover:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                            : 'cursor-default'
                        } ${selectedSlot?.id === s.id ? 'ring-1 ring-inset ring-primary/30' : ''}`}
                      >
                        <div>
                          <p className="font-semibold text-sm text-on-surface">
                            {formatLaPaz(s.startsAt, { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {formatLaPaz(s.endsAt, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {cancelled && (
                              <>
                                Cancelado
                                {patientName && <> · {patientName}</>}
                              </>
                            )}
                            {!cancelled && s.status === 'FREE' && 'Disponible'}
                            {!cancelled && s.status === 'BLOCKED' && 'Bloqueado'}
                            {!cancelled && s.status === 'RESERVED' && patientName && (
                              <>Reservado · {patientName}</>
                            )}
                            {!cancelled && s.status === 'RESERVED' && !patientName && 'Reservado'}
                          </p>
                        </div>
                        <span className="status-pill bg-white/90 text-on-surface-variant self-center border border-outline-variant/40">
                          {pill}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
      </div>

      {selectedSlot && detailAppt && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/35 p-4"
          onClick={() => setSelectedSlot(null)}
        >
          <div
            className="surface-card w-full max-w-md p-5 space-y-4 shadow-xl"
            role="dialog"
            aria-label="Detalle de cita"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-caps mb-1">Detalle de cita</p>
                <h3 className="font-display text-xl font-semibold text-on-surface">
                  {detailName || 'Paciente'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-secondary !px-2 !py-2"
                aria-label="Cerrar"
                onClick={() => setSelectedSlot(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="label-caps">Teléfono</p>
                <p className="font-medium tabular-nums">
                  {detailPatient?.phone || '—'}
                </p>
              </div>
              <div>
                <p className="label-caps">Documento</p>
                <p className="font-medium">
                  {detailPatient?.documentId ? `CI ${detailPatient.documentId}` : '—'}
                </p>
              </div>
              <div>
                <p className="label-caps">Especialidad</p>
                <p className="font-medium">
                  {detailAppt.specialty?.name || selected?.specialty?.name || '—'}
                </p>
              </div>
              <div>
                <p className="label-caps">Estado</p>
                <p className="font-medium">
                  {APPT_STATUS_LABEL[detailAppt.status || ''] ||
                    detailAppt.status ||
                    'Reservada'}
                </p>
              </div>
              <div>
                <p className="label-caps">WhatsApp</p>
                <p className="font-medium">
                  {detailAppt.whatsappConversation
                    ? WA_CHAT_STATUS_LABEL[detailAppt.whatsappConversation.status || ''] ||
                      detailAppt.whatsappConversation.status
                    : 'Sin mensaje'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="label-caps">Fecha y hora</p>
                <p className="font-medium">
                  {formatLaPaz(selectedSlot.startsAt, {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              {selected && (
                <div className="col-span-2">
                  <p className="label-caps">Médico</p>
                  <p className="font-medium">
                    Dr(a). {selected.firstName} {selected.lastName}
                  </p>
                </div>
              )}
              {(detailAppt.changes?.[0] || detailAppt.reason) && (
                <div className="col-span-2">
                  <p className="label-caps">Último cambio</p>
                  <p className="font-medium">
                    {detailAppt.changes?.[0]
                      ? CHANGE_ORIGIN_LABEL[detailAppt.changes[0].origin || ''] ||
                        detailAppt.changes[0].origin
                      : '—'}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    {detailAppt.changes?.[0]?.reason || detailAppt.reason || '—'}
                  </p>
                </div>
              )}
            </div>

            {actionMsg && (
              <p className="text-sm text-status-success bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {actionMsg}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {['RESERVED', 'CONFIRMED', 'RESCHEDULED', 'NEEDS_RESCHEDULE'].includes(
                detailAppt.status || '',
              ) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={async () => {
                      const reason =
                        prompt('Motivo de cancelación del doctor') ||
                        'Cambio de agenda del doctor'
                      setBusy(true)
                      setActionMsg('')
                      try {
                        await whatsappApi.doctorCancel({
                          appointmentId: detailAppt.id,
                          reason,
                        })
                        setActionMsg('Cancelada · aviso WhatsApp enviado')
                        await reloadAgenda()
                        setSelectedSlot(null)
                      } catch (e: any) {
                        setActionMsg(e?.response?.data?.message || 'No se pudo cancelar')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Cancelar (doctor)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={async () => {
                      const reason =
                        prompt('Motivo del cambio de horario') ||
                        'El doctor necesita cambiar el horario'
                      setBusy(true)
                      setActionMsg('')
                      try {
                        await whatsappApi.doctorReschedule({
                          appointmentId: detailAppt.id,
                          reason,
                        })
                        setActionMsg('Reprogramación pedida · opciones por WhatsApp')
                        await reloadAgenda()
                        setSelectedSlot(null)
                      } catch (e: any) {
                        setActionMsg(e?.response?.data?.message || 'No se pudo reprogramar')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Reprogramar (doctor)
                  </button>
                </div>
              )}
              {detailCall ? (
                <Link
                  href={`/llamadas/${detailCall.id}`}
                  className="btn-primary w-full inline-flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Ver llamada que reservó
                </Link>
              ) : (
                <p className="text-xs text-on-surface-variant">
                  Esta cita no está vinculada a una llamada del agente.
                </p>
              )}
              {detailAppt.whatsappConversation?.id && (
                <Link
                  href={`/whatsapp?chat=${detailAppt.whatsappConversation.id}`}
                  className="btn-secondary w-full inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Ver chat de confirmación
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
