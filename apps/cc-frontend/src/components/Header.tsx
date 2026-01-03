'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Phone, MessageSquare, Mail, Bell, User, Users } from 'lucide-react'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [showClientSearch, setShowClientSearch] = useState(false)
  const [clientPhone, setClientPhone] = useState('')

  const handleClientSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (clientPhone.trim()) {
      router.push(`/cliente/${encodeURIComponent(clientPhone.trim())}`)
      setShowClientSearch(false)
      setClientPhone('')
    }
  }

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Centro de Gestión
                </h1>
                <p className="text-xs text-blue-100">Contact Center Bancario</p>
              </div>
            </Link>
          </div>
          <nav className="flex items-center space-x-2">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                pathname === '/'
                  ? 'bg-white/20 backdrop-blur-sm shadow-md'
                  : 'hover:bg-white/10'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <Link
              href="/calls"
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                pathname === '/calls'
                  ? 'bg-white/20 backdrop-blur-sm shadow-md'
                  : 'hover:bg-white/10'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span className="text-sm font-medium">Llamadas</span>
            </Link>
            <Link
              href="/whatsapp"
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                pathname === '/whatsapp'
                  ? 'bg-white/20 backdrop-blur-sm shadow-md'
                  : 'hover:bg-white/10'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">WhatsApp</span>
            </Link>
            <Link
              href="/sms"
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                pathname === '/sms'
                  ? 'bg-white/20 backdrop-blur-sm shadow-md'
                  : 'hover:bg-white/10'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm font-medium">SMS</span>
            </Link>
            <button
              onClick={() => setShowClientSearch(true)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                pathname?.startsWith('/cliente')
                  ? 'bg-white/20 backdrop-blur-sm shadow-md'
                  : 'hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Cliente</span>
            </button>
            <div className="h-6 w-px bg-white/30 mx-2" />
            <button className="p-2 hover:bg-white/10 rounded-lg transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full"></span>
            </button>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-all cursor-pointer">
              <User className="w-5 h-5" />
            </div>
          </nav>
        </div>
      </div>

      {/* Modal de Búsqueda de Cliente */}
      {showClientSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Buscar Cliente</h2>
            <form onSubmit={handleClientSearch}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Teléfono
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+54 11 1234 5678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClientSearch(false)
                    setClientPhone('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
