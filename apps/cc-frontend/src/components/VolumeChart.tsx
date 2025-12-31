'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Interaction } from '@/lib/api'

interface VolumeChartProps {
  interactions: Interaction[]
}

export default function VolumeChart({ interactions }: VolumeChartProps) {
  // Group by hour
  const hourlyData: Record<number, { llamadas: number; whatsapp: number; sms: number }> = {}
  
  interactions.forEach((interaction) => {
    if (!interaction.startedAt) return
    const hour = new Date(interaction.startedAt).getHours()
    if (!hourlyData[hour]) {
      hourlyData[hour] = { llamadas: 0, whatsapp: 0, sms: 0 }
    }
    if (interaction.channel === 'CALL') hourlyData[hour].llamadas++
    if (interaction.channel === 'WHATSAPP') hourlyData[hour].whatsapp++
    if (interaction.channel === 'SMS') hourlyData[hour].sms++
  })

  const chartData = Object.entries(hourlyData)
    .map(([hour, data]) => ({
      hora: `${hour}h`,
      Llamadas: data.llamadas,
      WhatsApp: data.whatsapp,
      SMS: data.sms,
    }))
    .sort((a, b) => parseInt(a.hora) - parseInt(b.hora))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Volumen de Contactos</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hora" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Llamadas" fill="#3b82f6" />
          <Bar dataKey="WhatsApp" fill="#10b981" />
          <Bar dataKey="SMS" fill="#f97316" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
