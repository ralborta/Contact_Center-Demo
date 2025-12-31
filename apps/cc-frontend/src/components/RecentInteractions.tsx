'use client'

import { Interaction } from '@/lib/api'
import Link from 'next/link'

interface RecentInteractionsProps {
  interactions: Interaction[]
}

export default function RecentInteractions({
  interactions,
}: RecentInteractionsProps) {
  const recent = interactions
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 10)

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'CALL':
        return '📞'
      case 'WHATSAPP':
        return '💬'
      case 'SMS':
        return '💌'
      default:
        return '📱'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500'
      case 'IN_PROGRESS':
        return 'bg-blue-500'
      case 'ABANDONED':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Últimas Interacciones</h3>
      <div className="space-y-3">
        {recent.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No hay interacciones recientes
          </p>
        ) : (
          recent.map((interaction) => (
            <Link
              key={interaction.id}
              href={`/interaction/${interaction.id}`}
              className="block p-3 border rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {getChannelIcon(interaction.channel)}
                  </span>
                  <div>
                    <p className="font-medium">
                      {interaction.from || 'Desconocido'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {interaction.intent || 'Sin motivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-3 h-3 rounded-full ${getStatusColor(
                      interaction.status
                    )}`}
                  />
                  <span className="text-sm text-gray-500">
                    {new Date(interaction.createdAt).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
