'use client'

import { Conversation } from '@elevenlabs/client'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_PHONE = '5491155551234'
const HOSPITAL = 'Hospital Santa María'

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

function formatClock(date: Date) {
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

export default function TelefonoPage() {
  const [callerPhone, setCallerPhone] = useState(DEFAULT_PHONE)
  const [callerName, setCallerName] = useState('Juan Pérez')
  const [showSettings, setShowSettings] = useState(false)
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [mode, setMode] = useState<'listening' | 'speaking' | 'idle'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [statusHint, setStatusHint] = useState('Tocá Llamar para empezar')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [showKeypad, setShowKeypad] = useState(false)
  const [now, setNow] = useState(() => new Date())

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
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

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
    setMuted(false)
    setShowKeypad(false)
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
    setStatusHint('Llamando…')
    setElapsed(0)
    conversationIdRef.current = null
    setMode('idle')
    setShowSettings(false)
    setShowKeypad(false)
    setMuted(false)

    try {
      const res = await fetch(`${apiBase()}/api/voice/public/session`)
      if (!res.ok) throw new Error('No se pudo iniciar la llamada')
      const session = await res.json()
      if (!session.signedUrl && !session.agentId) {
        throw new Error('No se pudo iniciar la llamada')
      }

      // Nunca enviar system__* desde el cliente.
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

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      const conv = conversationRef.current as { setMicMuted?: (v: boolean) => void } | null
      try {
        conv?.setMicMuted?.(next)
      } catch {
        /* visual only if SDK no expone mute */
      }
      return next
    })
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

  const statusText =
    phase === 'active'
      ? formatTimer(elapsed)
      : phase === 'connecting'
        ? 'Llamando…'
        : statusHint

  return (
    <main className="phone-stage">
      <div className="phone-shell" aria-label="Teléfono">
        <div className="dynamic-island" aria-hidden />
        <div className="phone-screen">
          <header className="phone-status">
            <span className="clock">{formatClock(now)}</span>
            <span aria-hidden />
            <div className="status-right" aria-hidden>
              <span className="signal">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="wifi">
                <span />
              </span>
              <span className="battery">
                <span className="fill" />
              </span>
            </div>
          </header>

          <section className="call-hero">
            <div className="avatar" aria-hidden>
              <svg className="avatar-mark" viewBox="0 0 48 48" fill="none">
                <path
                  d="M24 8c-1.2 0-2.2.7-2.7 1.8L18 18H9.5C7.6 18 6.5 20.1 7.5 21.7l7.2 11.4c.5.8 1.4 1.3 2.4 1.3h14c1 0 1.9-.5 2.4-1.3l7.2-11.4c1-1.6-.1-3.7-2-3.7H30l-3.3-8.2C26.2 8.7 25.2 8 24 8Z"
                  fill="currentColor"
                  opacity="0.95"
                />
                <path
                  d="M18 28h12M24 22v12"
                  stroke="#0a3d3d"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="hospital-name">{HOSPITAL}</h1>
            <p className={`call-status${phase === 'active' ? ' live' : ''}`}>{statusText}</p>

            <div className={orbClass} aria-hidden>
              <span className="orb-core" />
              <span className="orb-wave" />
              <span className="orb-wave delay" />
              <span className="orb-wave delay2" />
            </div>

            {mode === 'speaking' && phase === 'active' && (
              <p className="mode-hint">Hablando…</p>
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

          {inCall && (
            <div className="call-controls">
              <button
                type="button"
                className={`ctrl${muted ? ' active' : ''}`}
                onClick={toggleMute}
                aria-pressed={muted}
              >
                <span className="ctrl-circle" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {muted ? (
                      <>
                        <path d="M9 9v3a3 3 0 0 0 5.1 2.1" strokeLinecap="round" />
                        <path d="M15 11V6a3 3 0 0 0-5.2-2" strokeLinecap="round" />
                        <path d="M5 12a7 7 0 0 0 11.5 5.3M19 12a7 7 0 0 0-.4-2.3" strokeLinecap="round" />
                        <path d="M12 19v2M4 4l16 16" strokeLinecap="round" />
                      </>
                    ) : (
                      <>
                        <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                      </>
                    )}
                  </svg>
                </span>
                <span className="ctrl-label">{muted ? 'Activar' : 'Silenciar'}</span>
              </button>
              <button
                type="button"
                className={`ctrl${showKeypad ? ' active' : ''}`}
                onClick={() => setShowKeypad((v) => !v)}
                aria-pressed={showKeypad}
              >
                <span className="ctrl-circle" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="7" cy="6" r="1.4" />
                    <circle cx="12" cy="6" r="1.4" />
                    <circle cx="17" cy="6" r="1.4" />
                    <circle cx="7" cy="12" r="1.4" />
                    <circle cx="12" cy="12" r="1.4" />
                    <circle cx="17" cy="12" r="1.4" />
                    <circle cx="7" cy="18" r="1.4" />
                    <circle cx="12" cy="18" r="1.4" />
                    <circle cx="17" cy="18" r="1.4" />
                  </svg>
                </span>
                <span className="ctrl-label">Teclado</span>
              </button>
              <button
                type="button"
                className={`ctrl${speakerOn ? ' active' : ''}`}
                onClick={() => setSpeakerOn((v) => !v)}
                aria-pressed={speakerOn}
              >
                <span className="ctrl-circle" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 9v6h3l5 4V5L7 9H4Z" strokeLinejoin="round" />
                    <path d="M16 9.5a4 4 0 0 1 0 5" strokeLinecap="round" />
                    <path d="M18.5 7a7 7 0 0 1 0 10" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="ctrl-label">Altavoz</span>
              </button>
            </div>
          )}

          <div className="primary-actions">
            {!inCall ? (
              <button
                type="button"
                className="btn-call"
                onClick={() => void startCall()}
                aria-label="Llamar"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="btn-hang"
                onClick={() => void hangUp()}
                aria-label="Colgar"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="gear"
              aria-label="Quién llama"
              title="Quién llama"
              onClick={() => setShowSettings((v) => !v)}
              disabled={inCall}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.4.6 1 1 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <p className="caller-hint">
            Desde {callerName} · {callerPhone}
          </p>
          <div className="home-indicator" aria-hidden />
        </div>
      </div>
    </main>
  )
}
