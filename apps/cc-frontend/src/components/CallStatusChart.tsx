'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Interaction } from '@/lib/api'

interface CallStatusChartProps {
  interactions: Interaction[]
}

export default function CallStatusChart({ interactions }: CallStatusChartProps) {
  const calls = interactions.filter((i) => i.channel === 'CALL')
  
  const statusCounts: Record<string, number> = {
    'Atendidas': calls.filter((c) => c.status === 'COMPLETED').length,
    'Abandonadas': calls.filter((c) => c.status === 'ABANDONED').length,
    'Escaladas': calls.filter((c) => c.outcome === 'ESCALATED').length,
    'En Progreso': calls.filter((c) => c.status === 'IN_PROGRESS').length,
    'Nuevas': calls.filter((c) => c.status === 'NEW').length,
  }

  const chartData = Object.entries(statusCounts)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))

  const colors = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#06b6d4']

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Estado de las Llamadas</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
