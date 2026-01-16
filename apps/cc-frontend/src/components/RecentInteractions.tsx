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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl">
          <History className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Últimas Interacciones</h3>
      </div>
      <div className="space-y-3">
        {recent.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay interacciones recientes</p>
          </div>
        ) : (
          recent.map((interaction) => (
            <Link
              key={interaction.id}
              href={`/interaction/${interaction.id}`}
              className="block p-4 border-2 border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-xl ${getChannelBg(interaction.channel)} group-hover:scale-110 transition-transform`}>
                    {getChannelIcon(interaction.channel)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {interaction.from || 'Desconocido'}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {interaction.intent || 'Sin motivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-3 h-3 rounded-full ${getStatusColor(
                        interaction.status
                      )} shadow-sm`}
                    />
                    <span className="text-xs text-gray-600 flex items-center">
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
