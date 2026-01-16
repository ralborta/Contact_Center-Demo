'use client'

import { Interaction } from '@/lib/api'
import VolumeChart from './VolumeChart'
import ReasonsChart from './ReasonsChart'
import CallStatusChart from './CallStatusChart'
import { BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react'

interface ChartsSectionProps {
  interactions: Interaction[]
}

export default function ChartsSection({ interactions }: ChartsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Volumen de Contactos */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Volumen de Contactos</h3>
        </div>
        <VolumeChart interactions={interactions} />
      </div>

      {/* Motivos Principales */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
            <PieChartIcon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Motivos Principales</h3>
        </div>
        <ReasonsChart interactions={interactions} />
      </div>

      {/* Estado de Llamadas */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Estado de las Llamadas</h3>
        </div>
        <CallStatusChart interactions={interactions} />
      </div>
    </div>
  )
}
