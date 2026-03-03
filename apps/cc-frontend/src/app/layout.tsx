import './globals.css'
import AuthGuard from '@/components/AuthGuard'

export const metadata = {
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
      <body className="bg-gray-50">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
