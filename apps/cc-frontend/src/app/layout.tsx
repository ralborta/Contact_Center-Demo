'use client'

import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <title>Contact Center - Dashboard</title>
        <meta name="description" content="Centro de Gestión del Contact Center" />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
