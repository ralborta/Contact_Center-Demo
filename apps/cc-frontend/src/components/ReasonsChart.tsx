'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Interaction } from '@/lib/api'

interface ReasonsChartProps {
  interactions: Interaction[]
}

export default function ReasonsChart({ interactions }: ReasonsChartProps) {
  const reasons: Record<string, number> = {}
  
  interactions.forEach((interaction) => {
    const reason = interaction.intent || 'Sin motivo'
    reasons[reason] = (reasons[reason] || 0) + 1
  })

  const chartData = Object.entries(reasons)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const colors = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#06b6d4']

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Motivos Principales</h3>
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
