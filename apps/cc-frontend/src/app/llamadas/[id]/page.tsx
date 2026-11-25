'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { callsApi, formatLaPaz } from '@/lib/api'

export default function LlamadaDetallePage() {
  const params = useParams()
  const id = String(params?.id || '')
  const [call, setCall] = useState<any>(null)

  useEffect(() => {
    if (id) callsApi.get(id).then(setCall).catch(console.error)
  }, [id])

  return (
    <PageShell
      title="Detalle de llamada"
      subtitle={call?.startedAt ? formatLaPaz(call.startedAt) : '…'}
      actions={<Link href="/llamadas" className="btn-secondary">Volver</Link>}
    >
      {!call ? (
        <p className="text-sm text-outline">Cargando…</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <section className="surface-card p-5 lg:col-span-1 space-y-3 text-sm">
            <div><span className="label-caps">Dirección</span><p>{call.direction === 'INBOUND' ? 'Entrante' : 'Saliente'}</p></div>
            <div><span className="label-caps">De</span><p>{call.from}</p></div>
            <div><span className="label-caps">A</span><p>{call.to}</p></div>
            <div><span className="label-caps">Paciente</span>
              <p>{call.patient ? `${call.patient.firstName} ${call.patient.lastName}` : 'No identificado'}</p>
            </div>
            <div><span className="label-caps">Duración</span><p>{call.callDetail?.durationSec ?? '—'} s</p></div>
            <div><span className="label-caps">Resultado</span><p>{call.outcome || call.resultCode || '—'}</p></div>
            {call.appointment && (
              <div>
                <span className="label-caps">Cita vinculada</span>
                <p>{call.appointment.specialty?.name} · {call.appointment.doctor?.lastName}</p>
              </div>
            )}
            {call.callDetail?.recordingUrl && (
              <div>
                <span className="label-caps">Grabación</span>
                <audio controls className="w-full mt-1" src={call.callDetail.recordingUrl} />
              </div>
            )}
          </section>
          <section className="surface-card p-5 lg:col-span-2 space-y-5">
            <div>
              <h3 className="font-display text-lg font-semibold mb-2">Resumen</h3>
              <p className="text-sm text-on-surface-variant whitespace-pre-wrap">
                {call.callDetail?.summary || 'Sin resumen'}
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold mb-2">Transcripción</h3>
              <pre className="text-sm bg-surface-muted/60 rounded-lg p-4 whitespace-pre-wrap font-sans max-h-[480px] overflow-auto">
                {call.callDetail?.transcriptText || 'Sin transcripción'}
              </pre>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  )
}
