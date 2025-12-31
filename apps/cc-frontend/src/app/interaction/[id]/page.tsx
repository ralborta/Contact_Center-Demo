'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import InteractionDetail from '@/components/InteractionDetail'
import { interactionsApi, Interaction } from '@/lib/api'

export default function InteractionPage() {
  const params = useParams()
  const id = params.id as string
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInteraction = async () => {
      try {
        const data = await interactionsApi.getById(id)
        setInteraction(data)
      } catch (error) {
        console.error('Error fetching interaction:', error)
        setInteraction(null) // Set null on error
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchInteraction()
    } else {
      setLoading(false)
    }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

  if (!interaction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-red-600">Interacción no encontrada</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <InteractionDetail interaction={interaction} />
      </div>
    </div>
  )
}
