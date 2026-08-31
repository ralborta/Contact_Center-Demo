'use client'

import { useState, useEffect } from 'react'
import PageShell from '@/components/PageShell'
import PageHeader from '@/components/PageHeader'
import { interactionsApi, smsApi, Interaction } from '@/lib/api'
import {
  Mail,
  Shield,
  Link as LinkIcon,
  Headphones,
  CreditCard,
  MessageSquare,
  Send,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react'

interface SendHistory {
  date: string
  destination: string
  service: string
  status: 'sent' | 'delivered' | 'failed'
}

export default function SMSPage() {
  const [phone, setPhone] = useState('+54 11 3456 7890')
  const [customerName, setCustomerName] = useState('Martín Gómez')
  const [customerId, setCustomerId] = useState('12345678')
  const [loading, setLoading] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [sendHistory, setSendHistory] = useState<SendHistory[]>([])
  const [recentInteractions, setRecentInteractions] = useState<Interaction[]>([])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await interactionsApi.getAll({
          channel: 'SMS',
          direction: 'OUTBOUND',
        })
        setRecentInteractions(data || [])
        
        // Convertir interacciones a historial
        const history: SendHistory[] = (data || []).slice(0, 10).map((interaction) => {
          const lastMessage = interaction.messages?.[interaction.messages.length - 1]
          return {
            date: interaction.startedAt || interaction.createdAt,
            destination: interaction.to,
            service: interaction.intent || 'SMS Personalizado',
            status: interaction.outcome === 'RESOLVED' ? 'delivered' : 
                   interaction.status === 'FAILED' ? 'failed' : 'sent',
          }
        })
        setSendHistory(history)
      } catch (error) {
        console.error('Error fetching SMS history:', error)
      }
    }

    fetchHistory()
  }, [])

  const handleSendSms = async (type: string, message?: string) => {
    if (!phone.trim()) {
      // Error silencioso - no mostrar alert
      return
    }

    setLoading(true)
    try {
      let result: any

      switch (type) {
        case 'otp':
          result = await smsApi.sendOtp(phone.trim(), 'IDENTITY_VERIFICATION', customerName)
          break
        case 'verification-link':
          result = await smsApi.sendVerificationLink(phone.trim(), customerName)
          break
        case 'onboarding':
          result = await smsApi.sendOnboarding(phone.trim(), customerName)
          break
        case 'activate-card':
          result = await smsApi.sendActivateCard(phone.trim(), customerName)
          break
        case 'custom':
          result = await smsApi.send(phone.trim(), message || customMessage, customerName)
          break
        default:
          throw new Error('Tipo de SMS no válido')
      }
      
      // Agregar al historial
      const newHistory: SendHistory = {
        date: new Date().toISOString(),
        destination: phone.trim(),
        service: type === 'otp' ? 'Código OTP' :
                type === 'verification-link' ? 'Link de Verificación' :
                type === 'onboarding' ? 'Onboarding' :
                type === 'activate-card' ? 'Activar Tarjeta' :
                'SMS Personalizado',
        status: 'sent',
      }
      setSendHistory([newHistory, ...sendHistory].slice(0, 10))

      // Mensaje enviado exitosamente - sin alert visible
      
      // Refrescar historial
      const data = await interactionsApi.getAll({ channel: 'SMS', direction: 'OUTBOUND' })
      setRecentInteractions(data || [])
    } catch (error: any) {
      console.error('Error sending SMS:', error)
      
      // Error silencioso - no mostrar alert, solo log en consola
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'sent':
        return <Clock className="w-4 h-4 text-blue-600" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'Entregado'
      case 'sent':
        return 'Enviado'
      case 'failed':
        return 'Fallido'
      default:
        return 'Pendiente'
    }
  }

  return (
    <PageShell>
      <PageHeader
        icon={Mail}
        title="Enviar SMS OTP y Servicios"
        subtitle="Enviá códigos OTP y servicios personalizados a clientes mediante SMS de manera segura y rápida."
      />

      <div className="surface-card p-6 mb-6">
        <label className="label-caps mb-2 block">Enviar a</label>
        <div className="flex items-center gap-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+54 11 1234 5678"
            className="field-input flex-1"
          />
          <button
            onClick={() => handleSendSms('custom', customMessage)}
            disabled={loading || !phone.trim()}
            className="btn-primary"
          >
            <Send className="w-4 h-4" />
            Enviar SMS
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {phone && (
          <p className="text-sm text-on-surface-variant mt-2">
            ID: {customerId} - {customerName}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {[
            { type: 'otp', title: 'Código OTP', desc: 'Enviar un código de verificación de 6 dígitos.', icon: Shield, action: 'Enviar OTP', bg: 'bg-primary-fixed', color: 'text-primary-container' },
            { type: 'verification-link', title: 'Link de Verificación', desc: 'Enviar un enlace seguro para confirmar identidad.', icon: LinkIcon, action: 'Enviar Link', bg: 'bg-emerald-100', color: 'text-status-success' },
            { type: 'onboarding', title: 'Onboarding', desc: 'Enviar enlace personalizado para iniciar onboarding.', icon: Headphones, action: 'Enviar Onboarding', bg: 'bg-secondary-container', color: 'text-on-secondary-container' },
            { type: 'activate-card', title: 'Activar Tarjeta', desc: 'Enviar un instructivo para activar tarjeta bancaria.', icon: CreditCard, action: 'Enviar Instructivo', bg: 'bg-amber-100', color: 'text-amber-700' },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div key={card.type} className="border border-[#E5E7EB] rounded-lg p-6 flex flex-col hover-elevate">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 ${card.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-on-surface">{card.title}</h3>
                </div>
                <p className="text-sm text-on-surface-variant mb-6 flex-1">{card.desc}</p>
                <button
                  onClick={() => handleSendSms(card.type)}
                  disabled={loading || !phone.trim()}
                  className="btn-primary w-full"
                >
                  {card.action}
                </button>
              </div>
            )
          })}

          <div className="border border-[#E5E7EB] rounded-lg p-6 flex flex-col hover-elevate md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-fixed rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-primary-container" />
              </div>
              <h3 className="text-base font-semibold text-on-surface">SMS Personalizado</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-4">Enviar un mensaje personalizado al cliente.</p>
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Escribí tu mensaje..."
              className="field-input mb-4"
            />
            <button
              onClick={() => handleSendSms('custom', customMessage)}
              disabled={loading || !phone.trim() || !customMessage.trim()}
              className="btn-primary w-full"
            >
              Enviar SMS
            </button>
          </div>
        </div>
      </div>

      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-on-surface">Historial de Envíos</h2>
        </div>
        {sendHistory.length === 0 ? (
          <p className="text-on-surface-variant text-center py-8">No hay registros recientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="px-6 py-3 text-left label-caps">Fecha</th>
                  <th className="px-6 py-3 text-left label-caps">Destino</th>
                  <th className="px-6 py-3 text-left label-caps">Servicio</th>
                  <th className="px-6 py-3 text-left label-caps">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sendHistory.map((item, idx) => (
                  <tr key={idx} className="border-b border-[#E5E7EB] hover:bg-surface-container-low">
                    <td className="px-6 py-4 whitespace-nowrap text-sm tabular-nums text-on-surface">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      {item.destination}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                      {item.service}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span>{getStatusLabel(item.status)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  )
}
