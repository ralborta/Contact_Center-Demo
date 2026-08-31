'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Phone, MessageSquare, Mail, Bell, Users, UserCog, LogOut } from 'lucide-react'
import { getUser, clearAuth, isAdmin } from '@/lib/auth'
import { resetApiInstance } from '@/lib/api'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { href: '/calls', label: 'Llamadas', icon: Phone, match: (p: string) => p === '/calls' },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, match: (p: string) => p === '/whatsapp' },
  { href: '/sms', label: 'SMS', icon: Mail, match: (p: string) => p === '/sms' },
  { href: '/cliente', label: 'Cliente', icon: Users, match: (p: string) => p.startsWith('/cliente') },
]

export default function Header() {
  const pathname = usePathname() || '/'
  const user = typeof window !== 'undefined' ? getUser() : null
  const admin = typeof window !== 'undefined' && isAdmin()

  function handleLogout() {
    clearAuth()
    resetApiInstance()
    window.location.href = '/login'
  }

  return (
    <nav className="bg-primary w-full z-50 shadow-md">
      <div className="flex justify-between items-center w-full px-4 md:px-10 py-3 max-w-container-max mx-auto gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <div className="bg-white p-2 rounded-lg text-primary group-hover:scale-105 transition-transform">
            <Phone className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-primary leading-tight">Centro de Gestión</h1>
            <p className="text-[10px] text-on-primary/80 uppercase tracking-wider">Contact Center Bancario</p>
          </div>
        </Link>

        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {NAV.map((item) => {
            const active = item.match(pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  active
                    ? 'bg-white/20 text-on-primary'
                    : 'text-on-primary/80 hover:text-on-primary hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
          {admin && (
            <Link
              href="/usuarios"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                pathname === '/usuarios'
                  ? 'bg-white/20 text-on-primary'
                  : 'text-on-primary/80 hover:text-on-primary hover:bg-white/10'
              }`}
            >
              <UserCog className="w-4 h-4" />
              <span>Usuarios</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button className="text-on-primary/80 hover:text-on-primary hover:bg-white/10 p-2 rounded-full transition-all relative" aria-label="Notificaciones">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-error rounded-full" />
          </button>
          <div className="flex items-center gap-2 text-on-primary">
            <span className="text-xs font-semibold hidden md:block">
              {user?.username} ({user?.profileName ?? user?.profile})
            </span>
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-primary text-xs font-bold border border-white/20">
              {(user?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 pb-3">
        {NAV.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                active ? 'bg-white/20 text-on-primary' : 'text-on-primary/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
