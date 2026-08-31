import './globals.css'
import { Inter } from 'next/font/google'
import AuthGuard from '@/components/AuthGuard'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'Centro de Gestión — Contact Center Bancario',
  description: 'Centro de Gestión del Contact Center',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className={`${inter.className} bg-surface-base text-on-surface antialiased`}>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
