'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Phone,
  CalendarDays,
  Stethoscope,
  Users,
  ClipboardList,
  Megaphone,
  BarChart3,
  Settings2,
  UserCog,
  LogOut,
  HeartPulse,
  MessageCircle,
} from 'lucide-react'
import { getUser, clearAuth, isAdmin } from '@/lib/auth'
import { resetApiInstance } from '@/lib/api'
import { Avatar } from '@/components/ui'

// Panel LIVE: sin Simulador ni ruta /telefono (webapp separada).
const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { href: '/llamadas', label: 'Llamadas', icon: Phone, match: (p: string) => p.startsWith('/llamadas') },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays, match: (p: string) => p.startsWith('/agenda') },
  { href: '/citas', label: 'Citas', icon: ClipboardList, match: (p: string) => p.startsWith('/citas') },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, match: (p: string) => p.startsWith('/whatsapp') },
  { href: '/doctores', label: 'Doctores', icon: Stethoscope, match: (p: string) => p.startsWith('/doctores') || p.startsWith('/especialidades') },
  { href: '/pacientes', label: 'Pacientes', icon: Users, match: (p: string) => p.startsWith('/pacientes') },
  { href: '/campanas', label: 'Campañas', icon: Megaphone, match: (p: string) => p.startsWith('/campanas') },
  { href: '/analitica', label: 'Analítica', icon: BarChart3, match: (p: string) => p.startsWith('/analitica') },
  { href: '/configuracion', label: 'Agente', icon: Settings2, match: (p: string) => p.startsWith('/configuracion') },
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
    <nav className="bg-primary w-full z-50 shadow-elevate">
      <div className="flex justify-between items-center w-full px-4 md:px-8 py-3 max-w-container-max mx-auto gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <div className="bg-white p-2 rounded-xl text-primary shadow-sm group-hover:scale-105 transition-transform">
            <HeartPulse className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="text-lg font-display font-semibold text-on-primary leading-tight">
              Hospital Santa María
            </h1>
            <p className="text-[10px] text-on-primary/75 uppercase tracking-wider font-semibold">
              Centro de Citas
            </p>
          </div>
        </Link>

        <div className="hidden xl:flex items-center gap-0.5 flex-1 justify-center flex-wrap">
          {NAV.map((item) => {
            const active = item.match(pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all ${
                  active
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-primary/85 hover:text-on-primary hover:bg-white/12'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          {admin && (
            <Link
              href="/usuarios"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold ${
                pathname === '/usuarios'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-on-primary/85 hover:bg-white/12'
              }`}
            >
              <UserCog className="w-3.5 h-3.5" />
              Usuarios
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 text-on-primary">
            <span className="text-xs font-semibold hidden md:block">
              {user?.username}
            </span>
            <Avatar label={(user?.username || 'A').charAt(0).toUpperCase()} size="sm" />
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/12 rounded-lg"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 pb-3">
        {NAV.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
                active ? 'bg-white text-primary' : 'text-on-primary/85'
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
