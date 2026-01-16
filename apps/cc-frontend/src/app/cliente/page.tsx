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
  Users,
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-purple-50">
      <Header />
      
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header de la página */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Clientes</h1>
              <p className="text-gray-600 mt-1">Gestiona y revisa todos tus clientes</p>
            </div>
          </div>
          
          {/* Búsqueda mejorada */}
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
        </div>

        {/* Lista de Clientes */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map(([phone, interactions]) => {
              const clientName = getClientName(interactions)
              const stats = getClientStats(interactions)
              const lastInteraction = interactions[0]
              const initials = clientName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || clientName.charAt(0).toUpperCase()
              
              // Colores de gradiente para el avatar basados en el nombre
              const gradientColors = [
                'from-blue-400 to-blue-600',
                'from-purple-400 to-purple-600',
                'from-pink-400 to-pink-600',
                'from-indigo-400 to-indigo-600',
                'from-cyan-400 to-cyan-600',
                'from-emerald-400 to-emerald-600',
                'from-orange-400 to-orange-600',
                'from-rose-400 to-rose-600',
              ]
              const colorIndex = clientName.charCodeAt(0) % gradientColors.length
              const avatarGradient = gradientColors[colorIndex]
              
              return (
                <Link
                  key={phone}
                  href={`/cliente/${encodeURIComponent(phone)}`}
                  className="group bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-indigo-200 hover:scale-[1.02]"
                >
                  {/* Header del Card */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar con gradiente */}
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-110 transition-transform`}>
                        {initials}
                      </div>
                      
                      {/* Nombre y Teléfono */}
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-indigo-600 transition-colors">
                          {clientName}
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{phone}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Estadísticas con iconos coloridos */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                      <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                        <Phone className="w-4 h-4" />
                        <span className="text-lg font-bold">{stats.calls}</span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">Llamadas</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-lg font-bold">{stats.whatsapp}</span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">WhatsApp</p>
                    </div>
                    <div className="text-center p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                      <div className="flex items-center justify-center gap-1 text-indigo-600 mb-1">
                        <Mail className="w-4 h-4" />
                        <span className="text-lg font-bold">{stats.sms}</span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">SMS</p>
                    </div>
                  </div>

                  {/* Última Interacción */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-medium">Última interacción</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getLastInteractionTime(interactions)}
                      </span>
                    </div>
                    
                    {lastInteraction && (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
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
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">Total interacciones</span>
                      <span className="text-lg font-bold text-indigo-600">{stats.total}</span>
                    </div>
                    {stats.resolved > 0 && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">Resueltas</span>
                        <span className="text-sm font-semibold text-green-600">
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
