'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import PageHeader from '@/components/PageHeader'
import KpiCard from '@/components/KpiCard'
import StatusBadge from '@/components/StatusBadge'
import { interactionsApi, Interaction } from '@/lib/api'
import Link from 'next/link'
import { MessageSquare, Filter, ExternalLink, Clock, User, CheckCircle2, XCircle, AlertCircle, MessageCircle } from 'lucide-react'

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
    <PageShell>
      <PageHeader
        icon={MessageSquare}
        iconClassName="bg-status-success text-white"
        title="Gestión de WhatsApp"
        subtitle="Administra y revisa todas las conversaciones de WhatsApp"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KpiCard icon={MessageCircle} iconBg="bg-emerald-100" iconColor="text-status-success" value={stats.total} label="Conversaciones" />
        <KpiCard icon={MessageSquare} value={stats.totalMessages} label="Total Mensajes" />
        <KpiCard icon={Clock} iconBg="bg-blue-100" iconColor="text-primary-container" value={stats.inProgress} label="En Progreso" />
        <KpiCard icon={User} iconBg="bg-amber-100" iconColor="text-amber-700" value={stats.unassigned} label="Sin Asignar" />
      </div>

      <div className="surface-card p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-emerald-100 p-1.5 rounded-lg text-status-success">
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-status-success border-t-transparent" />
          <p className="mt-4 text-on-surface-variant font-medium">Cargando conversaciones...</p>
        </div>
      ) : interactions.length === 0 ? (
        <div className="surface-card p-16 text-center">
          <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-10 h-10 text-outline" />
          </div>
          <h3 className="text-xl font-semibold text-on-surface mb-2">No hay conversaciones registradas</h3>
          <p className="text-on-surface-variant">No se encontraron conversaciones con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {interactions.map((interaction) => {
            const statusConfig = getStatusBadge(interaction.status)
            const StatusIcon = statusConfig.icon
            const messageCount = getMessageCount(interaction)

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
                    <p className="text-sm text-on-surface-variant">
                      Hacia: {interaction.to || 'Número desconocido'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Mensajes</span>
                    <p className="text-sm font-medium tabular-nums text-on-surface">
                      {messageCount} {messageCount === 1 ? 'mensaje' : 'mensajes'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Agente</span>
                    <p className="text-sm font-medium text-on-surface">
                      {interaction.assignedAgent || 'Sin asignar'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Última actividad</span>
                    <p className="text-sm font-medium tabular-nums text-on-surface">
                      {formatDate(interaction.updatedAt || interaction.startedAt || interaction.createdAt)}
                    </p>
                  </div>
                </div>

                <Link href={`/interaction/${interaction.id}`} className="btn-primary w-full md:w-auto">
                  Ver conversación
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
            Mostrando <span className="font-bold text-on-surface">{stats.total}</span> conversaciones
          </p>
          <p className="text-sm text-on-surface-variant">
            Total mensajes: <span className="font-semibold tabular-nums">{stats.totalMessages}</span>
          </p>
        </div>
      )}
    </PageShell>
  )
}
