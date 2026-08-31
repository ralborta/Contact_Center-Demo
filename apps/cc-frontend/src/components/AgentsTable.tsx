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
    <div className="surface-card p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-primary-fixed rounded-lg">
          <Users className="w-5 h-5 text-primary-container" />
        </div>
        <h3 className="text-xl font-semibold text-on-surface">Agentes Conectados</h3>
      </div>
      <div className="overflow-x-auto">
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-outline" />
            </div>
            <p className="text-on-surface-variant font-medium">No hay agentes conectados</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-left py-3 px-4 label-caps">Agente</th>
                <th className="text-left py-3 px-4 label-caps">Estado</th>
                <th className="text-left py-3 px-4 label-caps">Llamadas</th>
                <th className="text-left py-3 px-4 label-caps">WhatsApps</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr 
                  key={agent.name} 
                  className="border-b border-[#E5E7EB] hover:bg-surface-container-low transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center text-on-primary font-semibold text-sm">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-on-surface">{agent.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center space-x-2">
                      <Circle className="w-3 h-3 text-status-success fill-current" />
                      <span className="text-sm text-on-surface-variant">{agent.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-primary-container" />
                      <span className="font-medium tabular-nums text-on-surface">{agent.calls}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-status-success" />
                      <span className="font-medium tabular-nums text-on-surface">{agent.whatsapp}</span>
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
