'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()

  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xl">C</span>
              </div>
              <h1 className="text-xl font-semibold">
                Centro de Gestión - Contact Center Bancario
              </h1>
            </Link>
          </div>
          <nav className="flex items-center space-x-4">
            <Link
              href="/"
              className={`px-3 py-2 rounded ${
                pathname === '/' ? 'bg-blue-700' : 'hover:bg-blue-700'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/calls"
              className={`px-3 py-2 rounded ${
                pathname === '/calls' ? 'bg-blue-700' : 'hover:bg-blue-700'
              }`}
            >
              📞 Llamadas
            </Link>
            <Link
              href="/whatsapp"
              className={`px-3 py-2 rounded ${
                pathname === '/whatsapp' ? 'bg-blue-700' : 'hover:bg-blue-700'
              }`}
            >
              💬 WhatsApp
            </Link>
            <Link
              href="/sms"
              className={`px-3 py-2 rounded ${
                pathname === '/sms' ? 'bg-blue-700' : 'hover:bg-blue-700'
              }`}
            >
              💌 SMS
            </Link>
            <button className="p-2 hover:bg-blue-700 rounded-full">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold">U</span>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
