import axios, { AxiosInstance } from 'axios'
import { getToken, clearAuth } from './auth'

const getApiUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}

let apiInstance: AxiosInstance | null = null

export function resetApiInstance() {
  apiInstance = null
}

const getApi = (): AxiosInstance => {
  if (!apiInstance) {
    apiInstance = axios.create({
      baseURL: getApiUrl(),
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    })
    apiInstance.interceptors.request.use((config) => {
      const token = getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })
    apiInstance.interceptors.response.use(
      (r) => r,
      (error) => {
        const status = error.response?.status
        const reqUrl = String(error.config?.url || '')
        if (status === 401 && !reqUrl.includes('/auth/login')) {
          clearAuth()
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login'
          }
        }
        return Promise.reject(error)
      },
    )
  }
  return apiInstance
}

export const authApi = {
  login: async (username: string, password: string) => {
    const { data } = await getApi().post('/api/auth/login', { username, password })
    return data
  },
}

export const analyticsApi = {
  dashboard: async () => (await getApi().get('/api/analytics/dashboard')).data,
  kpis: async (days = 30) => (await getApi().get('/api/analytics/kpis', { params: { days } })).data,
}

export const callsApi = {
  list: async (params?: Record<string, string>) =>
    (await getApi().get('/api/interactions', { params })).data,
  get: async (id: string) => (await getApi().get(`/api/interactions/${id}`)).data,
}

export const specialtiesApi = {
  list: async () => (await getApi().get('/api/specialties')).data,
  create: async (body: any) => (await getApi().post('/api/specialties', body)).data,
  update: async (id: string, body: any) => (await getApi().patch(`/api/specialties/${id}`, body)).data,
}

export const doctorsApi = {
  list: async (specialtyId?: string) =>
    (await getApi().get('/api/doctors', { params: { specialtyId } })).data,
  get: async (id: string) => (await getApi().get(`/api/doctors/${id}`)).data,
  create: async (body: any) => (await getApi().post('/api/doctors', body)).data,
  update: async (id: string, body: any) => (await getApi().patch(`/api/doctors/${id}`, body)).data,
  agenda: async (id: string, from: string, to: string) =>
    (await getApi().get(`/api/doctors/${id}/agenda`, { params: { from, to } })).data,
  setSchedules: async (id: string, schedules: any[]) =>
    (await getApi().post(`/api/doctors/${id}/schedules`, { schedules })).data,
  generateSlots: async (id: string, weeks = 4) =>
    (await getApi().post(`/api/doctors/${id}/generate-slots`, { weeks })).data,
}

export const patientsApi = {
  list: async (q?: string) => (await getApi().get('/api/patients', { params: { q } })).data,
  get: async (id: string) => (await getApi().get(`/api/patients/${id}`)).data,
  create: async (body: any) => (await getApi().post('/api/patients', body)).data,
  update: async (id: string, body: any) => (await getApi().patch(`/api/patients/${id}`, body)).data,
}

export const appointmentsApi = {
  list: async (params?: Record<string, any>) =>
    (await getApi().get('/api/appointments', { params })).data,
  get: async (id: string) => (await getApi().get(`/api/appointments/${id}`)).data,
  create: async (body: any) => (await getApi().post('/api/appointments', body)).data,
  reschedule: async (id: string, body: any) =>
    (await getApi().post(`/api/appointments/${id}/reschedule`, body)).data,
  cancel: async (id: string, body: any) =>
    (await getApi().post(`/api/appointments/${id}/cancel`, body)).data,
  blockDoctor: async (doctorId: string, body: any) =>
    (await getApi().post(`/api/appointments/doctor/${doctorId}/block`, body)).data,
  availability: async (params: Record<string, string>) =>
    (await getApi().get('/api/appointments/availability/search', { params })).data,
}

export const campaignsApi = {
  list: async () => (await getApi().get('/api/campaigns')).data,
  get: async (id: string) => (await getApi().get(`/api/campaigns/${id}`)).data,
  createReminders: async (hoursAhead = 24) =>
    (await getApi().post('/api/campaigns/reminders', { hoursAhead })).data,
  start: async (id: string) => (await getApi().post(`/api/campaigns/${id}/start`)).data,
  updateJob: async (jobId: string, body: any) =>
    (await getApi().patch(`/api/campaigns/jobs/${jobId}`, body)).data,
}

export const agentConfigApi = {
  get: async () => (await getApi().get('/api/agent-config')).data,
  update: async (body: any) => (await getApi().patch('/api/agent-config', body)).data,
}

export const whatsappApi = {
  getConfig: async () => (await getApi().get('/api/whatsapp/config')).data,
  updateConfig: async (body: any) =>
    (await getApi().patch('/api/whatsapp/config', body)).data,
  metrics: async () => (await getApi().get('/api/whatsapp/metrics')).data,
  list: async (status?: string) =>
    (await getApi().get('/api/whatsapp/conversations', { params: status ? { status } : {} })).data,
  get: async (id: string) =>
    (await getApi().get(`/api/whatsapp/conversations/${id}`)).data,
  options: async (id: string) =>
    (await getApi().get(`/api/whatsapp/conversations/${id}/options`)).data,
  simulateReply: async (
    id: string,
    body: { action: 'confirm' | 'cancel' | 'reschedule'; newSlotId?: string },
  ) =>
    (await getApi().post(`/api/whatsapp/conversations/${id}/simulate-reply`, body)).data,
  runNow: async () => (await getApi().post('/api/whatsapp/run-now')).data,
  seedDemo: async () => (await getApi().post('/api/whatsapp/seed-demo')).data,
  doctorCancel: async (body: { appointmentId: string; reason: string }) =>
    (await getApi().post('/api/whatsapp/doctor/cancel', body)).data,
  doctorReschedule: async (body: { appointmentId: string; reason: string }) =>
    (await getApi().post('/api/whatsapp/doctor/reschedule', body)).data,
}

export const CHANGE_ORIGIN_LABEL: Record<string, string> = {
  PATIENT: 'Paciente',
  DOCTOR: 'Doctor',
  VOICE_AGENT: 'Agente de voz',
  OPERATOR: 'Operador',
  SYSTEM: 'Sistema',
}

export const WA_CHAT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Sin respuesta',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reprogramada',
}

export const voiceApi = {
  signedUrl: async () => (await getApi().get('/api/voice/signed-url')).data,
}

export const usersApi = {
  list: async () => (await getApi().get('/api/users')).data,
  create: async (body: any) => (await getApi().post('/api/users', body)).data,
  profiles: async () => (await getApi().get('/api/profiles')).data,
}

export function formatArgentina(iso: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    ...opts,
  })
}

export const APPT_STATUS_LABEL: Record<string, string> = {
  RESERVED: 'Reservada',
  CONFIRMED: 'Confirmada',
  RESCHEDULED: 'Reprogramada',
  CANCELLED_BY_PATIENT: 'Cancelada (paciente)',
  CANCELLED_BY_DOCTOR: 'Cancelada (doctor)',
  COMPLETED: 'Atendida',
  NO_SHOW: 'No asistió',
  NEEDS_RESCHEDULE: 'Requiere reprogramar',
}
