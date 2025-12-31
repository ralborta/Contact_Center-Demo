'use client'

import dynamic from 'next/dynamic'

// Lazy load Dashboard to avoid SSR issues
const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-lg">Cargando...</div>
    </div>
  ),
})

export default function Home() {
  return <Dashboard />
}
