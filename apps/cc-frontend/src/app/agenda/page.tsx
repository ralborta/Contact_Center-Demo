'use client'

import { useEffect, useMemo, useState } from 'react'
import PageShell from '@/components/PageShell'
import { doctorsApi, formatLaPaz, specialtiesApi } from '@/lib/api'

export default function AgendaPage() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [specialties, setSpecialties] = useState<any[]>([])
  const [doctorId, setDoctorId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [slots, setSlots] = useState<any[]>([])
  const [view, setView] = useState<'day' | 'week'>('week')

  useEffect(() => {
    Promise.all([doctorsApi.list(), specialtiesApi.list()]).then(([d, s]) => {
      setDoctors(d)
      setSpecialties(s)
      if (d[0]) setDoctorId(d[0].id)
    })
  }, [])

  useEffect(() => {
    if (!doctorId) return
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + (view === 'day' ? 1 : 7))
    doctorsApi.agenda(doctorId, from.toISOString(), to.toISOString()).then(setSlots)
  }, [doctorId, view])

  const filteredDoctors = useMemo(
    () => (specialtyId ? doctors.filter((d) => d.specialtyId === specialtyId) : doctors),
    [doctors, specialtyId],
  )

  const selected = doctors.find((d) => d.id === doctorId)

  return (
    <PageShell
      title="Agenda"
      subtitle={selected ? `Dr(a). ${selected.firstName} ${selected.lastName} · ${selected.specialty?.name}` : 'Seleccione un doctor'}
      actions={
        <div className="flex gap-2">
          <button className={view === 'day' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('day')}>Día</button>
          <button className={view === 'week' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('week')}>Semana</button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="field-input max-w-xs" value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
          <option value="">Todas las especialidades</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="field-input max-w-md" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          {filteredDoctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr(a). {d.lastName}, {d.firstName} — {d.specialty?.name}
            </option>
          ))}
        </select>
      </div>

      <div className="surface-card p-4">
        <div className="grid gap-2">
          {slots.map((s) => {
            const appt = s.appointment
            const tone =
              s.status === 'FREE'
                ? 'border-status-success/30 bg-green-50'
                : s.status === 'BLOCKED'
                  ? 'border-outline bg-surface-muted'
                  : 'border-primary/30 bg-primary-50'
            return (
              <div key={s.id} className={`rounded-lg border px-4 py-3 flex flex-wrap justify-between gap-2 ${tone}`}>
                <div>
                  <p className="font-semibold text-sm">
                    {formatLaPaz(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {formatLaPaz(s.endsAt, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {s.status === 'FREE' && 'Disponible'}
                    {s.status === 'BLOCKED' && 'Bloqueado'}
                    {s.status === 'RESERVED' && appt && (
                      <>Reservado · {appt.patient?.firstName} {appt.patient?.lastName} · CI {appt.patient?.documentId}</>
                    )}
                    {s.status === 'RESERVED' && !appt && 'Reservado'}
                  </p>
                </div>
                <span className="status-pill bg-white/80 text-on-surface-variant self-center">{s.status}</span>
              </div>
            )
          })}
          {slots.length === 0 && <p className="text-sm text-outline p-4">Sin slots en este rango</p>}
        </div>
      </div>
    </PageShell>
  )
}
