'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getToken } from '@/lib/auth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (pathname === '/login') {
      setReady(true)
      return
    }
    if (!getToken()) {
      window.location.href = '/login'
      return
    }
    setReady(true)
  }, [pathname])

  if (pathname === '/login') {
    return <>{children}</>
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <p className="text-on-surface-variant">Redirigiendo al login...</p>
      </div>
    )
  }

  return <>{children}</>
}
