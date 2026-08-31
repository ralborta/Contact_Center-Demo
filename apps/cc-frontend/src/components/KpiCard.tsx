'use client'

import { ReactNode } from 'react'
import { LucideIcon, TrendingUp } from 'lucide-react'

export default function KpiCard({
  icon: Icon,
  iconBg = 'bg-primary-fixed',
  iconColor = 'text-primary-container',
  value,
  label,
  footer,
}: {
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  value: ReactNode
  label: string
  footer?: ReactNode
}) {
  return (
    <div className="surface-card hover-elevate p-6 flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <TrendingUp className="w-4 h-4 text-outline-variant" />
      </div>
      <div className="text-[32px] leading-10 font-bold text-on-surface tabular-nums">{value}</div>
      <div className="text-sm text-on-surface-variant mt-1">{label}</div>
      {footer && <div className="mt-4 pt-4 border-t border-[#E5E7EB]">{footer}</div>}
    </div>
  )
}
