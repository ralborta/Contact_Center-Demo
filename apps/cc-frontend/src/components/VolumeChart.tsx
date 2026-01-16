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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
          <XAxis dataKey="hora" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }} 
          />
          <Legend />
          <Bar dataKey="Llamadas" fill="url(#colorLlamadas)" radius={[8, 8, 0, 0]} />
          <Bar dataKey="WhatsApp" fill="url(#colorWhatsApp)" radius={[8, 8, 0, 0]} />
          <Bar dataKey="SMS" fill="url(#colorSMS)" radius={[8, 8, 0, 0]} />
          <defs>
            <linearGradient id="colorLlamadas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="colorWhatsApp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
              <stop offset="100%" stopColor="#059669" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="colorSMS" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
              <stop offset="100%" stopColor="#ea580c" stopOpacity={1} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
