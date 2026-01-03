'use client'

import { useState, useRef, useEffect } from 'react'
import { Interaction } from '@/lib/api'
import {
  Play,
  Pause,
  Square,
  Volume2,
  Edit2,
  Bell,
  User,
  Phone,
  Calendar,
  CheckCircle,
  Clock,
  MessageSquare,
  FileText,
  StickyNote,
} from 'lucide-react'

interface InteractionDetailProps {
  interaction: Interaction
}

export default function InteractionDetail({
  interaction,
}: InteractionDetailProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      setIsPaused(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NEW: 'Nueva',
      IN_PROGRESS: 'En Progreso',
      COMPLETED: 'Completada',
      ABANDONED: 'Abandonada',
      FAILED: 'Fallida',
    }
    return labels[status] || status
  }

  const getOutcomeLabel = (outcome: string | null) => {
    if (!outcome) return 'N/A'
    const labels: Record<string, string> = {
      RESOLVED: 'Resuelta',
      ESCALATED: 'Escalada',
      TICKETED: 'Con Ticket',
      TRANSFERRED: 'Transferida',
      UNKNOWN: 'Desconocido',
    }
    return labels[outcome] || outcome
  }

  const getTitle = () => {
    switch (interaction.channel) {
      case 'CALL':
        return 'Detalle de Llamada Entrante'
      case 'WHATSAPP':
        return 'Detalle de Conversación WhatsApp'
      case 'SMS':
        return 'Detalle de Mensajes SMS'
      default:
        return 'Detalle de Interacción'
    }
  }

  const handlePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPaused) {
      audio.play()
      setIsPlaying(true)
      setIsPaused(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const handlePause = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setIsPlaying(false)
    setIsPaused(true)
  }

  const handleStop = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentTime(0)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const newVolume = parseFloat(e.target.value)
    audio.volume = newVolume
    setVolume(newVolume)
  }

  // Parsear transcripción para mostrar como diálogo
  const parseTranscript = (transcript: string | null) => {
    if (!transcript) return []
    
    // Intentar parsear como formato de diálogo
    const lines = transcript.split('\n')
    const messages: Array<{ time: string; speaker: string; text: string }> = []
    
    lines.forEach((line) => {
      // Buscar patrones como "14:31 MARTÍN GÓMEZ: texto" o "Agente: texto"
      const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+([^:]+):\s*(.+)$/)
      if (timeMatch) {
        messages.push({
          time: timeMatch[1],
          speaker: timeMatch[2].trim(),
          text: timeMatch[3].trim(),
        })
      } else {
        // Buscar patrones sin tiempo: "AGENTE: texto" o "Cliente: texto"
            const speakerMatch = line.match(/^([^:]+):\s*(.+)$/)
            if (speakerMatch) {
              messages.push({
                time: '',
                speaker: speakerMatch[1].trim(),
                text: speakerMatch[2].trim(),
              })
            } else if (line.trim()) {
              // Si no hay formato, agregar como mensaje genérico
              if (messages.length > 0) {
                messages[messages.length - 1].text += ' ' + line.trim()
              } else {
                messages.push({
                  time: '',
                  speaker: 'Sistema',
                  text: line.trim(),
                })
              }
            }
          }
        })
    
    return messages
  }

  const transcriptMessages = parseTranscript(interaction.callDetail?.transcriptText || null)

  // Obtener URL del audio desde el backend
  const getAudioUrl = () => {
    if (interaction.callDetail?.recordingUrl) {
      // Si es una URL directa, usarla
      if (interaction.callDetail.recordingUrl.startsWith('http')) {
        return interaction.callDetail.recordingUrl
      }
    }
    // Si tenemos un conversationId (elevenCallId), usar el endpoint del backend
    if (interaction.callDetail?.elevenCallId && interaction.channel === 'CALL') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const baseUrl = apiUrl.startsWith('http') ? apiUrl : `https://${apiUrl}`
      return `${baseUrl}/api/elevenlabs/audio/${interaction.callDetail.elevenCallId}`
    }
    return null
  }

  const audioUrl = getAudioUrl()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Azul */}
      <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-xl">
            C
          </div>
          <h1 className="text-xl font-semibold">{getTitle()}</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-blue-700 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Información del Cliente */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 flex items-center gap-1 mb-1">
                <Phone className="w-4 h-4" />
                Número del Cliente
              </label>
              <p className="text-lg font-semibold">{interaction.from}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1">
                Cliente
              </label>
              <p className="text-lg">
                {interaction.customerRef || 'No especificado'}
                {interaction.customerRef && (
                  <span className="text-gray-500 text-sm ml-2">
                    (DNI: {interaction.customerRef.split(' ')[1] || 'N/A'})
                  </span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 flex items-center gap-1 mb-1">
                <User className="w-4 h-4" />
                Agente
              </label>
              <p className="text-lg flex items-center">
                {interaction.assignedAgent || 'Sin asignar'}
                {interaction.assignedAgent && (
                  <button className="ml-2 text-blue-600 hover:text-blue-800">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 flex items-center gap-1 mb-1">
                <Calendar className="w-4 h-4" />
                Fecha
              </label>
              <p className="text-lg">{formatDate(interaction.startedAt || interaction.createdAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 flex items-center gap-1 mb-1">
                <CheckCircle className="w-4 h-4" />
                Resultado
              </label>
              <p className={`text-lg font-semibold ${
                interaction.outcome === 'RESOLVED' ? 'text-green-600' : 'text-gray-700'
              }`}>
                {getOutcomeLabel(interaction.outcome)}
              </p>
            </div>
          </div>
        </div>

        {/* Para WhatsApp: Detalles de la Conversación */}
        {interaction.channel === 'WHATSAPP' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Detalles de la Conversación */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-600" />
                Detalles de la Conversación
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700">
                    {interaction.intent || 'Consulta General'}
                  </span>
                </div>
                {interaction.callDetail?.durationSec && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      Duración: {formatDuration(interaction.callDetail.durationSec)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700">Canal: WhatsApp</span>
                </div>
              </div>
            </div>

            {/* Notas del Agente (mover aquí para WhatsApp) */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-blue-600" />
                Notas del Agente
              </h3>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-4 min-h-32 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Agregar notas sobre esta interacción..."
                defaultValue={
                  interaction.outcome === 'RESOLVED'
                    ? 'Cliente consultó por saldo de su cuenta. Se informó el saldo actual disponible.'
                    : ''
                }
              />
            </div>
          </div>
        )}

        {/* Dos Columnas: Información y Eventos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Columna Izquierda: Información de la Llamada */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Información de la Llamada
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">
                  Estado
                </label>
                <p className="text-base">{getStatusLabel(interaction.status)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">
                  Cola
                </label>
                <p className="text-base">{interaction.queue || 'N/A'}</p>
              </div>
              
              {/* Controles de Audio Mejorados */}
              {interaction.callDetail && (
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-2">
                    Grabación
                  </label>
                  {audioUrl ? (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        className="hidden"
                      />
                      <div className="space-y-3">
                        {/* Controles de Play/Pause/Stop */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={isPlaying ? handlePause : handlePlay}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${
                              isPlaying
                                ? 'bg-orange-500 hover:bg-orange-600'
                                : 'bg-green-500 hover:bg-green-600'
                            }`}
                          >
                            {isPlaying ? (
                              <Pause className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5 ml-0.5" />
                            )}
                          </button>
                          <button
                            onClick={handleStop}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${
                              isPlaying || isPaused
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-gray-400 cursor-not-allowed'
                            }`}
                            disabled={!isPlaying && !isPaused}
                          >
                            <Square className="w-4 h-4" />
                          </button>
                          <div className="flex-1">
                            <input
                              type="range"
                              min="0"
                              max={duration || 0}
                              value={currentTime}
                              onChange={handleSeek}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div className="text-xs text-gray-500 min-w-[80px] text-right">
                            {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
                          </div>
                        </div>
                        {/* Control de Volumen */}
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-gray-500" />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No disponible</p>
                  )}
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">
                  Intención
                </label>
                <p className="text-base">{interaction.intent || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Historial de Eventos */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Historial de Eventos
            </h3>
            {interaction.events && interaction.events.length > 0 ? (
              <ul className="space-y-3">
                {interaction.events.map((event) => (
                  <li key={event.id} className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-sm font-medium">
                          {formatTime(event.ts)}
                        </span>
                        <span className="text-sm text-gray-800">{event.type}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No hay eventos registrados</p>
            )}
          </div>
        </div>

        {/* Dos Columnas: Historial de Mensajes/Transcripción y Notas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna Izquierda: Historial de Mensajes (WhatsApp) o Transcripción (Llamadas) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              {interaction.channel === 'WHATSAPP' ? 'Historial de Mensajes' : 'Transcripción'}
            </h3>
            
            {/* Para WhatsApp: Mostrar mensajes en formato de chat */}
            {interaction.channel === 'WHATSAPP' && interaction.messages && interaction.messages.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {[...interaction.messages]
                  .sort((a, b) => {
                    // Ordenar por sentAt o createdAt (cronológicamente)
                    const dateA = a.sentAt ? new Date(a.sentAt).getTime() : new Date(a.createdAt).getTime();
                    const dateB = b.sentAt ? new Date(b.sentAt).getTime() : new Date(b.createdAt).getTime();
                    return dateA - dateB;
                  })
                  .map((message) => {
                  const isInbound = message.direction === 'INBOUND'
                  const senderName = isInbound 
                    ? (interaction.customerRef || 'Cliente')
                    : (interaction.assignedAgent || 'Sistema')
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${
                        isInbound ? 'flex-row' : 'flex-row-reverse'
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
                        isInbound ? 'bg-gray-400' : 'bg-blue-500'
                      }`}>
                        {senderName.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Contenido del mensaje */}
                      <div className={`flex-1 ${isInbound ? '' : 'text-right'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-800">
                            {senderName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {message.sentAt ? formatTime(message.sentAt) : 'Sin fecha'}
                          </span>
                        </div>
                        <div className={`inline-block rounded-lg px-4 py-2 ${
                          isInbound 
                            ? 'bg-gray-100 text-gray-800' 
                            : 'bg-blue-500 text-white'
                        }`}>
                          <p className="text-sm">{message.text || '[Archivo adjunto]'}</p>
                        </div>
                        {message.sentAt && (
                          <div className={`text-xs text-gray-400 mt-1 ${isInbound ? '' : 'text-right'}`}>
                            {formatTime(message.sentAt)} ✓✓
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : interaction.channel === 'WHATSAPP' ? (
              <p className="text-gray-500 text-sm">No hay mensajes disponibles</p>
            ) : transcriptMessages.length > 0 ? (
              // Para llamadas: Mostrar transcripción parseada
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {transcriptMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.speaker.toLowerCase().includes('agente') ||
                      msg.speaker.toLowerCase().includes('agent') ||
                      msg.speaker.toLowerCase().includes('vanesa') ||
                      msg.speaker.toLowerCase().includes('isabela')
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : 'bg-gray-50 border-l-4 border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.time && (
                        <span className="text-xs font-medium text-gray-600">
                          {msg.time}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-800 uppercase">
                        {msg.speaker}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{msg.text}</p>
                  </div>
                ))}
              </div>
            ) : interaction.callDetail?.transcriptText ? (
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {interaction.callDetail.transcriptText}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No hay transcripción disponible</p>
            )}
          </div>

          {/* Columna Derecha: Notas del Agente (solo para llamadas, WhatsApp ya lo tiene arriba) */}
          {interaction.channel !== 'WHATSAPP' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-blue-600" />
                Notas del Agente
              </h3>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-4 min-h-64 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Agregar notas sobre esta interacción..."
                defaultValue={
                  interaction.outcome === 'RESOLVED'
                    ? 'Caso resuelto en primer contacto.'
                    : ''
                }
              />
            </div>
          )}
          
          {/* Para WhatsApp: Mostrar solo el historial de mensajes en toda la columna */}
          {interaction.channel === 'WHATSAPP' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Detalles de la Sesión
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-mono text-gray-800">{interaction.id.slice(0, 8)}</span>
                </div>
                {interaction.providerConversationId && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Conversación:</span>
                    <span className="font-mono text-gray-800">{interaction.providerConversationId.slice(0, 20)}...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
