'use client'

import { ReactNode } from 'react'
import Header from './Header'

export default function PageShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="min-h-screen bg-surface-base text-on-surface antialiased">
      <Header />
      <main className={`w-full max-w-container-max mx-auto px-4 md:px-10 py-8 ${className}`}>
        {children}
      </main>
    </div>
  )
}
