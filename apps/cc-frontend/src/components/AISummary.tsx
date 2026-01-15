'use client'

import { useEffect, useState } from 'react'
import { interactionsApi } from '@/lib/api'
import { Brain, TrendingUp, Clock } from 'lucide-react'

interface AISummaryProps {
  phone: string
}

interface AISummaryData {
  summary: string
  keyPoints: string[]
  suggestedActions: string[]
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  generatedAt: string
}

export default function AISummary({ phone }: AISummaryProps) {
  const [summaryData, setSummaryData] = useState<AISummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await interactionsApi.getClientAISummary(phone)
        setSummaryData(data)
      } catch (err: any) {
        console.error('Error fetching AI summary:', err)
        setError(err.message || 'Error al generar resumen')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [phone])

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE':
        return 'bg-green-100 text-green-700'
      case 'NEGATIVE':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE':
        return 'Positivo'
      case 'NEGATIVE':
        return 'Negativo'
      default:
        return 'Neutral'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Generando resumen inteligente...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    )
  }

  if (!summaryData) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-lg p-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-white" />
          <h2 className="text-xl font-semibold text-white">Resumen Inteligente</h2>
        </div>
      </div>

      <div className="p-6">
        {/* Resumen Principal */}
        <div className="mb-6">
          <div className="border-l-4 border-blue-500 pl-4">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {summaryData.summary}
            </p>
          </div>
        </div>

        {/* Puntos Clave */}
        {summaryData.keyPoints.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Puntos Clave</h3>
            </div>
            <ul className="space-y-2">
              {summaryData.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Próximos Pasos Sugeridos */}
        {summaryData.suggestedActions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Próximos Pasos Sugeridos</h3>
            </div>
            <ul className="space-y-2">
              {summaryData.suggestedActions.map((action, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">→</span>
                  <span className="text-gray-700">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer con Sentimiento y Fecha */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sentimiento:</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(
                summaryData.sentiment
              )}`}
            >
              {getSentimentLabel(summaryData.sentiment)}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Generado: {formatDate(summaryData.generatedAt)}
          </div>
        </div>
      </div>
    </div>
  )
}
