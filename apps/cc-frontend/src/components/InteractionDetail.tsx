'use client'

import { Interaction } from '@/lib/api'

interface InteractionDetailProps {
  interaction: Interaction
}

export default function InteractionDetail({
  interaction,
}: InteractionDetailProps) {
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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">{getTitle()}</h2>

      {/* Información Principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Número del Cliente
          </label>
          <p className="text-lg font-semibold">{interaction.from}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Cliente
          </label>
          <p className="text-lg">
            {interaction.customerRef || 'No especificado'}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Fecha
          </label>
          <p className="text-lg">{formatDate(interaction.startedAt || interaction.createdAt)}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Agente
          </label>
          <p className="text-lg flex items-center">
            {interaction.assignedAgent || 'Sin asignar'}
            {interaction.assignedAgent && (
              <button className="ml-2 text-blue-600 hover:text-blue-800">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Resultado
          </label>
          <p className={`text-lg font-semibold ${
            interaction.outcome === 'RESOLVED' ? 'text-green-600' : 'text-gray-700'
          }`}>
            {getOutcomeLabel(interaction.outcome)}
          </p>
        </div>
      </div>

      {/* Información de la Llamada y Historial - Dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Columna Izquierda: Información de la Llamada */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">
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
            {interaction.callDetail && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-2">
                    Grabación
                  </label>
                  {interaction.callDetail.recordingUrl ? (
                    <div className="mt-2">
                      <audio controls className="w-full">
                        <source
                          src={interaction.callDetail.recordingUrl}
                          type="audio/mpeg"
                        />
                      </audio>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No disponible</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    Duración
                  </label>
                  <p className="text-base">
                    {interaction.callDetail.durationSec
                      ? `${Math.floor(interaction.callDetail.durationSec / 60)}m ${interaction.callDetail.durationSec % 60}s`
                      : 'N/A'}
                  </p>
                </div>
              </>
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
        {interaction.events && interaction.events.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Historial de Eventos</h3>
            <ul className="space-y-2">
              {interaction.events.map((event) => (
                <li key={event.id} className="flex items-start">
                  <span className="text-blue-600 mr-2 font-bold">•</span>
                  <div className="flex-1">
                    <span className="text-gray-600 text-sm">
                      {new Date(event.ts).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="ml-2 text-sm">{event.type}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mensajes (WhatsApp/SMS) */}
      {interaction.messages && interaction.messages.length > 0 && (
        <div className="border-t pt-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {interaction.channel === 'WHATSAPP' ? 'Mensajes de WhatsApp' : 'Mensajes SMS'}
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {interaction.messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.direction === 'INBOUND'
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'bg-gray-50 border-l-4 border-gray-500'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium">
                    {message.direction === 'INBOUND' ? '📥 Recibido' : '📤 Enviado'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {message.sentAt
                      ? new Date(message.sentAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A'}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{message.text || 'Sin texto'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de Eventos */}
      {interaction.events && interaction.events.length > 0 && (
        <div className="border-t pt-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Historial de Eventos</h3>
          <ul className="space-y-2">
            {interaction.events.map((event) => (
              <li key={event.id} className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <div>
                  <span className="text-gray-600">
                    {new Date(event.ts).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="ml-2">{event.type}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcripción y Notas - Dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Transcripción */}
        {interaction.callDetail?.transcriptText && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Transcripción</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                {interaction.callDetail.transcriptText}
              </pre>
            </div>
          </div>
        )}

        {/* Columna Derecha: Notas del Agente */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Notas del Agente</h3>
          <textarea
            className="w-full border rounded-lg p-4 min-h-32 text-sm"
            placeholder="Agregar notas sobre esta interacción..."
            defaultValue={
              interaction.outcome === 'RESOLVED'
                ? 'Caso resuelto en primer contacto.'
                : ''
            }
            readOnly
          />
        </div>
      </div>

    </div>
  )
}
