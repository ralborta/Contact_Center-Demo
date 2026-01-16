'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { interactionsApi, Interaction } from '@/lib/api'
import Link from 'next/link'
import { Phone, Filter, ExternalLink, Clock, User, CheckCircle2, XCircle, AlertCircle, TrendingUp } from 'lucide-react'

export default function CallsPage() {
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
          channel: 'CALL',
          status: filters.status || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        })
        setInteractions(data || [])
      } catch (error) {
        console.error('Error fetching calls:', error)
        setInteractions([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [filters])

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: any }> = {
      COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
      IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
      ABANDONED: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle },
      NEW: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Phone },
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

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  // Calcular estadísticas
  const stats = {
    total: interactions.length,
    completed: interactions.filter((i) => i.status === 'COMPLETED').length,
    inProgress: interactions.filter((i) => i.status === 'IN_PROGRESS').length,
    failed: interactions.filter((i) => i.status === 'FAILED' || i.status === 'ABANDONED').length,
    avgDuration: interactions.reduce((acc, i) => acc + (i.callDetail?.durationSec || 0), 0) / interactions.length || 0,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header con título mejorado */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-2">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Gestión de Llamadas</h1>
              <p className="text-gray-600 mt-1">Administra y revisa todas las llamadas telefónicas</p>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600 mt-1">Total de Llamadas</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
            <p className="text-sm text-gray-600 mt-1">Completadas</p>
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
              <div className="p-3 bg-red-100 rounded-xl">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.failed}</p>
            <p className="text-sm text-gray-600 mt-1">Fallidas</p>
          </div>
        </div>

        {/* Filtros mejorados */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600" />
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
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Lista de llamadas con cards */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Cargando llamadas...</p>
          </div>
        ) : interactions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay llamadas registradas</h3>
            <p className="text-gray-600">No se encontraron llamadas con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => {
              const statusConfig = getStatusBadge(interaction.status)
              const StatusIcon = statusConfig.icon
              
              return (
                <div
                  key={interaction.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`p-3 ${statusConfig.bg} rounded-xl`}>
                          <StatusIcon className={`w-6 h-6 ${statusConfig.text}`} />
                        </div>
                        <div>
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-bold text-gray-900">
                              {interaction.from || 'Número desconocido'}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                              {interaction.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Hacia: {interaction.to || 'Número desconocido'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Duración</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDuration(interaction.callDetail?.durationSec)}
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
                          <Phone className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Fecha</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(interaction.startedAt || interaction.createdAt)}
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
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                      >
                        <span>Ver detalle</span>
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
                Mostrando <span className="font-bold text-gray-900">{interactions.length}</span> llamadas
              </p>
              {stats.avgDuration > 0 && (
                <p className="text-sm text-gray-500">
                  Duración promedio: <span className="font-semibold">{formatDuration(stats.avgDuration)}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
