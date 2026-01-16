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

  const colors = ['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#06b6d4']

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }} 
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
