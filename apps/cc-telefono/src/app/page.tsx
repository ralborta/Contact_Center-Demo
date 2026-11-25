'use client'

import { Conversation } from '@elevenlabs/client'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_PHONE = '59170111222'
const HOSPITAL = 'Hospital Central La Paz'

type CallPhase = 'idle' | 'connecting' | 'active' | 'ended' | 'error'

function apiBase() {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  if (!url.startsWith('http')) return `https://${url}`
  return url.replace(/\/$/, '')
}

function formatTimer(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TelefonoPage() {
  const [callerPhone, setCallerPhone] = useState(DEFAULT_PHONE)
  const [callerName, setCallerName] = useState('Juan Pérez')
  const [showSettings, setShowSettings] = useState(false)
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [mode, setMode] = useState<'listening' | 'speaking' | 'idle'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [statusHint, setStatusHint] = useState('Listo para llamar')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(
    null,
  )
  const conversationIdRef = useRef<string | null>(null)
  const connectedAtRef = useRef<number | null>(null)
  const callerPhoneRef = useRef(callerPhone)
  const endingRef = useRef(false)

  useEffect(() => {
    callerPhoneRef.current = callerPhone
  }, [callerPhone])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${apiBase()}/api/voice/public/session`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.defaultCallerPhone && callerPhoneRef.current === DEFAULT_PHONE) {
          setCallerPhone(data.defaultCallerPhone)
        }
      } catch {
        /* defaults */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (phase !== 'active' && phase !== 'connecting') return
    const id = window.setInterval(() => {
      if (!connectedAtRef.current) return
      setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const reportEnd = useCallback(async (conversationIdValue: string | null, durationSec: number) => {
    if (!conversationIdValue) return
    try {
      await fetch(`${apiBase()}/api/voice/public/end-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationIdValue,
          callerPhone: callerPhoneRef.current,
          durationSec,
        }),
      })
    } catch {
      /* el post-call de ElevenLabs completa el registro */
    }
  }, [])

  const hangUp = useCallback(async () => {
    if (endingRef.current) return
    endingRef.current = true
    const conv = conversationRef.current
    const id =
      conversationIdRef.current || (conv?.getId?.() ? String(conv.getId()) : null)
    const dur = connectedAtRef.current
      ? Math.floor((Date.now() - connectedAtRef.current) / 1000)
      : elapsed
    conversationRef.current = null
    connectedAtRef.current = null
    setMode('idle')
    setPhase('ended')
    setStatusHint('Llamada finalizada')
    try {
      await conv?.endSession?.()
    } catch {
      /* already closed */
    }
    await reportEnd(id, dur)
    endingRef.current = false
  }, [elapsed, reportEnd])

  const startCall = useCallback(async () => {
    if (phase === 'connecting' || phase === 'active') return
    endingRef.current = false
    setErrorMsg(null)
    setPhase('connecting')
    setStatusHint('Conectando…')
    setElapsed(0)
    conversationIdRef.current = null
    setMode('idle')
    setShowSettings(false)

    try {
      const res = await fetch(`${apiBase()}/api/voice/public/session`)
      if (!res.ok) throw new Error('No se pudo iniciar la llamada')
      const session = await res.json()
      if (!session.signedUrl && !session.agentId) {
        throw new Error('No se pudo iniciar la llamada')
      }

      // Nunca enviar system__* desde el cliente: ElevenLabs responde
      // "Invalid message received" y la conversación queda failed.
      const dynamicVariables: Record<string, string> = {
        caller_phone: String(callerPhone),
        telefono: String(callerPhone),
      }

      const sessionOpts = session.agentId
        ? { agentId: String(session.agentId) }
        : { signedUrl: String(session.signedUrl) }

      if (session.conversationId) {
        conversationIdRef.current = String(session.conversationId)
      }

      const conv = await Conversation.startSession({
        ...sessionOpts,
        dynamicVariables,
        onConnect: ({ conversationId: id }) => {
          if (id) conversationIdRef.current = id
          connectedAtRef.current = Date.now()
          setPhase('active')
          setStatusHint('En llamada')
          setMode('listening')
        },
        onDisconnect: () => {
          if (!endingRef.current) void hangUp()
        },
        onError: () => {
          setErrorMsg('No se pudo completar la llamada. Intentá de nuevo.')
          setPhase('error')
          setStatusHint('No se pudo completar')
        },
        onModeChange: ({ mode: next }) => {
          if (next === 'speaking') setMode('speaking')
          else if (next === 'listening') setMode('listening')
          else setMode('idle')
        },
        onStatusChange: ({ status }) => {
          if (status === 'connected') {
            setPhase('active')
            setStatusHint('En llamada')
          }
          if (status === 'disconnected') {
            if (!endingRef.current) void hangUp()
          }
        },
      })

      conversationRef.current = conv
      const id = conv.getId?.()
      if (id) conversationIdRef.current = String(id)
    } catch {
      setPhase('error')
      setStatusHint('Error al llamar')
      setErrorMsg('No se pudo iniciar la llamada. Intentá de nuevo.')
      conversationRef.current = null
    }
  }, [callerPhone, hangUp, phase])

  useEffect(() => {
    return () => {
      void conversationRef.current?.endSession?.()
    }
  }, [])

  const inCall = phase === 'active' || phase === 'connecting'
  const orbClass = [
    'orb',
    inCall ? 'orb-on' : '',
    mode === 'speaking' ? 'orb-speaking' : '',
    mode === 'listening' && phase === 'active' ? 'orb-listening' : '',
    phase === 'connecting' ? 'orb-connecting' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className="phone-stage">
      <div className="phone-shell" aria-label="Teléfono del paciente">
        <div className="phone-notch" />
        <div className="phone-screen">
          <header className="phone-status">
            <span className="carrier">Movistar</span>
            <span className="clock">{formatTimer(inCall ? elapsed : 0)}</span>
            <button
              type="button"
              className="gear"
              aria-label="Quién llama"
              title="Quién llama"
              onClick={() => setShowSettings((v) => !v)}
            >
              <span className="gear-icon" aria-hidden />
            </button>
          </header>

          <section className="call-hero">
            <p className="hospital-eyebrow">Llamando a</p>
            <h1 className="hospital-name">{HOSPITAL}</h1>
            <p className="call-status">
              {phase === 'active'
                ? formatTimer(elapsed)
                : phase === 'connecting'
                  ? 'Conectando…'
                  : statusHint}
            </p>
            <div className={orbClass} aria-hidden>
              <span className="orb-core" />
              <span className="orb-ring" />
              <span className="orb-ring delay" />
            </div>
            {mode === 'speaking' && phase === 'active' && (
              <p className="mode-hint">Agente hablando…</p>
            )}
            {mode === 'listening' && phase === 'active' && (
              <p className="mode-hint">Escuchando…</p>
            )}
            {errorMsg && <p className="error-hint">{errorMsg}</p>}
          </section>

          {showSettings && (
            <div className="settings-panel" role="dialog" aria-label="Quién llama">
              <p className="settings-title">Quién llama</p>
              <label>
                Nombre
                <input
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  autoComplete="name"
                  disabled={inCall}
                />
              </label>
              <label>
                Número
                <input
                  value={callerPhone}
                  onChange={(e) => setCallerPhone(e.target.value.replace(/[^\d+]/g, ''))}
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={inCall}
                />
              </label>
              <button type="button" className="settings-close" onClick={() => setShowSettings(false)}>
                Listo
              </button>
            </div>
          )}

          <div className="call-actions">
            {!inCall ? (
              <button
                type="button"
                className="btn-call"
                onClick={() => void startCall()}
                aria-label="Llamar"
              >
                <span className="btn-icon" aria-hidden>
                  ☎
                </span>
                Llamar
              </button>
            ) : (
              <button
                type="button"
                className="btn-hang"
                onClick={() => void hangUp()}
                aria-label="Colgar"
              >
                <span className="btn-icon" aria-hidden>
                  ✕
                </span>
                Colgar
              </button>
            )}
          </div>

          <p className="caller-hint">
            Desde {callerName} · {callerPhone}
          </p>
        </div>
      </div>
    </main>
  )
}
