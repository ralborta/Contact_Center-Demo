import './globals.css'
import { Manrope, Source_Serif_4 } from 'next/font/google'
import AuthGuard from '@/components/AuthGuard'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
})

export const metadata = {
  title: 'Hospital Santa María — Centro de Turnos',
  description: 'Centro de gestión de citas médicas por teléfono',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${sourceSerif.variable}`}>
      <body className={`${manrope.className} bg-surface-base text-on-surface antialiased`}>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
