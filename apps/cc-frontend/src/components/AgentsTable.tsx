'use client'

import { Interaction } from '@/lib/api'

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
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Agentes Conectados</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4">Agente</th>
              <th className="text-left py-2 px-4">Estado</th>
              <th className="text-left py-2 px-4">Llamadas</th>
              <th className="text-left py-2 px-4">WhatsApps</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">
                  No hay agentes conectados
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent.name} className="border-b">
                  <td className="py-2 px-4 font-medium">{agent.name}</td>
                  <td className="py-2 px-4">
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                      {agent.status}
                    </span>
                  </td>
                  <td className="py-2 px-4">{agent.calls}</td>
                  <td className="py-2 px-4">{agent.whatsapp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
