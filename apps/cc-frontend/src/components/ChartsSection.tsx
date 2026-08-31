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
      <div className="surface-card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-primary-fixed rounded-lg">
            <BarChart3 className="w-5 h-5 text-primary-container" />
          </div>
          <h3 className="text-xl font-semibold text-on-surface">Volumen de Contactos</h3>
        </div>
        <VolumeChart interactions={interactions} />
      </div>

      <div className="surface-card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-secondary-container rounded-lg">
            <PieChartIcon className="w-5 h-5 text-on-secondary-container" />
          </div>
          <h3 className="text-xl font-semibold text-on-surface">Motivos Principales</h3>
        </div>
        <ReasonsChart interactions={interactions} />
      </div>

      <div className="surface-card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-primary-fixed rounded-lg">
            <Activity className="w-5 h-5 text-primary-container" />
          </div>
          <h3 className="text-xl font-semibold text-on-surface">Estado de las Llamadas</h3>
        </div>
        <CallStatusChart interactions={interactions} />
      </div>
    </div>
  )
}
