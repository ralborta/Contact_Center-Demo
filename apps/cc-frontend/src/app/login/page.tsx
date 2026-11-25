'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, HeartPulse } from 'lucide-react'
import { authApi } from '@/lib/api'
import { setAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login(username.trim(), password)
      setAuth(data.accessToken, {
        id: data.user.id,
        username: data.user.username,
        profile: data.user.profile,
        profileName: data.user.profileName,
      })
      router.push('/')
      router.refresh()
    } catch (err: any) {
      if (!err.response) {
        setError('No se pudo conectar con el servidor. Revisá la URL de la API.')
      } else {
        setError(err.response?.data?.message || 'Usuario o contraseña incorrectos')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hero-mesh flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-8%] w-[520px] h-[520px] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[420px] h-[420px] bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[420px] surface-card p-8 relative z-10 flex flex-col gap-7 border-t-4 border-primary">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white mb-3">
            <HeartPulse className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-on-surface">
            Hospital Santa María
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Centro de Turnos</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="label-caps" htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="field-input"
              required
              autoComplete="username"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label-caps" htmlFor="password">Contraseña</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input pr-10"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-error bg-error-container py-2 px-3 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-1">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
