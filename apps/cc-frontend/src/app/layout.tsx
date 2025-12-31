import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Contact Center - Dashboard',
  description: 'Centro de Gestión del Contact Center',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
