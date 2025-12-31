'use client'

import { useEffect, useState } from 'react'
import Header from './Header'
import MetricsCards from './MetricsCards'
import ChartsSection from './ChartsSection'
import AgentsTable from './AgentsTable'
import RecentInteractions from './RecentInteractions'
import { interactionsApi, Interaction } from '@/lib/api'

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
        setInteractions([]) // Set empty array on error
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <MetricsCards interactions={interactions} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <ChartsSection interactions={interactions} />
          <div className="space-y-6">
            <AgentsTable interactions={interactions} />
            <RecentInteractions interactions={interactions} />
          </div>
        </div>
      </div>
    </div>
  )
}
