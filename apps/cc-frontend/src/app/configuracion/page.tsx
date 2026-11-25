'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  Clock3,
  MessageSquareText,
  Save,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import PageShell from '@/components/PageShell'
import { KpiCard, StatusBadge } from '@/components/ui'
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
    return (
      <PageShell icon={Settings2} title="Agente">
        <p className="text-sm text-outline">Cargando…</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      icon={Settings2}
      title="Agente"
      subtitle="Horario, mensajes y derivación del asistente de voz"
      actions={
        <button className="btn-primary" onClick={save}>
          <Save className="w-3.5 h-3.5" />
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Estado"
          value={form.transferEnabled ? 'Activo' : 'Pausado'}
          icon={Bot}
          tone={form.transferEnabled ? 'violet' : 'slate'}
        />
        <KpiCard
          label="Inicio"
          value={form.businessHoursStart || '—'}
          icon={Clock3}
          tone="teal"
        />
        <KpiCard
          label="Cierre"
          value={form.businessHoursEnd || '—'}
          icon={Clock3}
          tone="blue"
        />
        <KpiCard
          label="Derivación"
          value={form.transferEnabled ? 'Sí' : 'No'}
          icon={ShieldCheck}
          tone={form.transferEnabled ? 'green' : 'amber'}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="surface-card p-6 space-y-4 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-full bg-violet-100 text-violet-700">
              <MessageSquareText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">Mensajes del agente</p>
              <p className="text-sm text-on-surface-variant">Textos que escucha el paciente</p>
            </div>
          </div>

          <div>
            <label className="label-caps">Nombre del hospital</label>
            <input
              className="field-input mt-1"
              value={form.hospitalName || ''}
              onChange={(e) => setForm({ ...form, hospitalName: e.target.value })}
            />
          </div>
          <div>
            <label className="label-caps">Saludo</label>
            <textarea
              className="field-input mt-1 min-h-[80px]"
              value={form.greeting || ''}
              onChange={(e) => setForm({ ...form, greeting: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps">Inicio atención</label>
              <input
                className="field-input mt-1"
                value={form.businessHoursStart || ''}
                onChange={(e) =>
                  setForm({ ...form, businessHoursStart: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label-caps">Fin atención</label>
              <input
                className="field-input mt-1"
                value={form.businessHoursEnd || ''}
                onChange={(e) =>
                  setForm({ ...form, businessHoursEnd: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label-caps">Mensaje de derivación</label>
            <textarea
              className="field-input mt-1"
              value={form.transferMessage || ''}
              onChange={(e) => setForm({ ...form, transferMessage: e.target.value })}
            />
          </div>
          <div>
            <label className="label-caps">Mensaje fuera de horario</label>
            <textarea
              className="field-input mt-1"
              value={form.closedMessage || ''}
              onChange={(e) => setForm({ ...form, closedMessage: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary"
              checked={!!form.transferEnabled}
              onChange={(e) =>
                setForm({ ...form, transferEnabled: e.target.checked })
              }
            />
            Permitir derivación a humano
          </label>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-4 shadow-soft">
            <p className="label-caps mb-2">Resumen</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant">Derivación</span>
                <StatusBadge
                  status={form.transferEnabled ? 'ACTIVE' : 'INACTIVE'}
                  label={form.transferEnabled ? 'Habilitada' : 'Deshabilitada'}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant">Zona</span>
                <span className="font-semibold">Argentina</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant">Moneda</span>
                <span className="font-semibold">{form.currency || 'ARS'}</span>
              </div>
            </div>
          </div>
          <div className="surface-card p-4 shadow-soft border-l-[3px] border-l-violet-500">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-violet-700" />
              <p className="font-semibold text-sm">Asistente de voz</p>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Los cambios de horario y mensajes se aplican a las próximas llamadas.
              No se muestran claves ni identificadores técnicos en esta pantalla.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  )
}
