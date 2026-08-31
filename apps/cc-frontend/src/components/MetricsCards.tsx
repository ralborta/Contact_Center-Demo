'use client'

import { Interaction } from '@/lib/api'
import { Phone, MessageSquare, Mail, Target } from 'lucide-react'
import KpiCard from './KpiCard'

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

  const asaSeconds = 28
  const ahtMinutes = 4
  const ahtSeconds = 12

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KpiCard
        icon={Phone}
        value={calls.length}
        label="Llamadas Hoy"
        footer={
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">ASA</span>
              <span className="text-sm font-medium tabular-nums text-primary-container">{asaSeconds}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">AHT</span>
              <span className="text-sm font-medium tabular-nums text-primary-container">{ahtMinutes}m {ahtSeconds}s</span>
            </div>
          </div>
        }
      />

      <KpiCard
        icon={MessageSquare}
        iconBg="bg-emerald-100"
        iconColor="text-status-success"
        value={whatsapp.length}
        label="WhatsApp Hoy"
        footer={
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-on-surface-variant">Resueltos</span>
              <span className="text-sm font-medium text-status-success">{whatsappResolvedPercent}%</span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
              <div
                className="bg-status-success h-2 rounded-full transition-all duration-500"
                style={{ width: `${whatsappResolvedPercent}%` }}
              />
            </div>
          </div>
        }
      />

      <KpiCard
        icon={Mail}
        iconBg="bg-sky-100"
        iconColor="text-tertiary"
        value={sms.length}
        label="SMS Hoy"
        footer={
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-on-surface-variant">Abandono</span>
              <span className="text-sm font-medium text-amber-600">{smsAbandonPercent}%</span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${smsAbandonPercent}%` }}
              />
            </div>
          </div>
        }
      />

      <KpiCard
        icon={Target}
        iconBg="bg-secondary-container"
        iconColor="text-on-secondary-container"
        value={`${fcr}%`}
        label="FCR"
        footer={
          <div>
            <p className="text-xs text-on-surface-variant mb-2">Primer Contacto Resuelto</p>
            <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary-container h-2 rounded-full transition-all duration-500"
                style={{ width: `${fcr}%` }}
              />
            </div>
          </div>
        }
      />
    </div>
  )
}
