'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import { campaignsApi, formatLaPaz } from '@/lib/api'

export default function CampanasPage() {
  const [items, setItems] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  async function load() {
    setItems(await campaignsApi.list())
  }
  useEffect(() => { load().catch(console.error) }, [])

  async function createReminder() {
    await campaignsApi.createReminders(24)
    load()
  }

  async function open(id: string) {
    setSelected(await campaignsApi.get(id))
  }

  return (
    <PageShell
      title="Campañas salientes"
      subtitle="Recordatorios, confirmaciones y avisos de cancelación"
      actions={<button className="btn-primary" onClick={createReminder}>Crear recordatorio 24h</button>}
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          {items.map((c) => {
            const counts = (c.jobs || []).reduce((acc: any, j: any) => {
              acc[j.status] = (acc[j.status] || 0) + 1
              return acc
            }, {})
            return (
              <button
                key={c.id}
                onClick={() => open(c.id)}
                className="surface-card p-4 w-full text-left hover:border-primary transition-colors"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <span className="status-pill bg-primary-100 text-primary">{c.status}</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  {c.type} · {c._count?.jobs ?? c.jobs?.length ?? 0} llamadas
                  {c.scheduledAt ? ` · ${formatLaPaz(c.scheduledAt, { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                </p>
                {Object.keys(counts).length > 0 && (
                  <p className="text-xs mt-2 text-on-surface-variant">
                    {Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </button>
            )
          })}
        </div>
        <div className="surface-card p-5">
          {!selected ? (
            <p className="text-sm text-outline">Seleccione una campaña</p>
          ) : (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-display text-lg font-semibold">{selected.name}</h3>
                  <p className="text-sm text-on-surface-variant">{selected.type}</p>
                </div>
                <button className="btn-secondary" onClick={() => campaignsApi.start(selected.id).then(() => open(selected.id))}>
                  Iniciar
                </button>
              </div>
              <div className="space-y-2 max-h-[520px] overflow-auto">
                {(selected.jobs || []).map((j: any) => (
                  <div key={j.id} className="border border-outline-variant/50 rounded-lg px-3 py-2 text-sm flex justify-between gap-2">
                    <div>
                      <p className="font-medium">{j.patient?.firstName} {j.patient?.lastName}</p>
                      <p className="text-xs text-on-surface-variant">{j.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="status-pill bg-surface-muted">{j.status}</span>
                      <div className="mt-1 space-x-1">
                        {['CONFIRMED', 'NO_ANSWER', 'VOICEMAIL', 'FAILED'].map((st) => (
                          <button
                            key={st}
                            className="text-[10px] text-primary underline"
                            onClick={() => campaignsApi.updateJob(j.id, { status: st }).then(() => open(selected.id))}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}
