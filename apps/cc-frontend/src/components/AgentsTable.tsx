'use client'

import { Interaction } from '@/lib/api'
import { Users, Phone, MessageSquare, Circle } from 'lucide-react'

interface AgentsTableProps {
  interactions: Interaction[]
}

export default function AgentsTable({ interactions }: AgentsTableProps) {
  const agentStats: Record<
    string,
    { calls: number; whatsapp: number; status: 'Activo' | 'Inactivo' }
  > = {}

  interactions.forEach((interaction) => {
    if (!interaction.assignedAgent) return
    const agent = interaction.assignedAgent
    if (!agentStats[agent]) {
      agentStats[agent] = { calls: 0, whatsapp: 0, status: 'Activo' }
    }
    if (interaction.channel === 'CALL') agentStats[agent].calls++
    if (interaction.channel === 'WHATSAPP') agentStats[agent].whatsapp++
  })

  const agents = Object.entries(agentStats).map(([name, stats]) => ({
    name,
    ...stats,
  }))

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl">
          <Users className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Agentes Conectados</h3>
      </div>
      <div className="overflow-x-auto">
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay agentes conectados</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Agente</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Llamadas</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">WhatsApps</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, index) => (
                <tr 
                  key={agent.name} 
                  className="border-b border-gray-100 hover:bg-indigo-50/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{agent.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center space-x-2">
                      <Circle className="w-3 h-3 text-green-500 fill-current" />
                      <span className="text-sm text-gray-700">{agent.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-900">{agent.calls}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-gray-900">{agent.whatsapp}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
