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
  updatedAt?: string | null
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

  getClientAISummary: async (phone: string): Promise<{
    summary: string
    keyPoints: string[]
    suggestedActions: string[]
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
    generatedAt: string
  }> => {
    if (typeof window === 'undefined') {
      return {
        summary: '',
        keyPoints: [],
        suggestedActions: [],
        sentiment: 'NEUTRAL',
        generatedAt: new Date().toISOString(),
      }
    }
    try {
      const api = getApi()
      const decodedPhone = decodeURIComponent(phone)
      const { data } = await api.get(`/api/interactions/client/${encodeURIComponent(decodedPhone)}/ai-summary`)
      return data
    } catch (error) {
      console.error('Error fetching AI summary:', error)
      throw error
    }
  },

  getClientProfile: async (phone: string): Promise<{
    phone: string
    normalizedPhone: string
    interactions: Interaction[]
    stats: {
      totalInteractions: number
      inboundCalls: number
      whatsappInteractions: number
      whatsappMessages: { inbound: number; outbound: number; total: number }
      smsOtpConfirmed: number
      resolvedInteractions: number
      resolvedPercentage: number
    }
    lastInteraction: { id: string; channel: string; startedAt: string | null; createdAt: string } | null
    customerRef: string | null
  }> => {
    // Only execute on client side
    if (typeof window === 'undefined') {
      return {
        phone,
        normalizedPhone: phone,
        interactions: [],
        stats: {
          totalInteractions: 0,
          inboundCalls: 0,
          whatsappInteractions: 0,
          whatsappMessages: { inbound: 0, outbound: 0, total: 0 },
          smsOtpConfirmed: 0,
          resolvedInteractions: 0,
          resolvedPercentage: 0,
        },
        lastInteraction: null,
        customerRef: null,
      }
    }
    try {
      const api = getApi()
      // Decodificar el número si está URL-encoded
      const decodedPhone = decodeURIComponent(phone)
      const { data } = await api.get(`/api/interactions/client/${encodeURIComponent(decodedPhone)}`)
      return data
    } catch (error) {
      console.error('Error fetching client profile:', error)
      return {
        phone,
        normalizedPhone: phone,
        interactions: [],
        stats: {
          totalInteractions: 0,
          inboundCalls: 0,
          whatsappInteractions: 0,
          whatsappMessages: { inbound: 0, outbound: 0, total: 0 },
          smsOtpConfirmed: 0,
          resolvedInteractions: 0,
          resolvedPercentage: 0,
        },
        lastInteraction: null,
        customerRef: null,
      }
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

export const whatsappApi = {
  send: async (
    providerConversationId: string,
    to: string,
    text: string,
    assignedAgent?: string
  ): Promise<{ success: boolean; messageId?: string; interactionId?: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('WhatsApp API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post('/api/whatsapp/send', {
        providerConversationId,
        to,
        text,
        assignedAgent,
      })
      return data
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      throw error
    }
  },
}

export const customersApi = {
  getAll: async (filters?: {
    status?: string
    segment?: string
    search?: string
    limit?: number
    skip?: number
  }) => {
    if (typeof window === 'undefined') {
      return { customers: [], total: 0, limit: 100, skip: 0 }
    }
    try {
      const api = getApi()
      const params = new URLSearchParams()
      if (filters?.status) params.append('status', filters.status)
      if (filters?.segment) params.append('segment', filters.segment)
      if (filters?.search) params.append('search', filters.search)
      if (filters?.limit) params.append('limit', filters.limit.toString())
      if (filters?.skip) params.append('skip', filters.skip.toString())
      
      const { data } = await api.get(`/api/customers?${params.toString()}`)
      return data
    } catch (error) {
      console.error('Error fetching customers:', error)
      throw error
    }
  },

  getByPhone: async (phone: string) => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const api = getApi()
      const { data } = await api.get(`/api/customers/phone/${encodeURIComponent(phone)}`)
      return data
    } catch (error) {
      console.error('Error fetching customer by phone:', error)
      return null
    }
  },

  getById: async (id: string) => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const api = getApi()
      const { data } = await api.get(`/api/customers/${id}`)
      return data
    } catch (error) {
      console.error('Error fetching customer:', error)
      throw error
    }
  },

  create: async (data: {
    phone: string
    name?: string
    email?: string
    dni?: string
    status?: string
    segment?: string
    preferredChannel?: string
  }) => {
    if (typeof window === 'undefined') {
      throw new Error('Customers API only available on client side')
    }
    try {
      const api = getApi()
      const { data: result } = await api.post('/api/customers', data)
      return result
    } catch (error) {
      console.error('Error creating customer:', error)
      throw error
    }
  },

  update: async (id: string, data: {
    name?: string
    email?: string
    dni?: string
    status?: string
    segment?: string
    preferredChannel?: string
  }) => {
    if (typeof window === 'undefined') {
      throw new Error('Customers API only available on client side')
    }
    try {
      const api = getApi()
      const { data: result } = await api.put(`/api/customers/${id}`, data)
      return result
    } catch (error) {
      console.error('Error updating customer:', error)
      throw error
    }
  },

  delete: async (id: string) => {
    if (typeof window === 'undefined') {
      throw new Error('Customers API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.delete(`/api/customers/${id}`)
      return data
    } catch (error) {
      console.error('Error deleting customer:', error)
      throw error
    }
  },

  block: async (id: string) => {
    if (typeof window === 'undefined') {
      throw new Error('Customers API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post(`/api/customers/${id}/block`, {})
      return data
    } catch (error) {
      console.error('Error blocking customer:', error)
      throw error
    }
  },

  addTag: async (id: string, tag: {
    type: string
    label: string
    description?: string
    color?: string
  }) => {
    if (typeof window === 'undefined') {
      throw new Error('Customers API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post(`/api/customers/${id}/tags`, tag)
      return data
    } catch (error) {
      console.error('Error adding tag:', error)
      throw error
    }
  },

  removeTag: async (id: string, tagId: string) => {
    if (typeof window === 'undefined') {
      throw new Error('Customers API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.delete(`/api/customers/${id}/tags/${tagId}`)
      return data
    } catch (error) {
      console.error('Error removing tag:', error)
      throw error
    }
  },

  addNote: async (id: string, note: {
    title?: string
    content: string
    isInternal?: boolean
  }) => {
    if (typeof window === 'undefined') {
      throw new Error('Customers API only available on client side')
    }
    try {
      const api = getApi()
      const { data } = await api.post(`/api/customers/${id}/notes`, note)
      return data
    } catch (error) {
      console.error('Error adding note:', error)
      throw error
    }
  },

  getStats: async (id: string) => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const api = getApi()
      const { data } = await api.get(`/api/customers/${id}/stats`)
      return data
    } catch (error) {
      console.error('Error fetching customer stats:', error)
      throw error
    }
  },
}

export default getApi
