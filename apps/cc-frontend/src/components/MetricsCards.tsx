'use client'

import { Interaction } from '@/lib/api'
import { Phone, MessageSquare, Mail, Target, TrendingUp } from 'lucide-react'

interface MetricsCardsProps {
  interactions: Interaction[]
}

export default function MetricsCards({ interactions }: MetricsCardsProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayInteractions = interactions.filter(
    (i) => i.startedAt && new Date(i.startedAt) >= today
  )

  const calls = todayInteractions.filter((i) => i.channel === 'CALL')
  const whatsapp = todayInteractions.filter((i) => i.channel === 'WHATSAPP')
  const sms = todayInteractions.filter((i) => i.channel === 'SMS')

  const resolved = todayInteractions.filter((i) => i.outcome === 'RESOLVED')
  const fcr = todayInteractions.length > 0
    ? Math.round((resolved.length / todayInteractions.length) * 100)
    : 0

  const whatsappResolved = whatsapp.filter((i) => i.outcome === 'RESOLVED')
  const whatsappResolvedPercent = whatsapp.length > 0
    ? Math.round((whatsappResolved.length / whatsapp.length) * 100)
    : 0

  const smsAbandoned = sms.filter((i) => i.status === 'ABANDONED')
  const smsAbandonPercent = sms.length > 0
    ? Math.round((smsAbandoned.length / sms.length) * 100)
    : 0

  // Calculate ASA (Average Speed of Answer) - simplified
  const asaSeconds = 28 // Placeholder

  // Calculate AHT (Average Handle Time) - simplified
  const ahtMinutes = 4
  const ahtSeconds = 12

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Llamadas Hoy */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Llamadas Hoy</h3>
        <p className="text-4xl font-bold text-gray-900 mb-4">{calls.length}</p>
        <div className="space-y-2 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">ASA</span>
            <span className="text-sm font-semibold text-blue-600">{asaSeconds}s</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">AHT</span>
            <span className="text-sm font-semibold text-blue-600">{ahtMinutes}m {ahtSeconds}s</span>
          </div>
        </div>
      </div>

      {/* WhatsApp Hoy */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-green-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">WhatsApp Hoy</h3>
        <p className="text-4xl font-bold text-gray-900 mb-4">{whatsapp.length}</p>
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Resueltos</span>
            <span className="text-sm font-semibold text-green-600">{whatsappResolvedPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${whatsappResolvedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* SMS Hoy */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-orange-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">SMS Hoy</h3>
        <p className="text-4xl font-bold text-gray-900 mb-4">{sms.length}</p>
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Abandono</span>
            <span className="text-sm font-semibold text-orange-600">{smsAbandonPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-orange-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${smsAbandonPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* FCR */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
            <Target className="w-6 h-6 text-white" />
          </div>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">FCR</h3>
        <p className="text-4xl font-bold text-gray-900 mb-4">{fcr}%</p>
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Primer Contacto Resuelto</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${fcr}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
