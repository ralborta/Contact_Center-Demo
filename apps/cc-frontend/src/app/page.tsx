'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Phone,
  CalendarCheck,
  XCircle,
  Bot,
  UserRound,
  Activity,
  MessageCircle,
  LayoutDashboard,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'
import PageShell from '@/components/PageShell'
import { analyticsApi } from '@/lib/api'
import { KpiCard, Sparkline, specialtyBarColor } from '@/components/ui'

function greetingForHour(h: number) {
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    analyticsApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e.message || 'Error al cargar'))
    const t = setInterval(() => {
      analyticsApi.dashboard().then(setData).catch(() => {})
      setNow(new Date())
    }, 30000)
    return () => clearInterval(t)
  }, [])

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    [now],
  )

  const hourLaPaz = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    }).formatToParts(now)
    return Number(parts.find((p) => p.type === 'hour')?.value || 12)
  }, [now])

  const sparkValues = useMemo(() => {
    const base = Number(data?.callsLast7Days || 0)
    const today = Number(data?.callsToday || 0)
    // Serie demo visual a partir de totales reales (7 días)
    const avg = Math.max(1, Math.round(base / 7))
    return [avg - 2, avg + 1, avg, avg + 3, avg - 1, avg + 2, today].map((n) =>
      Math.max(0, n),
    )
  }, [data])

  const cards = data
    ? [
        {
          label: 'Llamadas hoy',
          value: data.callsToday,
          icon: Phone,
          tone: 'blue' as const,
        },
        {
          label: 'En curso',
          value: data.callsInProgress,
          icon: Activity,
          tone: 'teal' as const,
          live: data.callsInProgress > 0,
        },
        {
          label: 'Citas hoy',
          value: data.appointmentsToday,
          icon: CalendarCheck,
          tone: 'green' as const,
        },
        {
          label: 'Canceladas hoy',
          value:
            (data.cancelledByPatientToday || 0) + (data.cancelledByDoctorToday || 0),
          icon: XCircle,
          tone: 'red' as const,
        },
        {
          label: 'Resolución IA',
          value: `${data.aiResolutionRate}%`,
          icon: Bot,
          tone: 'violet' as const,
        },
        {
          label: 'Derivaciones',
          value: data.humanTransfersToday,
          icon: UserRound,
          tone: 'amber' as const,
        },
      ]
    : []

  return (
    <PageShell
      icon={LayoutDashboard}
      title={`${greetingForHour(hourLaPaz)}`}
      subtitle={`${dateLabel} · Centro de turnos · Argentina`}
      actions={
        <Link href="/citas?needsReschedule=true" className="btn-secondary">
          <CalendarClock className="w-3.5 h-3.5" />
          Reprogramar afectados ({data?.needsReschedule ?? '…'})
        </Link>
      }
    >
      {error && <p className="text-status-error mb-4">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        {cards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            tone={c.tone}
            live={c.live}
          />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="surface-card p-5 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-lg font-semibold">Ocupación por especialidad</h3>
          </div>
          <p className="text-sm text-on-surface-variant mb-4">Slots del día · barras coloreadas</p>
          <div className="space-y-3.5">
            {(data?.occupancyBySpecialty || []).map((s: any, i: number) => {
              const color = specialtyBarColor(s.name || String(i), i)
              return (
                <div key={s.specialtyId || i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      {s.name}
                    </span>
                    <span className="text-on-surface-variant tabular-nums font-semibold">
                      {s.occupancyPct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, s.occupancyPct)}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
            {!data && <p className="text-sm text-outline">Cargando…</p>}
          </div>
        </section>

        <section className="surface-card p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-display text-lg font-semibold">Llamadas · 7 días</h3>
              <p className="text-sm text-on-surface-variant">Tendencia y resumen del día</p>
            </div>
            <div className="p-2 rounded-full bg-sky-100 text-sky-700">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 mb-4 rounded-xl bg-sky-50/80 border border-sky-100 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-2xl font-display font-semibold text-sky-800 tabular-nums">
                {data?.callsLast7Days ?? '—'}
              </p>
              <p className="label-caps mt-0.5">Total semana</p>
            </div>
            <Sparkline values={sparkValues} className="w-32 h-10" stroke="#2B6CB0" />
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Reservas nuevas</span>
              <strong className="tabular-nums">{data?.reservedToday ?? '—'}</strong>
            </li>
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Canceladas por paciente</span>
              <strong className="tabular-nums text-red-700">
                {data?.cancelledByPatientToday ?? '—'}
              </strong>
            </li>
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Canceladas por doctor</span>
              <strong className="tabular-nums text-orange-700">
                {data?.cancelledByDoctorToday ?? '—'}
              </strong>
            </li>
            <li className="flex justify-between">
              <span>Llamadas hoy</span>
              <strong className="tabular-nums text-sky-700">{data?.callsToday ?? '—'}</strong>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/llamadas" className="btn-primary">
              <Phone className="w-3.5 h-3.5" />
              Ver llamadas
            </Link>
            <Link href="/agenda" className="btn-secondary">
              Abrir agenda
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>

        <section className="surface-card p-5 md:col-span-2 shadow-soft border-l-[3px] border-l-[#25D366]">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h3 className="font-display text-lg font-semibold">Confirmaciones WhatsApp</h3>
            <div className="p-2 rounded-full bg-[#DCF8C6] text-[#128C7E]">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-sm text-on-surface-variant mb-4">
            Estado de las conversaciones de confirmación
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: 'Confirmadas',
                value: data?.whatsapp?.confirmed,
                tone: 'green' as const,
                icon: CalendarCheck,
              },
              {
                label: 'Canceladas',
                value: data?.whatsapp?.cancelled,
                tone: 'red' as const,
                icon: XCircle,
              },
              {
                label: 'Reprogramadas',
                value: data?.whatsapp?.rescheduled,
                tone: 'amber' as const,
                icon: CalendarClock,
              },
              {
                label: 'Sin respuesta',
                value: data?.whatsapp?.pending,
                tone: 'slate' as const,
                icon: Activity,
              },
              {
                label: 'Cambios por doctor',
                value: data?.whatsapp?.doctorChanges,
                tone: 'teal' as const,
                icon: UserRound,
              },
            ].map((x) => (
              <KpiCard
                key={x.label}
                label={x.label}
                value={x.value ?? '—'}
                icon={x.icon}
                tone={x.tone}
              />
            ))}
          </div>
          <div className="mt-4">
            <Link href="/whatsapp" className="btn-secondary">
              <MessageCircle className="w-3.5 h-3.5" />
              Abrir WhatsApp
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
