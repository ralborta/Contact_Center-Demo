'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import PageHeader from '@/components/PageHeader'
import { Interaction, interactionsApi } from '@/lib/api'
import Link from 'next/link'
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
      <PageShell>
        <p className="text-on-surface-variant">Cargando clientes...</p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        icon={Users}
        title="Clientes"
        subtitle="Gestiona y revisa todos tus clientes"
      />

      <div className="relative max-w-md mb-8">
        <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-outline" />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="field-input pl-12"
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <User className="w-16 h-16 text-outline mx-auto mb-4" />
          <p className="text-on-surface-variant text-lg">
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

            return (
              <Link
                key={phone}
                href={`/cliente/${encodeURIComponent(phone)}`}
                className="group surface-card hover-elevate p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center text-on-primary font-bold text-lg">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-semibold text-on-surface text-lg group-hover:text-primary-container transition-colors">
                        {clientName}
                      </h3>
                      <p className="text-sm text-on-surface-variant flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span className="truncate max-w-[150px] tabular-nums">{phone}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-surface-container-low rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-primary-container mb-1">
                      <Phone className="w-4 h-4" />
                      <span className="text-lg font-bold tabular-nums">{stats.calls}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">Llamadas</p>
                  </div>
                  <div className="text-center p-3 bg-surface-container-low rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-status-success mb-1">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-lg font-bold tabular-nums">{stats.whatsapp}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">WhatsApp</p>
                  </div>
                  <div className="text-center p-3 bg-surface-container-low rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-tertiary mb-1">
                      <Mail className="w-4 h-4" />
                      <span className="text-lg font-bold tabular-nums">{stats.sms}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">SMS</p>
                  </div>
                </div>

                <div className="border-t border-[#E5E7EB] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-on-surface-variant font-medium">Última interacción</span>
                    <span className="text-xs text-on-surface-variant flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getLastInteractionTime(interactions)}
                    </span>
                  </div>
                  {lastInteraction && (
                    <div className="flex items-center gap-2 p-2 bg-surface-container-low rounded-lg">
                      {getChannelIcon(lastInteraction.channel)}
                      <span className="text-sm text-on-surface flex-1 truncate">
                        {lastInteraction.channel === 'CALL'
                          ? 'Llamada'
                          : lastInteraction.channel === 'WHATSAPP'
                          ? 'WhatsApp'
                          : 'SMS'}
                      </span>
                      {lastInteraction.outcome === 'RESOLVED' && (
                        <CheckCircle className="w-4 h-4 text-status-success" />
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-on-surface-variant font-medium">Total interacciones</span>
                    <span className="text-lg font-bold text-primary-container tabular-nums">{stats.total}</span>
                  </div>
                  {stats.resolved > 0 && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-on-surface-variant">Resueltas</span>
                      <span className="text-sm font-semibold text-status-success">
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
    </PageShell>
  )
}
