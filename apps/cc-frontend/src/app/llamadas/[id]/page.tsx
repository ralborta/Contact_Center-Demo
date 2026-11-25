'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Phone, Wrench } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { APPT_STATUS_LABEL, callsApi, formatLaPaz } from '@/lib/api'

type Turn = { role: 'agent' | 'user' | 'tool'; text: string; t?: number }

const TOOL_LABELS: Record<string, (args?: any) => string> = {
  consultar_disponibilidad: (a) =>
    `Buscó disponibilidad${a?.especialidad ? ` en ${a.especialidad}` : a?.doctor ? ` con ${a.doctor}` : ''}`,
  buscar_doctores: (a) =>
    `Buscó médicos${a?.especialidad ? ` de ${a.especialidad}` : a?.nombre || a?.doctor ? `: ${a.nombre || a.doctor}` : ''}`,
  listar_especialidades: () => 'Consultó especialidades',
  identificar_paciente: () => 'Identificó al paciente',
  reservar_cita: () => 'Reservó cita',
  reprogramar_cita: () => 'Reprogramó cita',
  cancelar_cita: () => 'Canceló cita',
  listar_citas_paciente: () => 'Consultó citas del paciente',
}

function parseArgs(raw: any) {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw
}

function toolLabel(name: string, args?: any) {
  const fn = TOOL_LABELS[name]
  return fn ? fn(args) : `Usó herramienta ${String(name || '').replace(/_/g, ' ')}`
}

function parseTurns(raw?: string | null): Turn[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const turns: Turn[] = []
      for (const x of parsed) {
        if (!x) continue
        const t = typeof x.t === 'number' ? x.t : typeof x.time_in_call_secs === 'number' ? x.time_in_call_secs : undefined
        if (Array.isArray(x.tool_calls)) {
          for (const tc of x.tool_calls) {
            const name = tc?.tool_name || tc?.name || 'herramienta'
            const args = parseArgs(tc?.params || tc?.arguments)
            turns.push({ role: 'tool', text: toolLabel(name, args).trim(), t })
          }
        }
        const text = x.text || x.message || ''
        const roleRaw = String(x.role || x.speaker || '').toLowerCase()
        if (roleRaw === 'tool' && text) {
          turns.push({ role: 'tool', text: String(text), t })
          continue
        }
        if (text && !(String(text).trim().startsWith('{') && String(text).trim().endsWith('}'))) {
          const role: 'user' | 'agent' =
            roleRaw === 'user' || roleRaw === 'paciente' ? 'user' : 'agent'
          turns.push({ role, text: String(text), t })
        }
      }
      return turns
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
  const toolFromTurns = turns.filter((t) => t.role === 'tool')
  const showToolStrip =
    toolFromTurns.length === 0 && toolEvents.length > 0

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

          {call.appointment ? (
            <Link
              href={`/citas?cita=${call.appointment.id}`}
              className="surface-card p-4 flex flex-wrap items-center justify-between gap-3 hover:border-primary/40 transition-colors border-l-4 border-l-primary block"
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
          ) : (
            <section className="surface-card p-4 border-dashed border border-outline-variant/60">
              <p className="label-caps mb-1">Cita vinculada</p>
              <p className="text-sm text-on-surface-variant">
                Esta llamada aún no tiene una cita asociada.
              </p>
            </section>
          )}

          <section className="surface-card overflow-hidden">
            <header className="px-4 py-3 border-b border-outline-variant/50 bg-surface-muted/40 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <p className="label-caps">Conversación</p>
            </header>
            <div className="p-4 space-y-3 max-h-[560px] overflow-y-auto bg-gradient-to-b from-surface-muted/30 to-transparent">
              {turns.length === 0 && (
                <p className="text-sm text-outline">Sin transcripción</p>
              )}
              {turns.map((turn, i) => {
                if (turn.role === 'tool') {
                  return (
                    <div key={i} className="flex justify-center py-1">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-on-surface-variant bg-surface-muted border border-outline-variant/50 rounded-full px-3 py-1.5 max-w-[90%]">
                        <Wrench className="w-3 h-3 shrink-0 text-primary" />
                        <span>{turn.text}</span>
                        {turn.t != null && (
                          <span className="ml-1 tabular-nums opacity-70">
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
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-primary text-on-primary rounded-br-md'
                          : 'bg-white text-on-surface rounded-bl-md border border-primary/10'
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
              {showToolStrip && (
                <div className="pt-3 space-y-2 border-t border-outline-variant/40">
                  <p className="label-caps text-center">Herramientas</p>
                  {toolEvents.map((e: any) => (
                    <div key={e.id} className="flex justify-center">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant bg-surface-muted border border-outline-variant/50 rounded-full px-3 py-1.5">
                        <Wrench className="w-3 h-3 text-primary" />
                        {(e.payload as any)?.label || e.type}
                      </span>
                    </div>
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
