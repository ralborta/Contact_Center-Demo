'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Phone } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { APPT_STATUS_LABEL, callsApi, formatLaPaz } from '@/lib/api'

type Turn = { role: 'agent' | 'user' | 'tool'; text: string; t?: number }

function parseTurns(raw?: string | null): Turn[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => x && x.text)
        .map((x) => ({
          role: x.role === 'user' || x.role === 'tool' ? x.role : 'agent',
          text: String(x.text),
          t: typeof x.t === 'number' ? x.t : undefined,
        }))
    }
  } catch {
    /* plain text fallback */
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(agent|user|assistant|paciente|agente)\s*[:\-]\s*(.*)$/i)
      if (m) {
        const role = /user|paciente/i.test(m[1]) ? 'user' : 'agent'
        return { role: role as 'user' | 'agent', text: m[2] }
      }
      return { role: 'agent' as const, text: line }
    })
}

function formatRel(sec?: number) {
  if (sec == null || Number.isNaN(sec)) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const RESULT_LABEL: Record<string, string> = {
  APPOINTMENT_BOOKED: 'Cita reservada',
  RESCHEDULED: 'Cita reprogramada',
  CANCELLED: 'Cita cancelada',
  RESOLVED: 'Resuelta',
  NO_AVAILABILITY: 'Sin disponibilidad',
}

export default function LlamadaDetallePage() {
  const params = useParams()
  const id = String(params?.id || '')
  const [call, setCall] = useState<any>(null)

  useEffect(() => {
    if (id) callsApi.get(id).then(setCall).catch(console.error)
  }, [id])

  const turns = useMemo(
    () => parseTurns(call?.callDetail?.transcriptText),
    [call?.callDetail?.transcriptText],
  )

  const toolEvents = (call?.events || []).filter((e: any) => e.type === 'TOOL')

  return (
    <PageShell
      title="Detalle de llamada"
      subtitle={call?.startedAt ? formatLaPaz(call.startedAt) : '…'}
      actions={
        <Link href="/llamadas" className="btn-secondary">
          Volver
        </Link>
      }
    >
      {!call ? (
        <p className="text-sm text-outline">Cargando…</p>
      ) : (
        <div className="space-y-5 max-w-4xl">
          <section className="surface-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label-caps mb-1">Resumen</p>
                <p className="text-sm text-on-surface leading-relaxed">
                  {call.callDetail?.summary || 'Sin resumen disponible'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="status-pill bg-primary-50 text-primary border border-primary/20">
                  {call.direction === 'INBOUND' ? 'Entrante' : 'Saliente'}
                </span>
                <span className="status-pill bg-green-50 text-status-success border border-status-success/20">
                  {RESULT_LABEL[call.resultCode] || call.outcome || 'Completada'}
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-4 gap-3 text-sm border-t border-outline-variant/40 pt-4">
              <div>
                <p className="label-caps">Caller</p>
                <p className="font-medium tabular-nums">{call.from}</p>
              </div>
              <div>
                <p className="label-caps">Paciente</p>
                <p className="font-medium">
                  {call.patient
                    ? `${call.patient.firstName} ${call.patient.lastName}`
                    : 'No identificado'}
                </p>
              </div>
              <div>
                <p className="label-caps">Duración</p>
                <p className="font-medium">
                  {call.callDetail?.durationSec != null
                    ? formatRel(call.callDetail.durationSec)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="label-caps">Fecha</p>
                <p className="font-medium">
                  {call.startedAt
                    ? formatLaPaz(call.startedAt, { dateStyle: 'medium', timeStyle: 'short' })
                    : '—'}
                </p>
              </div>
            </div>
          </section>

          {call.appointment && (
            <Link
              href={`/citas`}
              className="surface-card p-4 flex flex-wrap items-center justify-between gap-3 hover:border-primary/40 transition-colors border-l-4 border-l-primary"
            >
              <div className="flex items-start gap-3">
                <div className="bg-primary-50 text-primary p-2 rounded-lg">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <p className="label-caps mb-0.5">Cita vinculada</p>
                  <p className="font-semibold text-sm">
                    {call.appointment.specialty?.name} · Dr(a).{' '}
                    {call.appointment.doctor?.lastName}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {call.appointment.patient
                      ? `${call.appointment.patient.firstName} ${call.appointment.patient.lastName}`
                      : ''}
                    {call.appointment.slot
                      ? ` · ${formatLaPaz(call.appointment.slot.startsAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}`
                      : ''}
                  </p>
                </div>
              </div>
              <span className="status-pill bg-primary-100 text-primary">
                {APPT_STATUS_LABEL[call.appointment.status] || call.appointment.status}
              </span>
            </Link>
          )}

          <section className="surface-card overflow-hidden">
            <header className="px-4 py-3 border-b border-outline-variant/50 bg-surface-muted/40 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <p className="label-caps">Conversación</p>
            </header>
            <div className="p-4 space-y-3 max-h-[560px] overflow-y-auto">
              {turns.length === 0 && (
                <p className="text-sm text-outline">Sin transcripción</p>
              )}
              {turns.map((turn, i) => {
                if (turn.role === 'tool') {
                  return (
                    <div key={i} className="flex justify-center">
                      <span className="text-[11px] font-semibold tracking-wide uppercase text-on-surface-variant bg-surface-muted border border-outline-variant/50 rounded-md px-3 py-1">
                        {turn.text}
                        {turn.t != null && (
                          <span className="ml-2 tabular-nums opacity-70">
                            {formatRel(turn.t)}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                }
                const isUser = turn.role === 'user'
                return (
                  <div
                    key={i}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-primary text-on-primary rounded-br-md'
                          : 'bg-primary-50 text-on-surface rounded-bl-md border border-primary/10'
                      }`}
                    >
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                          isUser ? 'text-on-primary/70' : 'text-primary'
                        }`}
                      >
                        {isUser ? 'Paciente' : 'Agente'}
                        {turn.t != null && (
                          <span className="ml-2 tabular-nums font-semibold">
                            {formatRel(turn.t)}
                          </span>
                        )}
                      </p>
                      {turn.text}
                    </div>
                  </div>
                )
              })}
              {toolEvents.length > 0 && turns.every((t) => t.role !== 'tool') && (
                <div className="pt-2 space-y-1 border-t border-outline-variant/40">
                  {toolEvents.map((e: any) => (
                    <p key={e.id} className="text-[11px] text-center text-on-surface-variant">
                      {(e.payload as any)?.label || e.type}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>

          {call.callDetail?.recordingUrl && (
            <section className="surface-card p-4">
              <p className="label-caps mb-2">Grabación</p>
              <audio controls className="w-full" src={call.callDetail.recordingUrl} />
            </section>
          )}
        </div>
      )}
    </PageShell>
  )
}
