'use client'

import { useEffect, useState } from 'react'
import { Eye, Phone } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { Avatar, IconAction, StatusBadge } from '@/components/ui'
import { callsApi, formatLaPaz } from '@/lib/api'

export default function LlamadasPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    callsApi
      .list({ limit: '50' })
      .then((rows) =>
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
    <PageShell
      icon={Phone}
      title="Llamadas"
      subtitle="Historial de conversaciones telefónicas"
    >
      <div className="surface-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Dirección</th>
                <th>Paciente / Tel</th>
                <th>Duración</th>
                <th>Resultado</th>
                <th className="text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">
                    {c.startedAt ? formatLaPaz(c.startedAt, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td>
                    <StatusBadge
                      status={c.direction}
                      label={c.direction === 'INBOUND' ? 'Entrante' : 'Saliente'}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {c.patient ? (
                        <>
                          <Avatar
                            firstName={c.patient.firstName}
                            lastName={c.patient.lastName}
                            size="sm"
                          />
                          <span className="font-medium truncate">
                            {c.patient.firstName} {c.patient.lastName}
                          </span>
                        </>
                      ) : (
                        <span className="text-on-surface-variant tabular-nums">{c.from}</span>
                      )}
                    </div>
                  </td>
                  <td className="tabular-nums">
                    {c.callDetail?.durationSec ? `${c.callDetail.durationSec}s` : '—'}
                  </td>
                  <td>{c.outcome || c.resultCode || '—'}</td>
                  <td className="text-right">
                    <IconAction
                      icon={Eye}
                      label="Detalle"
                      href={`/llamadas/${c.id}`}
                      tone="primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="p-4 text-sm text-outline">Cargando…</p>}
          {!loading && items.length === 0 && <p className="p-4 text-sm text-outline">Sin llamadas</p>}
        </div>
      </div>
    </PageShell>
  )
}