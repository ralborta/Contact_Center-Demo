'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, CalendarCheck, XCircle, Bot, UserRound, Activity, MessageCircle } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { analyticsApi } from '@/lib/api'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    analyticsApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e.message || 'Error al cargar'))
    const t = setInterval(() => {
      analyticsApi.dashboard().then(setData).catch(() => {})
    }, 30000)
    return () => clearInterval(t)
  }, [])

  const cards = data
    ? [
        { label: 'Llamadas hoy', value: data.callsToday, icon: Phone, tone: 'bg-primary/10 text-primary' },
        { label: 'En curso', value: data.callsInProgress, icon: Activity, tone: 'bg-status-info/10 text-status-info', live: data.callsInProgress > 0 },
        { label: 'Citas hoy', value: data.appointmentsToday, icon: CalendarCheck, tone: 'bg-status-success/10 text-status-success' },
        { label: 'Canceladas hoy', value: (data.cancelledByPatientToday || 0) + (data.cancelledByDoctorToday || 0), icon: XCircle, tone: 'bg-status-error/10 text-status-error' },
        { label: 'Resolución IA', value: `${data.aiResolutionRate}%`, icon: Bot, tone: 'bg-accent-soft text-accent' },
        { label: 'Derivaciones', value: data.humanTransfersToday, icon: UserRound, tone: 'bg-secondary-container text-on-secondary-container' },
      ]
    : []

  return (
    <PageShell
      title="Dashboard en vivo"
      subtitle="Operación del centro de citas · America/La_Paz"
      actions={
        <Link href="/citas?needsReschedule=true" className="btn-secondary">
          Reprogramar afectados ({data?.needsReschedule ?? '…'})
        </Link>
      }
    >
      {error && <p className="text-status-error mb-4">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${c.tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {c.live && <span className="w-2 h-2 rounded-full bg-status-success animate-pulse-soft" />}
              </div>
              <p className="text-2xl font-display font-semibold">{c.value}</p>
              <p className="label-caps mt-1">{c.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="surface-card p-5">
          <h3 className="font-display text-lg font-semibold mb-1">Ocupación por especialidad</h3>
          <p className="text-sm text-on-surface-variant mb-4">Slots del día</p>
          <div className="space-y-3">
            {(data?.occupancyBySpecialty || []).map((s: any) => (
              <div key={s.specialtyId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-on-surface-variant">{s.occupancyPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className="h-full bg-primary-container rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, s.occupancyPct)}%` }}
                  />
                </div>
              </div>
            ))}
            {!data && <p className="text-sm text-outline">Cargando…</p>}
          </div>
        </section>

        <section className="surface-card p-5">
          <h3 className="font-display text-lg font-semibold mb-1">Resumen rápido</h3>
          <p className="text-sm text-on-surface-variant mb-4">Indicadores del día</p>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Reservas nuevas</span>
              <strong>{data?.reservedToday ?? '—'}</strong>
            </li>
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Canceladas por paciente</span>
              <strong>{data?.cancelledByPatientToday ?? '—'}</strong>
            </li>
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Canceladas por doctor</span>
              <strong>{data?.cancelledByDoctorToday ?? '—'}</strong>
            </li>
            <li className="flex justify-between">
              <span>Llamadas (7 días)</span>
              <strong>{data?.callsLast7Days ?? '—'}</strong>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/llamadas" className="btn-primary">Ver llamadas</Link>
            <Link href="/agenda" className="btn-secondary">Abrir agenda</Link>
          </div>
        </section>

        <section className="surface-card p-5 md:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h3 className="font-display text-lg font-semibold">Confirmaciones WhatsApp</h3>
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm text-on-surface-variant mb-4">Estado de las conversaciones de confirmación</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Confirmadas', value: data?.whatsapp?.confirmed },
              { label: 'Canceladas', value: data?.whatsapp?.cancelled },
              { label: 'Reprogramadas', value: data?.whatsapp?.rescheduled },
              { label: 'Sin respuesta', value: data?.whatsapp?.pending },
              { label: 'Cambios por doctor', value: data?.whatsapp?.doctorChanges },
            ].map((x) => (
              <div key={x.label} className="rounded-lg bg-surface-muted/60 px-3 py-3">
                <p className="text-xl font-display font-semibold">{x.value ?? '—'}</p>
                <p className="label-caps mt-1">{x.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/whatsapp" className="btn-secondary">Abrir WhatsApp</Link>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
