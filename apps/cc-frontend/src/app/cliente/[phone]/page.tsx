'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'

// Lazy load ClientProfile to avoid SSR issues
const ClientProfile = dynamic(() => import('@/components/ClientProfile'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-lg">Cargando perfil del cliente...</div>
    </div>
  ),
})

export default function ClientPage() {
  const params = useParams()
  const phone = params.phone as string

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <ClientProfile phone={phone} />
    </div>
  )
}
