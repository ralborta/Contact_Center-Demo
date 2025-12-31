'use client'

import { Interaction } from '@/lib/api'
import Link from 'next/link'
import { Phone, MessageSquare, Mail, Clock } from 'lucide-react'

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
        return <Phone className="w-5 h-5 text-blue-600" />
      case 'WHATSAPP':
        return <MessageSquare className="w-5 h-5 text-green-600" />
      case 'SMS':
        return <Mail className="w-5 h-5 text-purple-600" />
      default:
        return <Phone className="w-5 h-5 text-gray-600" />
    }
  }

  const getChannelBg = (channel: string) => {
    switch (channel) {
      case 'CALL':
        return 'bg-blue-50'
      case 'WHATSAPP':
        return 'bg-green-50'
      case 'SMS':
        return 'bg-purple-50'
      default:
        return 'bg-gray-50'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500'
      case 'IN_PROGRESS':
        return 'bg-blue-500'
      case 'ABANDONED':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Últimas Interacciones</h3>
      <div className="space-y-2">
        {recent.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">
            No hay interacciones recientes
          </p>
        ) : (
          recent.map((interaction) => (
            <Link
              key={interaction.id}
              href={`/interaction/${interaction.id}`}
              className="block p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getChannelBg(interaction.channel)}`}>
                    {getChannelIcon(interaction.channel)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {interaction.from || 'Desconocido'}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {interaction.intent || 'Sin motivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${getStatusColor(
                        interaction.status
                      )}`}
                    />
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(interaction.createdAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
