'use client'

import { Interaction } from '@/lib/api'
import Link from 'next/link'
import { Phone, MessageSquare, Mail, Clock, History } from 'lucide-react'

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
        return 'bg-gradient-to-br from-blue-100 to-blue-200'
      case 'WHATSAPP':
        return 'bg-gradient-to-br from-green-100 to-green-200'
      case 'SMS':
        return 'bg-gradient-to-br from-purple-100 to-purple-200'
      default:
        return 'bg-gray-100'
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
    <div className="surface-card p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-primary-fixed rounded-lg">
          <History className="w-5 h-5 text-primary-container" />
        </div>
        <h3 className="text-xl font-semibold text-on-surface">Últimas Interacciones</h3>
      </div>
      <div className="space-y-3">
        {recent.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-outline" />
            </div>
            <p className="text-on-surface-variant font-medium">No hay interacciones recientes</p>
          </div>
        ) : (
          recent.map((interaction) => (
            <Link
              key={interaction.id}
              href={`/interaction/${interaction.id}`}
              className="block p-4 border border-[#E5E7EB] rounded-lg hover:border-primary-container hover:bg-surface-container-low transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-lg ${getChannelBg(interaction.channel)}`}>
                    {getChannelIcon(interaction.channel)}
                  </div>
                  <div>
                    <p className="font-semibold text-on-surface group-hover:text-primary-container transition-colors">
                      {interaction.from || 'Desconocido'}
                    </p>
                    <p className="text-sm text-on-surface-variant mt-0.5">
                      {interaction.intent || 'Sin motivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-3 h-3 rounded-full ${getStatusColor(
                        interaction.status
                      )}`}
                    />
                    <span className="text-xs text-on-surface-variant flex items-center tabular-nums">
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
