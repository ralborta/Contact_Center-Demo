'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

export default function PageHeader({
  icon: Icon,
  iconClassName = 'bg-primary-container text-on-primary',
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon
  iconClassName?: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${iconClassName}`}>
          <Icon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-[28px] md:text-[32px] leading-10 font-bold tracking-tight text-on-surface">
            {title}
          </h2>
          {subtitle && (
            <p className="text-base text-on-surface-variant mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </header>
  )
}
