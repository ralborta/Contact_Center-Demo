'use client'

import { useEffect, useState } from 'react'
import { Interaction, interactionsApi } from '@/lib/api'
import {
  Phone,
  MessageSquare,
  Mail,
  CheckCircle,
  Star,
  MapPin,
  CreditCard,
  FileText,
  Tag,
  Clock,
  Search,
  Settings,
  ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import AISummary from './AISummary'
import ClientManagementModal from './ClientManagementModal'

interface ClientProfileProps {
  phone: string
}

interface ClientProfileData {
  phone: string
  normalizedPhone: string
  interactions: Interaction[]
  stats: {
    totalInteractions: number
    inboundCalls: number
    whatsappInteractions: number
    whatsappMessages: { inbound: number; outbound: number; total: number }
    smsOtpConfirmed: number
    resolvedInteractions: number
    resolvedPercentage: number
  }
  lastInteraction: { id: string; channel: string; startedAt: string | null; createdAt: string } | null
  customerRef: string | null
}

export default function ClientProfile({ phone }: ClientProfileProps) {
  const [profileData, setProfileData] = useState<ClientProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showManagementModal, setShowManagementModal] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await interactionsApi.getClientProfile(phone)
        setProfileData(data)
      } catch (error) {
        console.error('Error fetching client profile:', error)
        setProfileData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [phone])

  if (loading || !profileData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Cargando perfil del cliente...</div>
      </div>
    )
  }

  const { interactions, stats, lastInteraction, customerRef } = profileData
  
  // Formatear el número de teléfono correctamente
  const formatPhone = (phone: string): string => {
    // Decodificar URL encoding
    let formatted = decodeURIComponent(phone)
    // Si no tiene +, agregarlo si empieza con 54
    if (!formatted.startsWith('+')) {
      if (formatted.startsWith('54')) {
        formatted = '+' + formatted
      } else if (formatted.length > 0) {
        formatted = '+54' + formatted
      }
    }
    return formatted
  }

  const clientName = customerRef || 'Cliente'
  const clientPhone = formatPhone(phone)

  const getLastInteractionTime = () => {
    if (!lastInteraction) return 'N/A'
    const date = new Date(lastInteraction.startedAt || lastInteraction.createdAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `hace ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    return `hace ${diffDays} días`
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

  const formatTime = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'CALL':
        return <Phone className="w-5 h-5 text-blue-600" />
      case 'WHATSAPP':
        return <MessageSquare className="w-5 h-5 text-green-600" />
      case 'SMS':
        return <Mail className="w-5 h-5 text-blue-500" />
      default:
        return <Phone className="w-5 h-5" />
    }
  }

  const getChannelLabel = (interaction: Interaction) => {
    if (interaction.channel === 'CALL') {
      return `ElevenLabs Voice ${interaction.callDetail?.durationSec ? formatDuration(interaction.callDetail.durationSec) : ''}`
    }
    if (interaction.channel === 'WHATSAPP') {
      const messageCount = interaction.messages?.length || 0
      return `WhatsApp (${messageCount} mensajes)`
    }
    if (interaction.channel === 'SMS') {
      return `SMS ${interaction.intent || 'Confirmación'}`
    }
    return interaction.channel
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Cargando perfil del cliente...</div>
      </div>
    )
  }

  // Filtrar interacciones por búsqueda
  const filteredInteractions = interactions.filter((interaction) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      interaction.id.toLowerCase().includes(query) ||
      interaction.intent?.toLowerCase().includes(query) ||
      customerRef?.toLowerCase().includes(query) ||
      interaction.assignedAgent?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Contenido Principal */}
      <div className="container mx-auto px-6 py-6">
        {/* Perfil del Cliente - Card Superior */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {clientName.charAt(0).toUpperCase()}
              </div>
              
              {/* Información del Cliente */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{clientName}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    <span>{clientPhone}</span>
                  </div>
                  {customerRef && customerRef !== 'Cliente' && (
                    <span>DNI: N/A</span>
                  )}
                </div>
              </div>

              {/* Badge Cliente Preferente */}
              <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium">Cliente Preferente</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Última Interacción */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Última interacción: {getLastInteractionTime()}</span>
              </div>

              {/* Botón Gestionar Cliente */}
              <button
                onClick={() => setShowManagementModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Gestionar Cliente</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Resumen Inteligente con IA */}
        <AISummary phone={phone} />

        {/* KPIs y Búsqueda */}
        <div className="flex items-center justify-between mb-6">
          <div className="grid grid-cols-4 gap-4 flex-1">
            {/* KPI: Llamadas Inbound */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Llamadas Inbound</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inboundCalls}</p>
                </div>
                <Phone className="w-8 h-8 text-yellow-500" />
              </div>
            </div>

            {/* KPI: WhatsApps */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">WhatsApps</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.whatsappMessages.total}</p>
                  <p className="text-xs text-gray-500">({stats.whatsappInteractions} conversaciones)</p>
                </div>
                <MessageSquare className="w-8 h-8 text-green-600" />
              </div>
            </div>

            {/* KPI: SMS OTP Confirmados */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">SMS OTP Confirmados</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.smsOtpConfirmed}</p>
                </div>
                <Mail className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            {/* KPI: Interacciones Resueltas */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Interacciones Resueltas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.resolvedPercentage}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="ml-6 flex items-center gap-2">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar interacción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Mostrar</option>
              <option>Todas</option>
              <option>Últimas 24h</option>
              <option>Última semana</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Izquierdo */}
          <div className="lg:col-span-1 space-y-6">
            {/* Perfil del Cliente */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Perfil del Cliente</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">Teléfono: {clientPhone}</span>
                </div>
                {customerRef && customerRef !== 'Cliente' && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">Nombre: {customerRef}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">
                    Total Interacciones: {stats.totalInteractions}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">
                    Resueltas: {stats.resolvedInteractions} ({stats.resolvedPercentage}%)
                  </span>
                </div>
                {lastInteraction && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">
                      Última: {formatDate(lastInteraction.startedAt || lastInteraction.createdAt)}
                    </span>
                  </div>
                )}
                <button className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors mt-4">
                  <Settings className="w-4 h-4" />
                  <span>Gestionar Cliente</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Etiquetas */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Etiquetas</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  Preferente
                </span>
                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                  Posible fraude
                </span>
              </div>
              <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                <Tag className="w-4 h-4" />
                <span>+ Agregar etiqueta</span>
              </button>
            </div>
          </div>

          {/* Lista de Interacciones */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Últimas Interacciones</h3>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <select className="text-sm text-gray-600 border-none bg-transparent">
                    <option>Ordenar</option>
                  </select>
                  <span className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('es-AR')}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {filteredInteractions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No hay interacciones para este cliente
                  </p>
                ) : (
                  filteredInteractions.map((interaction) => (
                    <Link
                      key={interaction.id}
                      href={`/interaction/${interaction.id}`}
                      className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Icono del Canal */}
                        <div className="flex-shrink-0">{getChannelIcon(interaction.channel)}</div>

                        {/* Contenido */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-gray-600">
                              {formatTime(interaction.startedAt || interaction.createdAt)}{' '}
                              {formatDate(interaction.startedAt || interaction.createdAt)}
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                              {getChannelLabel(interaction)}
                            </span>
                          </div>

                          {/* Información del Cliente */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                              {clientName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-800">
                              {clientName}
                            </span>
                            {interaction.channel === 'CALL' && interaction.callDetail?.durationSec && (
                              <span className="text-xs text-gray-500">
                                Duración: {formatDuration(interaction.callDetail.durationSec)}
                              </span>
                            )}
                          </div>

                          {/* Mensajes/Transcripción Preview */}
                          {interaction.channel === 'WHATSAPP' && interaction.messages && (
                            <div className="text-sm text-gray-600 space-y-1 mb-2">
                              {interaction.messages.slice(0, 2).map((msg) => (
                                <div key={msg.id}>
                                  <span className="font-medium">
                                    {msg.direction === 'INBOUND' ? clientName : interaction.assignedAgent || 'Sistema'}
                                    :
                                  </span>{' '}
                                  {msg.text?.substring(0, 80)}
                                  {msg.text && msg.text.length > 80 ? '...' : ''}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Tags y Estado */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                interaction.channel === 'CALL'
                                  ? 'bg-blue-100 text-blue-700'
                                  : interaction.channel === 'WHATSAPP'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {interaction.channel === 'CALL'
                                ? 'Llamada'
                                : interaction.channel === 'WHATSAPP'
                                ? 'WhatsApp'
                                : 'SMS'}
                            </span>
                            {interaction.intent && (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                                {interaction.intent}
                              </span>
                            )}
                            {interaction.assignedAgent && (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                                {interaction.assignedAgent}
                              </span>
                            )}
                            {interaction.outcome === 'RESOLVED' && (
                              <div className="ml-auto flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Resuelta</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Gestión de Cliente */}
      <ClientManagementModal
        phone={phone}
        customerName={clientName}
        isOpen={showManagementModal}
        onClose={() => setShowManagementModal(false)}
        onUpdate={() => {
          // Refrescar datos del perfil
          const fetchData = async () => {
            try {
              const data = await interactionsApi.getClientProfile(phone)
              setProfileData(data)
            } catch (error) {
              console.error('Error fetching client profile:', error)
            }
          }
          fetchData()
        }}
      />
    </div>
  )
}
