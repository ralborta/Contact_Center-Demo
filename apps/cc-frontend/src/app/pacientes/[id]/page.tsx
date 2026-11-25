'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { APPT_STATUS_LABEL, formatLaPaz, patientsApi } from '@/lib/api'

export default function PacienteFichaPage() {
  const id = String(useParams()?.id || '')
  const [p, setP] = useState<any>(null)

  useEffect(() => {
    if (id) patientsApi.get(id).then(setP)
  }, [id])

  if (!p) {
    return (
      <PageShell title="Paciente">
        <p className="text-sm text-outline">Cargando…</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={`${p.firstName} ${p.lastName}`}
      subtitle={`CI ${p.documentId} · ${p.phone}`}
      actions={<Link href="/pacientes" className="btn-secondary">Volver</Link>}
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="surface-card p-5 space-y-2 text-sm">
          <p><span className="label-caps">Seguro</span><br />{p.insurance || 'Sin seguro'}</p>
          <p><span className="label-caps">Email</span><br />{p.email || '—'}</p>
          <p><span className="label-caps">Notas</span><br />{p.notes || '—'}</p>
        </section>
        <section className="surface-card p-5 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold mb-3">Historial de citas</h3>
          <div className="space-y-2">
            {(p.appointments || []).map((a: any) => (
              <div key={a.id} className="border border-outline-variant/50 rounded-lg px-3 py-2 text-sm flex justify-between gap-2">
                <div>
                  <p className="font-medium">{a.specialty?.name} · Dr(a). {a.doctor?.lastName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {a.slot ? formatLaPaz(a.slot.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </p>
                  {a.interactions?.[0] && (
                    <Link
                      href={`/llamadas/${a.interactions[0].id}`}
                      className="text-xs font-semibold text-primary hover:underline mt-1 inline-block"
                    >
                      Ver llamada que la originó
                    </Link>
                  )}
                </div>
                <span className="status-pill bg-primary-100 text-primary h-fit">
                  {APPT_STATUS_LABEL[a.status] || a.status}
                </span>
              </div>
            ))}
          </div>
          <h3 className="font-display text-lg font-semibold mt-6 mb-3">Llamadas</h3>
          <div className="space-y-2">
            {(p.interactions || []).map((i: any) => (
              <Link key={i.id} href={`/llamadas/${i.id}`} className="block border border-outline-variant/50 rounded-lg px-3 py-2 text-sm hover:bg-primary-50/50">
                {i.startedAt ? formatLaPaz(i.startedAt) : '—'} · {i.direction} · {i.outcome || '—'}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  )
}
