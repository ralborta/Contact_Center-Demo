'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-6 py-6">
        {/* Título Principal */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Enviar SMS OTP y Servicios
          </h1>
          <p className="text-gray-600">
            Enviá códigos OTP y servicios personalizados a clientes mediante SMS de manera segura y rápida.
          </p>
        </div>

        {/* Sección de Envío */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enviar a
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 11 1234 5678"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleSendSms('custom', customMessage)}
                  disabled={loading || !phone.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Enviar SMS
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {phone && (
                <p className="text-sm text-gray-500 mt-2">
                  ID: {customerId} - {customerName}
                </p>
              )}
            </div>
          </div>

          {/* Grid de Servicios */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card: Código OTP */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Código OTP</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enviar un código de verificación de 6 dígitos.
              </p>
              <button
                onClick={() => handleSendSms('otp')}
                disabled={loading || !phone.trim()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar OTP
              </button>
            </div>

            {/* Card: Link de Verificación */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Link de Verificación</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enviar un enlace seguro para confirmar identidad.
              </p>
              <button
                onClick={() => handleSendSms('verification-link')}
                disabled={loading || !phone.trim()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar Link
              </button>
            </div>

            {/* Card: Onboarding */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Headphones className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Onboarding</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enviar enlace personalizado para iniciar onboarding.
              </p>
              <button
                onClick={() => handleSendSms('onboarding')}
                disabled={loading || !phone.trim()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar Onboarding
              </button>
            </div>

            {/* Card: Activar Tarjeta */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Activar Tarjeta</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enviar un instructivo para activar tarjeta bancaria.
              </p>
              <button
                onClick={() => handleSendSms('activate-card')}
                disabled={loading || !phone.trim()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar Instructivo
              </button>
            </div>

            {/* Card: SMS Personalizado */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-pink-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">SMS Personalizado</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enviar un mensaje personalizado al cliente.
              </p>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Escribí tu mensaje..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleSendSms('custom', customMessage)}
                disabled={loading || !phone.trim() || !customMessage.trim()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar SMS
              </button>
            </div>
          </div>
        </div>

        {/* Historial de Envíos */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Historial de Envíos</h2>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Ver historial
            </button>
          </div>
          
          {sendHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay registros recientes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destino
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Servicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sendHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
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
      </div>
    </div>
  )
}
