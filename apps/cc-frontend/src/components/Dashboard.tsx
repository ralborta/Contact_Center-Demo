'use client'

import { useEffect, useState } from 'react'
import PageShell from './PageShell'
import PageHeader from './PageHeader'
import MetricsCards from './MetricsCards'
import ChartsSection from './ChartsSection'
import AgentsTable from './AgentsTable'
import RecentInteractions from './RecentInteractions'
import { interactionsApi, Interaction } from '@/lib/api'
import { LayoutDashboard } from 'lucide-react'

export default function Dashboard() {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const data = await interactionsApi.getAll({
          dateFrom: today.toISOString(),
        })
        setInteractions(data || [])
      } catch (error) {
        console.error('Error fetching interactions:', error)
        setInteractions([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <PageShell>
        <p className="text-on-surface-variant">Cargando dashboard...</p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Operación del día — Contact Center Bancario"
      />
      <MetricsCards interactions={interactions} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <ChartsSection interactions={interactions} />
        <div className="space-y-6">
          <AgentsTable interactions={interactions} />
          <RecentInteractions interactions={interactions} />
        </div>
      </div>
    </PageShell>
  )
}
