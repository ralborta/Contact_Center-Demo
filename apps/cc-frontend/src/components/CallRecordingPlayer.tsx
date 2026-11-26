'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Pause, Play } from 'lucide-react'
import { getToken } from '@/lib/auth'

function apiBase() {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  if (!url.startsWith('http')) return `https://${url}`
  return url.replace(/\/$/, '')
}

function formatClock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

type Props = {
  interactionId: string
  hasRecording: boolean
}

export default function CallRecordingPlayer({
  interactionId,
  hasRecording,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!hasRecording || !interactionId) return
    let cancelled = false
    let objectUrl: string | null = null
    ;(async () => {
      setLoading(true)
      setError(false)
      try {
        const token = getToken()
        const res = await fetch(
          `${apiBase()}/api/interactions/${interactionId}/recording`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [hasRecording, interactionId])

  const toggle = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }, [])

  const onDownload = useCallback(() => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `llamada-${interactionId}.mp3`
    a.click()
  }, [blobUrl, interactionId])

  if (!hasRecording || error) {
    return (
      <section className="surface-card p-4">
        <p className="label-caps mb-2">Grabación</p>
        <p className="text-sm text-on-surface-variant">Grabación no disponible</p>
      </section>
    )
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0

  return (
    <section className="surface-card overflow-hidden shadow-soft">
      <header className="px-4 py-3 border-b border-outline-variant/50 bg-surface-muted/40">
        <p className="label-caps">Grabación</p>
      </header>
      <div className="p-4 flex flex-col gap-3">
        {loading && (
          <p className="text-sm text-on-surface-variant">Cargando audio…</p>
        )}
        {blobUrl && (
          <>
            <audio
              ref={audioRef}
              src={blobUrl}
              preload="metadata"
              onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onEnded={() => {
                setPlaying(false)
                setCurrent(0)
              }}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggle}
                className="shrink-0 w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-soft hover:bg-primary-600 transition-colors"
                aria-label={playing ? 'Pausar' : 'Reproducir'}
              >
                {playing ? (
                  <Pause className="w-5 h-5" fill="currentColor" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="h-2 rounded-full bg-primary-50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-on-surface-variant font-semibold">
                  <span>{formatClock(current)}</span>
                  <span>{formatClock(duration)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onDownload}
                className="btn-secondary !px-3 !py-2"
                aria-label="Descargar"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
