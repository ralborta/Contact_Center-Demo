'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Phone } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { doctorsApi, formatLaPaz, specialtiesApi } from '@/lib/api'

type Slot = {
  id: string
  startsAt: string
  endsAt: string
  status: string
  appointment?: {
    patient?: { firstName: string; lastName: string; documentId: string }
  } | null
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

export default function AgendaPage() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [specialties, setSpecialties] = useState<any[]>([])
  const [doctorId, setDoctorId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [view, setView] = useState<'day' | 'week'>('week')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([doctorsApi.list(), specialtiesApi.list()]).then(([d, s]) => {
      setDoctors(d)
      setSpecialties(s)
      if (d[0]) setDoctorId(d[0].id)
    })
  }, [])

  useEffect(() => {
    if (!doctorId) return
    setLoading(true)
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + (view === 'day' ? 1 : 7))
    doctorsApi
      .agenda(doctorId, from.toISOString(), to.toISOString())
      .then(setSlots)
      .finally(() => setLoading(false))
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
      free: items.filter((i) => i.status === 'FREE').length,
      reserved: items.filter((i) => i.status === 'RESERVED').length,
      blocked: items.filter((i) => i.status === 'BLOCKED').length,
    }))
  }, [slots])

  const totals = useMemo(
    () => ({
      free: slots.filter((s) => s.status === 'FREE').length,
      reserved: slots.filter((s) => s.status === 'RESERVED').length,
      blocked: slots.filter((s) => s.status === 'BLOCKED').length,
    }),
    [slots],
  )

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
          <Link href="/telefono" className="btn-secondary">
            <Phone className="w-3.5 h-3.5" />
            Simulador
          </Link>
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
                    {day.blocked > 0 && (
                      <span className="text-on-surface-variant">{day.blocked} bloq.</span>
                    )}
                  </div>
                </header>
                <div className="divide-y divide-outline-variant/40">
                  {day.items.map((s) => {
                    const appt = s.appointment
                    const tone =
                      s.status === 'FREE'
                        ? 'border-l-status-success bg-green-50/40'
                        : s.status === 'BLOCKED'
                          ? 'border-l-outline bg-surface-muted/50'
                          : 'border-l-primary bg-primary-50/50'
                    return (
                      <div
                        key={s.id}
                        className={`border-l-4 px-4 py-3 flex flex-wrap justify-between gap-2 ${tone}`}
                      >
                        <div>
                          <p className="font-semibold text-sm text-on-surface">
                            {formatLaPaz(s.startsAt, { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {formatLaPaz(s.endsAt, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {s.status === 'FREE' && 'Disponible'}
                            {s.status === 'BLOCKED' && 'Bloqueado'}
                            {s.status === 'RESERVED' && appt && (
                              <>
                                Reservado · {appt.patient?.firstName} {appt.patient?.lastName} · CI{' '}
                                {appt.patient?.documentId}
                              </>
                            )}
                            {s.status === 'RESERVED' && !appt && 'Reservado'}
                          </p>
                        </div>
                        <span className="status-pill bg-white/90 text-on-surface-variant self-center border border-outline-variant/40">
                          {s.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
      </div>
    </PageShell>
  )
}
