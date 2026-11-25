'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, UserRound } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { voiceApi } from '@/lib/api'

type ConnState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error'

type LogLine = { at: string; text: string; tone?: 'info' | 'user' | 'agent' | 'error' }

const DEFAULT_PHONE = '59170111222'
const DEFAULT_NAME = 'Juan Pérez'

export default function TelefonoPage() {
  const [phone, setPhone] = useState(DEFAULT_PHONE)
  const [patientLabel, setPatientLabel] = useState(DEFAULT_NAME)
  const [state, setState] = useState<ConnState>('idle')
  const [muted, setMuted] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LogLine[]>([])
  const conversationRef = useRef<any>(null)

  const pushLog = useCallback((text: string, tone: LogLine['tone'] = 'info') => {
    const at = new Date().toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setLogs((prev) => [...prev.slice(-80), { at, text, tone }])
  }, [])

  useEffect(() => {
    return () => {
      try {
        conversationRef.current?.endSession?.()
      } catch {
        /* ignore */
      }
    }
  }, [])

  async function startCall() {
    setError('')
    setState('connecting')
    pushLog(`Marcando como ${patientLabel} (${phone})…`)
    try {
      const session = await voiceApi.signedUrl()
      if (session.agentId) setAgentId(session.agentId)
      if (session.defaultCallerPhone && phone === DEFAULT_PHONE) {
        setPhone(session.defaultCallerPhone)
      }
      if (!session.signedUrl) throw new Error('El servidor no devolvió signed URL')

      const { Conversation } = await import('@elevenlabs/client')
      const conversation = await Conversation.startSession({
        signedUrl: session.signedUrl,
        dynamicVariables: {
          caller_phone: phone,
          telefono: phone,
          system__caller_id: phone,
          paciente_nombre_simulado: patientLabel,
        },
        onConnect: () => {
          setState('connected')
          pushLog('Llamada conectada con el agente', 'agent')
        },
        onDisconnect: () => {
          setState('ended')
          pushLog('Llamada finalizada')
          conversationRef.current = null
        },
        onError: (err: any) => {
          const msg = err?.message || String(err)
          setError(msg)
          setState('error')
          pushLog(msg, 'error')
        },
        onMessage: (msg: any) => {
          const role = msg?.source || msg?.role || ''
          const text = msg?.message || msg?.text || ''
          if (!text) return
          if (role === 'user') pushLog(text, 'user')
          else pushLog(text, 'agent')
        },
      })
      conversationRef.current = conversation
      if (muted) conversation.setMicMuted?.(true)
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo iniciar la llamada'
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg))
      setState('error')
      pushLog(String(msg), 'error')
    }
  }

  async function endCall() {
    try {
      await conversationRef.current?.endSession?.()
    } catch {
      /* ignore */
    }
    conversationRef.current = null
    setState('ended')
    pushLog('Colgaste la llamada')
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    try {
      conversationRef.current?.setMicMuted?.(next)
      pushLog(next ? 'Micrófono silenciado' : 'Micrófono activo')
    } catch {
      /* ignore */
    }
  }

  function useJuan() {
    setPhone(DEFAULT_PHONE)
    setPatientLabel(DEFAULT_NAME)
    pushLog('Perfil simulado: Juan Pérez / 59170111222')
  }

  const ringing = state === 'connecting'
  const inCall = state === 'connected'

  return (
    <PageShell
      title="Simulador de teléfono"
      subtitle="Prueba el agente de citas como si llamara un paciente (misma línea gráfica del panel)"
      actions={
        <button type="button" className="btn-secondary" onClick={useJuan}>
          <UserRound className="w-3.5 h-3.5" />
          Usar Juan Pérez
        </button>
      }
    >
      <div className="grid lg:grid-cols-[360px_1fr] gap-5 max-w-5xl">
        <div className="surface-card p-6 flex flex-col items-center text-center border-t-4 border-primary">
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center mb-4 ${
              inCall
                ? 'bg-primary text-on-primary animate-pulse-soft'
                : ringing
                  ? 'bg-accent text-white animate-pulse-soft'
                  : 'bg-primary-50 text-primary'
            }`}
          >
            <Phone className="w-10 h-10" />
          </div>

          <p className="label-caps mb-1">Llamada simulada</p>
          <h3 className="font-display text-xl font-semibold text-on-surface">{patientLabel}</h3>
          <p className="text-sm text-on-surface-variant mt-1 tabular-nums">{phone}</p>
          <p className="text-[11px] text-outline mt-2">
            Hospital Central La Paz
            {agentId ? ` · ${agentId.slice(0, 18)}…` : ''}
          </p>

          <div className="w-full mt-6 space-y-3 text-left">
            <div>
              <label className="label-caps mb-1 block">Nombre simulado</label>
              <input
                className="field-input"
                value={patientLabel}
                onChange={(e) => setPatientLabel(e.target.value)}
                disabled={inCall || ringing}
              />
            </div>
            <div>
              <label className="label-caps mb-1 block">Teléfono (caller)</label>
              <input
                className="field-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={inCall || ringing}
                inputMode="tel"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-6 w-full">
            {!inCall && !ringing && (
              <button type="button" className="btn-primary flex-1" onClick={startCall}>
                <Phone className="w-4 h-4" />
                Llamar
              </button>
            )}
            {(inCall || ringing) && (
              <button type="button" className="btn-danger flex-1" onClick={endCall}>
                <PhoneOff className="w-4 h-4" />
                Colgar
              </button>
            )}
            {inCall && (
              <button type="button" className="btn-secondary" onClick={toggleMute}>
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {muted ? 'Activar mic' : 'Silenciar'}
              </button>
            )}
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Estado:{' '}
            <span className="text-primary">
              {state === 'idle' && 'En espera'}
              {state === 'connecting' && 'Conectando…'}
              {state === 'connected' && 'En llamada'}
              {state === 'ended' && 'Finalizada'}
              {state === 'error' && 'Error'}
            </span>
          </p>
          {error && (
            <p className="mt-2 text-xs text-status-error text-left w-full bg-red-50 border border-status-error/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="surface-card overflow-hidden flex flex-col min-h-[420px]">
          <header className="px-4 py-3 border-b border-outline-variant/50 bg-surface-muted/40 flex items-center justify-between">
            <p className="label-caps">Transcripción / eventos</p>
            <button
              type="button"
              className="text-[11px] font-semibold text-primary hover:underline"
              onClick={() => setLogs([])}
            >
              Limpiar
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {logs.length === 0 && (
              <p className="text-sm text-outline">
                Pulse «Llamar» para iniciar una conversación con el agente. El backend entrega la
                signed URL sin exponer la API key.
              </p>
            )}
            {logs.map((l, i) => (
              <div
                key={`${l.at}-${i}`}
                className={`rounded-lg px-3 py-2 text-sm border ${
                  l.tone === 'user'
                    ? 'bg-primary-50 border-primary/20 ml-6'
                    : l.tone === 'agent'
                      ? 'bg-green-50 border-status-success/20 mr-6'
                      : l.tone === 'error'
                        ? 'bg-red-50 border-status-error/20'
                        : 'bg-surface-muted/60 border-outline-variant/40'
                }`}
              >
                <span className="text-[10px] text-outline mr-2 tabular-nums">{l.at}</span>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
