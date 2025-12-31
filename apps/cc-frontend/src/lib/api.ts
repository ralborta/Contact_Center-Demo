import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface Interaction {
  id: string
  channel: 'CALL' | 'WHATSAPP' | 'SMS'
  direction: 'INBOUND' | 'OUTBOUND'
  status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'FAILED'
  startedAt: string | null
  endedAt: string | null
  from: string
  to: string
  assignedAgent: string | null
  outcome: 'RESOLVED' | 'ESCALATED' | 'TICKETED' | 'TRANSFERRED' | 'UNKNOWN' | null
  intent: string | null
  provider: string
  createdAt: string
  events?: InteractionEvent[]
  messages?: Message[]
  callDetail?: CallDetail
}

export interface InteractionEvent {
  id: string
  type: string
  ts: string
  payload: any
}

export interface Message {
  id: string
  text: string | null
  direction: 'INBOUND' | 'OUTBOUND'
  sentAt: string | null
}

export interface CallDetail {
  id: string
  recordingUrl: string | null
  transcriptText: string | null
  durationSec: number | null
}

export const interactionsApi = {
  getAll: async (filters?: {
    channel?: string
    direction?: string
    status?: string
    dateFrom?: string
    dateTo?: string
  }): Promise<Interaction[]> => {
    const { data } = await api.get('/api/interactions', { params: filters })
    return data
  },

  getById: async (id: string): Promise<Interaction> => {
    const { data } = await api.get(`/api/interactions/${id}`)
    return data
  },
}

export default api
