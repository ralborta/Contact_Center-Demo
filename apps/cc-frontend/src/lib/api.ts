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
      
      // Debug: Log mensajes para verificar qué viene del backend
      if (data && data.messages) {
        const inboundCount = data.messages.filter((m: any) => m.direction === 'INBOUND').length;
        const outboundCount = data.messages.filter((m: any) => m.direction === 'OUTBOUND').length;
        console.log(`[API] getById: Interaction ${id} - Total messages: ${data.messages.length}, INBOUND: ${inboundCount}, OUTBOUND: ${outboundCount}`, data.messages);
      }
      
      return data
    } catch (error) {
      console.error('Error fetching interaction:', error)
      return null // Return null on error
    }
  },

  getByPhone: async (phone: string): Promise<Interaction[]> => {
    // Only execute on client side
    if (typeof window === 'undefined') {
      return []
    }
    try {
      const api = getApi()
      const { data } = await api.get('/api/interactions', { 
        params: { from: phone } 
      })
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('Error fetching interactions by phone:', error)
      return [] // Return empty array on error
    }
  },
}

export const smsApi = {
  send: async (to: string, message: string, customerRef?: string): Promise<{ success: boolean; messageId?: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('SMS API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post('/api/sms/send', { to, message, customerRef })
      return data
    } catch (error) {
      console.error('Error sending SMS:', error)
      throw error
    }
  },

  sendOtp: async (phone: string, purpose?: string, customerRef?: string): Promise<{ success: boolean; correlationId?: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('SMS API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post('/api/sms/otp', { phone, purpose, customerRef })
      return data
    } catch (error) {
      console.error('Error sending OTP:', error)
      throw error
    }
  },

  sendVerificationLink: async (to: string, customerRef?: string): Promise<{ success: boolean; messageId?: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('SMS API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post('/api/sms/verification-link', { to, customerRef })
      return data
    } catch (error) {
      console.error('Error sending verification link:', error)
      throw error
    }
  },

  sendOnboarding: async (to: string, customerRef?: string): Promise<{ success: boolean; messageId?: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('SMS API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post('/api/sms/onboarding', { to, customerRef })
      return data
    } catch (error) {
      console.error('Error sending onboarding link:', error)
      throw error
    }
  },

  sendActivateCard: async (to: string, customerRef?: string): Promise<{ success: boolean; messageId?: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('SMS API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post('/api/sms/activate-card', { to, customerRef })
      return data
    } catch (error) {
      console.error('Error sending activate card SMS:', error)
      throw error
    }
  },
}

export default getApi
