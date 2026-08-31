'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import PageShell from '@/components/PageShell'

// Lazy load ClientProfile to avoid SSR issues
const ClientProfile = dynamic(() => import('@/components/ClientProfile'), {
  ssr: false,
  loading: () => (
    <PageShell>
      <p className="text-on-surface-variant">Cargando perfil del cliente...</p>
    </PageShell>
  ),
})

export default function ClientPage() {
  const params = useParams()
  const phone = params.phone as string

  return (
    <PageShell>
      <ClientProfile phone={phone} />
    </PageShell>
  )
}
