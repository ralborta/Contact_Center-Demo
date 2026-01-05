'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import InteractionDetail from '@/components/InteractionDetail'
import { interactionsApi, Interaction } from '@/lib/api'

export default function InteractionPage() {
  const params = useParams()
  const id = params.id as string
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInteraction = async () => {
    if (!id) {
      setLoading(false)
      return
    }

    try {
      const data = await interactionsApi.getById(id)
      setInteraction(data)
    } catch (error) {
      console.error('Error fetching interaction:', error)
      setInteraction(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInteraction()
    
    // Auto-refresh cada 5 segundos para WhatsApp y SMS (para ver nuevos mensajes)
    const interval = setInterval(() => {
      fetchInteraction()
    }, 5000)
    
    return () => clearInterval(interval)
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
        <InteractionDetail interaction={interaction} onRefresh={fetchInteraction} />
      </div>
    </div>
  )
}
