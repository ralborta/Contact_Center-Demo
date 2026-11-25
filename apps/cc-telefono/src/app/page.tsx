'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const AGENT_ID = 'agent_8301m89vh2zsf3jrcs1h3ej36nk2'
const DEFAULT_PHONE = '59170111222'
const HOSPITAL = 'Hospital Central La Paz'

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

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'agent-id'?: string
          'signed-url'?: string
          'dynamic-variables'?: string
          variant?: string
        },
        HTMLElement
      >
    }
  }
}

export default function TelefonoPage() {
  const [callerPhone, setCallerPhone] = useState(DEFAULT_PHONE)
  const [callerName, setCallerName] = useState('Juan Pérez')
  const [showSettings, setShowSettings] = useState(false)
  const [inCall, setInCall] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [ready, setReady] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState('Listo para llamar')
  const conversationIdRef = useRef<string | null>(null)
  const connectedAtRef = useRef<number | null>(null)
  const callerPhoneRef = useRef(callerPhone)
  const widgetHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    callerPhoneRef.current = callerPhone
  }, [callerPhone])

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/voice/public/session`)
      if (!res.ok) throw new Error('session')
      const data = await res.json()
      if (data.signedUrl) setSignedUrl(data.signedUrl)
      if (data.conversationId) conversationIdRef.current = String(data.conversationId)
      if (data.defaultCallerPhone && callerPhoneRef.current === DEFAULT_PHONE) {
        setCallerPhone(data.defaultCallerPhone)
      }
      return data
    } catch {
      setSignedUrl(null)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshSession()
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSession])

  useEffect(() => {
    if (!ready) return
    const existing = document.querySelector('script[data-elevenlabs-widget]')
    if (existing) return
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed'
    script.async = true
    script.dataset.elevenlabsWidget = '1'
    document.body.appendChild(script)
  }, [ready])

  const reportEnd = useCallback(async (durationSec: number) => {
    const conversationId = conversationIdRef.current
    if (!conversationId) return
    try {
      await fetch(`${apiBase()}/api/voice/public/end-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          callerPhone: callerPhoneRef.current,
          durationSec,
        }),
      })
    } catch {
      /* el backend puede recuperar luego */
    }
  }, [])

  useEffect(() => {
    if (!inCall) return
    connectedAtRef.current = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => {
      if (!connectedAtRef.current) return
      setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [inCall])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      const type = String((data as any).type || (data as any).event || '')
      const payload = (data as any).detail || (data as any).payload || data

      const maybeId =
        payload?.conversationId ||
        payload?.conversation_id ||
        payload?.id ||
        (data as any).conversationId ||
        (data as any).conversation_id
      if (maybeId && String(maybeId).startsWith('conv_')) {
        conversationIdRef.current = String(maybeId)
      }

      const lower = type.toLowerCase()
      if (
        lower.includes('connect') ||
        lower.includes('start') ||
        lower.includes('call_started') ||
        payload?.status === 'connected' ||
        payload?.status === 'calling'
      ) {
        setInCall(true)
        setStatusHint('En llamada')
      }
      if (
        lower.includes('disconnect') ||
        lower.includes('end') ||
        lower.includes('call_ended') ||
        payload?.status === 'disconnected' ||
        payload?.status === 'ended'
      ) {
        const dur = connectedAtRef.current
          ? Math.floor((Date.now() - connectedAtRef.current) / 1000)
          : elapsed
        setInCall(false)
        connectedAtRef.current = null
        setStatusHint('Llamada finalizada')
        void reportEnd(dur).then(() => refreshSession())
      }
    }

    const onCustom = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {}
      const id = detail.conversationId || detail.conversation_id
      if (id) conversationIdRef.current = String(id)
      const status = String(detail.status || detail.state || ev.type).toLowerCase()
      if (status.includes('connect') || status.includes('start') || status === 'connected') {
        setInCall(true)
        setStatusHint('En llamada')
      }
      if (status.includes('end') || status.includes('disconnect') || status === 'ended') {
        const dur = connectedAtRef.current
          ? Math.floor((Date.now() - connectedAtRef.current) / 1000)
          : elapsed
        setInCall(false)
        connectedAtRef.current = null
        setStatusHint('Llamada finalizada')
        void reportEnd(dur).then(() => refreshSession())
      }
    }

    window.addEventListener('message', onMessage)
    const names = [
      'elevenlabs-convai:call',
      'elevenlabs-convai:status',
      'elevenlabs-convai:conversation',
      'elevenlabs-convai:call-started',
      'elevenlabs-convai:call-ended',
    ]
    names.forEach((n) => window.addEventListener(n, onCustom as EventListener))
    return () => {
      window.removeEventListener('message', onMessage)
      names.forEach((n) => window.removeEventListener(n, onCustom as EventListener))
    }
  }, [elapsed, reportEnd, refreshSession])

  // Captura conversation_id del DOM del widget (cuando show_conversation_id / data attrs)
  useEffect(() => {
    const root = widgetHostRef.current
    if (!root) return
    const scan = () => {
      const el = root.querySelector('elevenlabs-convai') as HTMLElement | null
      const attrId =
        el?.getAttribute('conversation-id') ||
        el?.getAttribute('data-conversation-id') ||
        el?.getAttribute('conversation_id')
      if (attrId?.startsWith('conv_')) conversationIdRef.current = attrId

      const text = root.innerText || ''
      const match = text.match(/conv_[a-z0-9]+/i)
      if (match) conversationIdRef.current = match[0]
    }
    const obs = new MutationObserver(scan)
    obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true })
    const iv = window.setInterval(scan, 2000)
    return () => {
      obs.disconnect()
      window.clearInterval(iv)
    }
  }, [ready])

  const dynamicVariables = useMemo(
    () =>
      JSON.stringify({
        caller_phone: callerPhone,
        telefono: callerPhone,
        system__caller_id: callerPhone,
        paciente_nombre_simulado: callerName,
      }),
    [callerPhone, callerName],
  )

  // Re-montar widget al cambiar caller o signed URL
  const widgetKey = `${signedUrl || 'agent'}:${callerPhone}:${callerName}`

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
              aria-label="Ajustes"
              onClick={() => setShowSettings((v) => !v)}
            >
              ⌂
            </button>
          </header>

          <section className="call-hero">
            <p className="hospital-eyebrow">Llamando a</p>
            <h1 className="hospital-name">{HOSPITAL}</h1>
            <p className="call-status">{inCall ? formatTimer(elapsed) : statusHint}</p>
            <div className={`pulse ${inCall ? 'on' : ''}`} aria-hidden />
          </section>

          {showSettings && (
            <div className="settings-panel" role="dialog" aria-label="Ajustes de llamada">
              <label>
                Quién llama
                <input
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                Número
                <input
                  value={callerPhone}
                  onChange={(e) => setCallerPhone(e.target.value.replace(/[^\d+]/g, ''))}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <button type="button" className="settings-close" onClick={() => setShowSettings(false)}>
                Listo
              </button>
            </div>
          )}

          <div className="widget-host" ref={widgetHostRef}>
            {ready && (
              <elevenlabs-convai
                key={widgetKey}
                agent-id={AGENT_ID}
                {...(signedUrl ? { 'signed-url': signedUrl } : {})}
                dynamic-variables={dynamicVariables}
              />
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
