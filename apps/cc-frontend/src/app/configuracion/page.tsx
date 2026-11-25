'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/PageShell'
import { agentConfigApi } from '@/lib/api'

export default function ConfiguracionPage() {
  const [form, setForm] = useState<any>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    agentConfigApi.get().then(setForm)
  }, [])

  async function save() {
    const updated = await agentConfigApi.update({
      hospitalName: form.hospitalName,
      greeting: form.greeting,
      businessHoursStart: form.businessHoursStart,
      businessHoursEnd: form.businessHoursEnd,
      transferMessage: form.transferMessage,
      closedMessage: form.closedMessage,
      transferEnabled: form.transferEnabled,
    })
    setForm(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!form) {
    return <PageShell title="Configuración del agente"><p className="text-sm text-outline">Cargando…</p></PageShell>
  }

  return (
    <PageShell title="Configuración del agente" subtitle="Horario, mensajes y derivación (sin secretos)">
      <div className="surface-card p-6 max-w-2xl space-y-4">
        <div>
          <label className="label-caps">Nombre del hospital</label>
          <input className="field-input mt-1" value={form.hospitalName || ''} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
        </div>
        <div>
          <label className="label-caps">Saludo</label>
          <textarea className="field-input mt-1 min-h-[80px]" value={form.greeting || ''} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps">Inicio atención</label>
            <input className="field-input mt-1" value={form.businessHoursStart || ''} onChange={(e) => setForm({ ...form, businessHoursStart: e.target.value })} />
          </div>
          <div>
            <label className="label-caps">Fin atención</label>
            <input className="field-input mt-1" value={form.businessHoursEnd || ''} onChange={(e) => setForm({ ...form, businessHoursEnd: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label-caps">Mensaje de derivación</label>
          <textarea className="field-input mt-1" value={form.transferMessage || ''} onChange={(e) => setForm({ ...form, transferMessage: e.target.value })} />
        </div>
        <div>
          <label className="label-caps">Mensaje fuera de horario</label>
          <textarea className="field-input mt-1" value={form.closedMessage || ''} onChange={(e) => setForm({ ...form, closedMessage: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.transferEnabled} onChange={(e) => setForm({ ...form, transferEnabled: e.target.checked })} />
          Permitir derivación a humano
        </label>
        <p className="text-xs text-on-surface-variant">Zona horaria: {form.timezone || 'America/La_Paz'} · Moneda: {form.currency || 'Bs'}</p>
        <button className="btn-primary" onClick={save}>{saved ? 'Guardado' : 'Guardar'}</button>
      </div>
    </PageShell>
  )
}
