'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageShell from '@/components/PageShell'
import InteractionDetail from '@/components/InteractionDetail'
import { interactionsApi, Interaction } from '@/lib/api'
import { isAdmin } from '@/lib/auth'
import { Trash2 } from 'lucide-react'

export default function InteractionPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const fetchInteraction = useCallback(async () => {
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
  }, [id])

  useEffect(() => {
    fetchInteraction()
    
    // Auto-refresh cada 5 segundos para WhatsApp y SMS (para ver nuevos mensajes)
    const interval = setInterval(() => {
      fetchInteraction()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [fetchInteraction])

  if (loading) {
    return (
      <PageShell>
        <p className="text-on-surface-variant">Cargando...</p>
      </PageShell>
    )
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta interacción y todos sus datos?')) return
    setDeleting(true)
    try {
      await interactionsApi.delete(id)
      router.push('/interactions')
    } catch (e) {
      console.error(e)
      alert('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  if (!interaction) {
    return (
      <PageShell>
        <p className="text-lg text-status-error">Interacción no encontrada</p>
      </PageShell>
    )
  }

  const admin = typeof window !== 'undefined' && isAdmin()

  return (
    <PageShell>
      {admin && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-status-error border border-error/30 rounded-lg hover:bg-error-container disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar interacción
          </button>
        </div>
      )}
      <InteractionDetail interaction={interaction} onRefresh={fetchInteraction} />
    </PageShell>
  )
}
