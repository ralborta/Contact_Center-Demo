'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import { analyticsApi } from '@/lib/api'

export default function AnaliticaPage() {
  const [kpis, setKpis] = useState<any>(null)

  useEffect(() => {
    analyticsApi.kpis(30).then(setKpis)
  }, [])

  const cards = kpis
    ? [
        { label: 'Citas creadas', value: kpis.appointmentsCreated },
        { label: 'Cancel. paciente', value: kpis.cancellationsPatient },
        { label: 'Cancel. doctor', value: kpis.cancellationsDoctor },
        { label: 'No-shows', value: kpis.noShows },
        { label: 'Llamadas', value: kpis.callsTotal },
        { label: 'Duración media', value: `${kpis.avgCallDurationSec}s` },
      ]
    : []

  return (
    <PageShell title="Analítica" subtitle={`KPIs últimos ${kpis?.periodDays ?? 30} días · moneda Bs`}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="surface-card p-5">
            <p className="text-3xl font-display font-semibold">{c.value}</p>
            <p className="label-caps mt-2">{c.label}</p>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
