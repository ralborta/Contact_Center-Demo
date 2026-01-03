import axios, { AxiosInstance } from 'axios'

// Get API URL - only available on client side
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000' // Fallback for SSR (shouldn't happen)
  }
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  // Ensure URL has protocol
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}

// Create axios instance lazily to avoid SSR issues
let apiInstance: AxiosInstance | null = null

const getApi = (): AxiosInstance => {
  if (!apiInstance) {
    apiInstance = axios.create({
      baseURL: getApiUrl(),
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds timeout
    })

    // Add response interceptor for error handling
    apiInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.message)
        return Promise.reject(error)
      }
    )
  }
  return apiInstance
}

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
  providerConversationId?: string | null
  createdAt: string
  customerRef?: string | null
  queue?: string | null
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
  elevenCallId: string | null
  recordingUrl: string | null
  transcriptText: string | null
  summary: string | null
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
    // Only execute on client side
    if (typeof window === 'undefined') {
      return []
    }
    try {
      const api = getApi()
      const { data } = await api.get('/api/interactions', { params: filters })
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('Error fetching interactions:', error)
      return [] // Return empty array on error
    }
  },

  getById: async (id: string): Promise<Interaction | null> => {
    // Only execute on client side
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const api = getApi()
      const { data } = await api.get(`/api/interactions/${id}`)
      return data
    } catch (error) {
      console.error('Error fetching interaction:', error)
      return null // Return null on error
    }
  },
}

export default getApi
