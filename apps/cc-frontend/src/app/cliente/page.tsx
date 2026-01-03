'use client'

import { useEffect, useState } from 'react'
import { Interaction, interactionsApi } from '@/lib/api'
import Link from 'next/link'
import Header from '@/components/Header'
import {
  Phone,
  MessageSquare,
  Mail,
  Clock,
  CheckCircle,
  User,
  Search,
} from 'lucide-react'

export default function ClientsPage() {
  const [clients, setClients] = useState<Map<string, Interaction[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener todas las interacciones
        const data = await interactionsApi.getAll()
        
        // Agrupar por número de teléfono (from)
        const clientsMap = new Map<string, Interaction[]>()
        
        data.forEach((interaction) => {
          const phone = interaction.from
          if (!clientsMap.has(phone)) {
            clientsMap.set(phone, [])
          }
          clientsMap.get(phone)!.push(interaction)
        })
        
        // Ordenar cada grupo por fecha (más reciente primero)
        clientsMap.forEach((interactions, phone) => {
          interactions.sort((a, b) => {
            const dateA = new Date(a.startedAt || a.createdAt).getTime()
            const dateB = new Date(b.startedAt || b.createdAt).getTime()
            return dateB - dateA
          })
        })
        
        setClients(clientsMap)
      } catch (error) {
        console.error('Error fetching clients:', error)
        setClients(new Map())
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

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

  const getLastInteractionTime = (interactions: Interaction[]) => {
    if (interactions.length === 0) return 'N/A'
    const last = interactions[0]
    const date = new Date(last.startedAt || last.createdAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `hace ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    return `hace ${diffDays} días`
  }

  const getClientName = (interactions: Interaction[]) => {
    // Buscar el nombre del cliente en las interacciones
    const withName = interactions.find((i) => i.customerRef)
    return withName?.customerRef || 'Cliente'
  }

  const getClientStats = (interactions: Interaction[]) => {
    const calls = interactions.filter((i) => i.channel === 'CALL').length
    const whatsapp = interactions.filter((i) => i.channel === 'WHATSAPP').length
    const sms = interactions.filter((i) => i.channel === 'SMS').length
    const resolved = interactions.filter((i) => i.outcome === 'RESOLVED').length
    
    return { calls, whatsapp, sms, resolved, total: interactions.length }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'CALL':
        return <Phone className="w-4 h-4 text-blue-600" />
      case 'WHATSAPP':
        return <MessageSquare className="w-4 h-4 text-green-600" />
      case 'SMS':
        return <Mail className="w-4 h-4 text-blue-500" />
      default:
        return <Phone className="w-4 h-4" />
    }
  }

  // Filtrar clientes por búsqueda
  const filteredClients = Array.from(clients.entries()).filter(([phone, interactions]) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const clientName = getClientName(interactions).toLowerCase()
    return (
      phone.toLowerCase().includes(query) ||
      clientName.includes(query)
    )
  })

  // Ordenar por última interacción (más reciente primero)
  filteredClients.sort((a, b) => {
    const dateA = new Date(a[1][0]?.startedAt || a[1][0]?.createdAt || 0).getTime()
    const dateB = new Date(b[1][0]?.startedAt || b[1][0]?.createdAt || 0).getTime()
    return dateB - dateA
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-lg">Cargando clientes...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-6 py-6">
        {/* Header de la página */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Clientes</h1>
          
          {/* Búsqueda */}
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Lista de Clientes */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map(([phone, interactions]) => {
              const clientName = getClientName(interactions)
              const stats = getClientStats(interactions)
              const lastInteraction = interactions[0]
              
              return (
                <Link
                  key={phone}
                  href={`/cliente/${encodeURIComponent(phone)}`}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200"
                >
                  {/* Header del Card */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {clientName.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Nombre y Teléfono */}
                      <div>
                        <h3 className="font-semibold text-gray-900">{clientName}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {phone}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Estadísticas */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm font-medium">{stats.calls}</span>
                      </div>
                      <p className="text-xs text-gray-500">Llamadas</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm font-medium">{stats.whatsapp}</span>
                      </div>
                      <p className="text-xs text-gray-500">WhatsApp</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm font-medium">{stats.sms}</span>
                      </div>
                      <p className="text-xs text-gray-500">SMS</p>
                    </div>
                  </div>

                  {/* Última Interacción */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Última interacción</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getLastInteractionTime(interactions)}
                      </span>
                    </div>
                    
                    {lastInteraction && (
                      <div className="flex items-center gap-2">
                        {getChannelIcon(lastInteraction.channel)}
                        <span className="text-sm text-gray-700 flex-1 truncate">
                          {lastInteraction.channel === 'CALL'
                            ? 'Llamada'
                            : lastInteraction.channel === 'WHATSAPP'
                            ? 'WhatsApp'
                            : 'SMS'}
                        </span>
                        {lastInteraction.outcome === 'RESOLVED' && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Total de Interacciones */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Total interacciones</span>
                      <span className="text-sm font-semibold text-gray-900">{stats.total}</span>
                    </div>
                    {stats.resolved > 0 && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">Resueltas</span>
                        <span className="text-sm font-medium text-green-600">
                          {stats.resolved} ({Math.round((stats.resolved / stats.total) * 100)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
