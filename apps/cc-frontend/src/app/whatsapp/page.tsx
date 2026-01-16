'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { interactionsApi, Interaction } from '@/lib/api'
import Link from 'next/link'
import { MessageSquare, Filter, ExternalLink, Clock, User, CheckCircle2, XCircle, AlertCircle, TrendingUp, MessageCircle } from 'lucide-react'

export default function WhatsAppPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await interactionsApi.getAll({
          channel: 'WHATSAPP',
          status: filters.status || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        })
        // Ordenar por updatedAt o startedAt (más reciente primero)
        const sorted = (data || []).sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.startedAt || a.createdAt).getTime()
          const dateB = new Date(b.updatedAt || b.startedAt || b.createdAt).getTime()
          return dateB - dateA
        })
        setInteractions(sorted)
      } catch (error) {
        console.error('Error fetching WhatsApp:', error)
        setInteractions([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Auto-refresh cada 10 segundos para ver nuevos mensajes
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [filters])

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: any }> = {
      COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
      IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
      ABANDONED: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle },
      NEW: { bg: 'bg-gray-100', text: 'text-gray-700', icon: MessageSquare },
      FAILED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
    }
    return config[status] || config.NEW
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getMessageCount = (interaction: Interaction) => {
    return interaction.messages?.length || 0
  }

  // Calcular estadísticas
  const stats = {
    total: interactions.length,
    totalMessages: interactions.reduce((acc, i) => acc + getMessageCount(i), 0),
    inProgress: interactions.filter((i) => i.status === 'IN_PROGRESS').length,
    completed: interactions.filter((i) => i.status === 'COMPLETED').length,
    unassigned: interactions.filter((i) => !i.assignedAgent).length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header con título mejorado */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-2">
            <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Gestión de WhatsApp</h1>
              <p className="text-gray-600 mt-1">Administra y revisa todas las conversaciones de WhatsApp</p>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600 mt-1">Conversaciones</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalMessages}</p>
            <p className="text-sm text-gray-600 mt-1">Total Mensajes</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.inProgress}</p>
            <p className="text-sm text-gray-600 mt-1">En Progreso</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <User className="w-6 h-6 text-amber-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.unassigned}</p>
            <p className="text-sm text-gray-600 mt-1">Sin Asignar</p>
          </div>
        </div>

        {/* Filtros mejorados */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <Filter className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              >
                <option value="">Todos</option>
                <option value="NEW">Nueva</option>
                <option value="IN_PROGRESS">En Progreso</option>
                <option value="COMPLETED">Completada</option>
                <option value="ABANDONED">Abandonada</option>
                <option value="FAILED">Fallida</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Desde
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Hasta
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Lista de conversaciones con cards */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Cargando conversaciones...</p>
          </div>
        ) : interactions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay conversaciones registradas</h3>
            <p className="text-gray-600">No se encontraron conversaciones con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => {
              const statusConfig = getStatusBadge(interaction.status)
              const StatusIcon = statusConfig.icon
              const messageCount = getMessageCount(interaction)
              
              return (
                <div
                  key={interaction.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:border-green-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`p-3 ${statusConfig.bg} rounded-xl`}>
                          <StatusIcon className={`w-6 h-6 ${statusConfig.text}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">
                              {interaction.from || 'Número desconocido'}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                              {interaction.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Hacia: {interaction.to || 'Número desconocido'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Mensajes</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {messageCount} {messageCount === 1 ? 'mensaje' : 'mensajes'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Agente</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {interaction.assignedAgent || 'Sin asignar'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Última actividad</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(interaction.updatedAt || interaction.startedAt || interaction.createdAt)}
                            </p>
                          </div>
                        </div>
                        {interaction.intent && (
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Intención</p>
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {interaction.intent}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="ml-6">
                      <Link
                        href={`/interaction/${interaction.id}`}
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                      >
                        <span>Ver conversación</span>
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer con total */}
        {!loading && interactions.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <p className="text-gray-600 font-medium">
                Mostrando <span className="font-bold text-gray-900">{stats.total}</span> conversaciones
              </p>
              <p className="text-sm text-gray-500">
                Total mensajes: <span className="font-semibold">{stats.totalMessages}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
