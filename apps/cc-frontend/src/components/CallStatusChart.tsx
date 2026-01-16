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

  const colors = ['#10b981', '#ef4444', '#f97316', '#3b82f6', '#8b5cf6']

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100">
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
