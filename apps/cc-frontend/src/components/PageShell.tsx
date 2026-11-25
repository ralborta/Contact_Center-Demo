'use client'

import Header from './Header'

export default function PageShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-hero-mesh">
      <Header />
      <main className="max-w-container-max mx-auto px-4 md:px-8 py-6 md:py-8 animate-fade-up">
        {(title || actions) && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              {title && <h2 className="page-title">{title}</h2>}
              {subtitle && <p className="text-sm text-on-surface-variant mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
