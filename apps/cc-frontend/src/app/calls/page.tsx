'use client'

import { useEffect, useState, useCallback } from 'react'
import PageShell from '@/components/PageShell'
import PageHeader from '@/components/PageHeader'
import KpiCard from '@/components/KpiCard'
import StatusBadge from '@/components/StatusBadge'
import { interactionsApi, elevenlabsApi, Interaction } from '@/lib/api'
import Link from 'next/link'
import { Phone, Filter, ExternalLink, Clock, User, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

export default function CallsPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
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
  }, [filters.status, filters.dateFrom, filters.dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      await elevenlabsApi.sync({ syncDetails: true, limit: 100 })
      await fetchData()
    } catch (e: any) {
      setSyncError(e.response?.data?.error || e.message || 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

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
    <PageShell>
      <PageHeader
        icon={Phone}
        title="Gestión de Llamadas"
        subtitle="Administra y revisa todas las llamadas telefónicas"
        action={
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs tracking-wider uppercase rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar desde ElevenLabs'}
            </button>
            {syncError && <p className="text-sm text-status-error">{syncError}</p>}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard icon={Phone} value={stats.total} label="Total de Llamadas" />
        <KpiCard icon={CheckCircle2} iconBg="bg-emerald-100" iconColor="text-status-success" value={stats.completed} label="Completadas" />
        <KpiCard icon={Clock} iconBg="bg-blue-100" iconColor="text-primary-container" value={stats.inProgress} label="En Progreso" />
        <KpiCard icon={XCircle} iconBg="bg-red-100" iconColor="text-status-error" value={stats.failed} label="Fallidas" />
      </div>

      <div className="surface-card p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-primary-fixed p-1.5 rounded-lg text-primary-container">
            <Filter className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-semibold text-on-surface">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="field-input"
            >
              <option value="">Todos</option>
              <option value="NEW">Nueva</option>
              <option value="IN_PROGRESS">En Progreso</option>
              <option value="COMPLETED">Completada</option>
              <option value="ABANDONED">Abandonada</option>
              <option value="FAILED">Fallida</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">Desde</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="field-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">Hasta</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="field-input"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-container border-t-transparent" />
          <p className="mt-4 text-on-surface-variant font-medium">Cargando llamadas...</p>
        </div>
      ) : interactions.length === 0 ? (
        <div className="surface-card p-16 text-center">
          <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-10 h-10 text-outline" />
          </div>
          <h3 className="text-xl font-semibold text-on-surface mb-2">No hay llamadas registradas</h3>
          <p className="text-on-surface-variant">No se encontraron llamadas con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {interactions.map((interaction) => {
            const statusConfig = getStatusBadge(interaction.status)
            const StatusIcon = statusConfig.icon

            return (
              <div
                key={interaction.id}
                className="surface-card hover-elevate p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${statusConfig.bg} rounded-full flex items-center justify-center shrink-0`}>
                    <StatusIcon className={`w-6 h-6 ${statusConfig.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-xl font-semibold text-on-surface">
                        {interaction.from || 'Número desconocido'}
                      </h4>
                      <StatusBadge status={interaction.status} />
                    </div>
                    <p className="text-sm text-on-surface-variant mt-0.5">
                      Hacia: {interaction.to || 'Número desconocido'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center gap-6 md:gap-8">
                  <div className="flex items-center gap-2">
                    <Clock className="w-[18px] h-[18px] text-outline" />
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Duración</span>
                      <p className="text-sm font-medium tabular-nums text-on-surface">
                        {formatDuration(interaction.callDetail?.durationSec)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-[18px] h-[18px] text-outline" />
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Agente</span>
                      <p className="text-sm font-medium text-on-surface">
                        {interaction.assignedAgent || 'Sin asignar'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-[18px] h-[18px] text-outline" />
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Fecha</span>
                      <p className="text-sm font-medium tabular-nums text-on-surface">
                        {formatDate(interaction.startedAt || interaction.createdAt)}
                      </p>
                    </div>
                  </div>
                  {interaction.intent && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-[18px] h-[18px] text-outline" />
                      <div>
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Intención</span>
                        <p className="text-sm font-medium text-on-surface truncate max-w-[160px]">
                          {interaction.intent}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Link href={`/interaction/${interaction.id}`} className="btn-primary w-full md:w-auto">
                  Ver detalle
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {!loading && interactions.length > 0 && (
        <div className="mt-8 surface-card p-6 flex items-center justify-between">
          <p className="text-on-surface-variant">
            Mostrando <span className="font-bold text-on-surface">{interactions.length}</span> llamadas
          </p>
          {stats.avgDuration > 0 && (
            <p className="text-sm text-on-surface-variant">
              Duración promedio: <span className="font-semibold tabular-nums">{formatDuration(stats.avgDuration)}</span>
            </p>
          )}
        </div>
      )}
    </PageShell>
  )
}
