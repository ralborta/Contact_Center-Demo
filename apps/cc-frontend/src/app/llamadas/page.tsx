'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { APPT_STATUS_LABEL, callsApi, formatLaPaz } from '@/lib/api'

export default function LlamadasPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    callsApi
      .list({ limit: '50' })
      .then((rows) =>
        // Defensa UI: ocultar stubs técnicos aunque el API no los filtre
        setItems(
          (rows || []).filter((c: any) => {
            const id = String(c.providerConversationId || '')
            if (/^test[-_]/i.test(id) || /^conv_test/i.test(id)) return false
            if (
              !c.patient &&
              (c.from === 'unknown' || c.from === 'pending')
            ) {
              return false
            }
            return true
          }),
        ),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageShell title="Llamadas" subtitle="Historial de conversaciones telefónicas">
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/80 text-left">
              <tr>
                <th className="px-4 py-3 label-caps">Fecha</th>
                <th className="px-4 py-3 label-caps">Dirección</th>
                <th className="px-4 py-3 label-caps">Paciente / Tel</th>
                <th className="px-4 py-3 label-caps">Duración</th>
                <th className="px-4 py-3 label-caps">Resultado</th>
                <th className="px-4 py-3 label-caps"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-outline-variant/40 hover:bg-primary-50/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.startedAt ? formatLaPaz(c.startedAt, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-pill ${c.direction === 'INBOUND' ? 'bg-primary-100 text-primary' : 'bg-accent-soft text-accent'}`}>
                      {c.direction === 'INBOUND' ? 'Entrante' : 'Saliente'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : c.from}
                  </td>
                  <td className="px-4 py-3">{c.callDetail?.durationSec ? `${c.callDetail.durationSec}s` : '—'}</td>
                  <td className="px-4 py-3">{c.outcome || c.resultCode || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/llamadas/${c.id}`} className="text-primary font-semibold hover:underline">
                      Detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="p-4 text-sm text-outline">Cargando…</p>}
          {!loading && items.length === 0 && <p className="p-4 text-sm text-outline">Sin llamadas</p>}
        </div>
      </div>
      {/* keep label map referenced for future badges */}
      <span className="hidden">{APPT_STATUS_LABEL.RESERVED}</span>
    </PageShell>
  )
}
