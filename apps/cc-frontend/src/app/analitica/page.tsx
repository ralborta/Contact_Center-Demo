'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Bot,
  CalendarCheck,
  Clock3,
  Phone,
  UserRound,
  XCircle,
} from 'lucide-react'
import PageShell from '@/components/PageShell'
import { KpiCard, Sparkline, specialtyBarColor } from '@/components/ui'
import { analyticsApi } from '@/lib/api'

export default function AnaliticaPage() {
  const [kpis, setKpis] = useState<any>(null)
  const [dash, setDash] = useState<any>(null)

  useEffect(() => {
    analyticsApi.kpis(30).then(setKpis).catch(console.error)
    analyticsApi.dashboard().then(setDash).catch(() => {})
  }, [])

  const spark = useMemo(() => {
    const total = Number(kpis?.callsTotal || 0)
    const avg = Math.max(1, Math.round(total / 30))
    return [avg - 1, avg + 2, avg, avg + 1, avg - 2, avg + 3, avg].map((n) =>
      Math.max(0, n),
    )
  }, [kpis])

  const occupancy = dash?.occupancyBySpecialty || []

  return (
    <PageShell
      icon={BarChart3}
      title="Analítica"
      subtitle={`Indicadores de los últimos ${kpis?.periodDays ?? 30} días · La Paz, Bolivia`}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard
          label="Citas creadas"
          value={kpis?.appointmentsCreated ?? '—'}
          icon={CalendarCheck}
          tone="green"
        />
        <KpiCard
          label="Cancel. paciente"
          value={kpis?.cancellationsPatient ?? '—'}
          icon={XCircle}
          tone="red"
        />
        <KpiCard
          label="Cancel. doctor"
          value={kpis?.cancellationsDoctor ?? '—'}
          icon={UserRound}
          tone="amber"
        />
        <KpiCard
          label="Ausencias"
          value={kpis?.noShows ?? '—'}
          icon={Clock3}
          tone="slate"
        />
        <KpiCard
          label="Llamadas"
          value={kpis?.callsTotal ?? '—'}
          icon={Phone}
          tone="blue"
        />
        <KpiCard
          label="Duración media"
          value={
            kpis?.avgCallDurationSec != null ? `${kpis.avgCallDurationSec}s` : '—'
          }
          icon={Bot}
          tone="violet"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="surface-card p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-display text-lg font-semibold">Llamadas del período</h3>
              <p className="text-sm text-on-surface-variant">Volumen y tendencia</p>
            </div>
            <div className="p-2 rounded-full bg-sky-100 text-sky-700">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-sky-50/80 border border-sky-100 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-2xl font-display font-semibold text-sky-800 tabular-nums">
                {kpis?.callsTotal ?? '—'}
              </p>
              <p className="label-caps mt-0.5">Total llamadas</p>
            </div>
            <Sparkline values={spark} className="w-32 h-10" stroke="#2B6CB0" />
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Duración media</span>
              <strong className="tabular-nums">
                {kpis?.avgCallDurationSec != null ? `${kpis.avgCallDurationSec}s` : '—'}
              </strong>
            </li>
            <li className="flex justify-between border-b border-outline-variant/50 pb-2">
              <span>Citas creadas</span>
              <strong className="tabular-nums text-emerald-700">
                {kpis?.appointmentsCreated ?? '—'}
              </strong>
            </li>
            <li className="flex justify-between">
              <span>Ausencias</span>
              <strong className="tabular-nums text-amber-800">
                {kpis?.noShows ?? '—'}
              </strong>
            </li>
          </ul>
        </section>

        <section className="surface-card p-5 shadow-soft">
          <h3 className="font-display text-lg font-semibold mb-1">Ocupación por especialidad</h3>
          <p className="text-sm text-on-surface-variant mb-4">Slots del día · misma paleta del panel</p>
          <div className="space-y-3.5">
            {occupancy.length === 0 && (
              <p className="text-sm text-outline">Sin datos de ocupación</p>
            )}
            {occupancy.map((s: any, i: number) => {
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
                        width: `${Math.min(100, s.occupancyPct || 0)}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </PageShell>
  )
}
