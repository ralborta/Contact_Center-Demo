'use client'

import { Interaction } from '@/lib/api'

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
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Llamadas Hoy</h3>
        <p className="text-3xl font-bold text-gray-900">{calls.length}</p>
        <div className="mt-4 space-y-1">
          <p className="text-sm text-gray-600">ASA {asaSeconds}s</p>
          <p className="text-sm text-gray-600">AHT {ahtMinutes}m {ahtSeconds}s</p>
        </div>
      </div>

      {/* WhatsApp Hoy */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">WhatsApp Hoy</h3>
        <p className="text-3xl font-bold text-gray-900">{whatsapp.length}</p>
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">
            Resueltos {whatsappResolvedPercent}%
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${whatsappResolvedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* SMS Hoy */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">SMS Hoy</h3>
        <p className="text-3xl font-bold text-gray-900">{sms.length}</p>
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">
            Abandono {smsAbandonPercent}%
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full"
              style={{ width: `${smsAbandonPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* FCR */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">FCR</h3>
        <p className="text-3xl font-bold text-gray-900">{fcr}%</p>
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Primer Contacto Resuelto</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${fcr}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
