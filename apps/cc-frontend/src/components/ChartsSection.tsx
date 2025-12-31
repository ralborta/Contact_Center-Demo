'use client'

import { Interaction } from '@/lib/api'
import VolumeChart from './VolumeChart'
import ReasonsChart from './ReasonsChart'
import CallStatusChart from './CallStatusChart'

interface ChartsSectionProps {
  interactions: Interaction[]
}

export default function ChartsSection({ interactions }: ChartsSectionProps) {
  return (
    <div className="space-y-6">
      <VolumeChart interactions={interactions} />
      <ReasonsChart interactions={interactions} />
      <CallStatusChart interactions={interactions} />
    </div>
  )
}
