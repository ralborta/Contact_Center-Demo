'use client'

import dynamic from 'next/dynamic'

// Lazy load Dashboard to avoid SSR issues
const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <div className="text-on-surface-variant">Cargando...</div>
    </div>
  ),
})

export default function Home() {
  return <Dashboard />
}
