'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  CheckCircle2,
  Megaphone,
  PhoneMissed,
  Play,
  Plus,
  Voicemail,
  XCircle,
} from 'lucide-react'
import PageShell from '@/components/PageShell'
import { Avatar, IconAction, KpiCard, StatusBadge } from '@/components/ui'
import { campaignsApi, formatArgentina } from '@/lib/api'

const TYPE_LABEL: Record<string, string> = {
  REMINDER: 'Recordatorio',
  CONFIRMATION: 'Confirmación',
  DOCTOR_CANCEL_NOTICE: 'Aviso de cancelación',
  RESCHEDULE_NOTICE: 'Aviso de reprogramación',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  QUEUED: 'En cola',
  RUNNING: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  PENDING: 'Pendiente',
  CALLING: 'Llamando',
  CONFIRMED: 'Confirmada',
  RESCHEDULED: 'Reprogramada',
  NO_ANSWER: 'Sin respuesta',
  VOICEMAIL: 'Buzón',
  FAILED: 'Fallida',
}

const JOB_ACTIONS: Array<{ status: string; label: string; tone: 'primary' | 'amber' | 'danger' | 'muted' }> = [
  { status: 'CONFIRMED', label: 'Confirmó', tone: 'primary' },
  { status: 'NO_ANSWER', label: 'Sin resp.', tone: 'amber' },
  { status: 'VOICEMAIL', label: 'Buzón', tone: 'muted' },
  { status: 'FAILED', label: 'Falló', tone: 'danger' },
]

export default function CampanasPage() {
  const [items, setItems] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  async function load() {
    setItems(await campaignsApi.list())
  }
  useEffect(() => {
    load().catch(console.error)
  }, [])

  async function createReminder() {
    await campaignsApi.createReminders(24)
    load()
  }

  async function open(id: string) {
    setSelected(await campaignsApi.get(id))
  }

  const totals = useMemo(() => {
    let jobs = 0
    let running = 0
    let done = 0
    let failed = 0
    for (const c of items) {
      const list = c.jobs || []
      jobs += c._count?.jobs ?? list.length
      if (c.status === 'RUNNING') running += 1
      if (c.status === 'COMPLETED') done += 1
      for (const j of list) {
        if (j.status === 'FAILED' || j.status === 'NO_ANSWER') failed += 1
      }
    }
    return { campaigns: items.length, jobs, running, done, failed }
  }, [items])

  return (
    <PageShell
      icon={Megaphone}
      title="Campañas salientes"
      subtitle="Recordatorios, confirmaciones y avisos de cancelación"
      actions={
        <button className="btn-primary" onClick={createReminder}>
          <Plus className="w-3.5 h-3.5" />
          Crear recordatorio 24h
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Campañas" value={totals.campaigns} icon={Megaphone} tone="teal" />
        <KpiCard label="Llamadas en cola" value={totals.jobs} icon={BellRing} tone="blue" />
        <KpiCard label="En curso" value={totals.running} icon={Play} tone="violet" live={totals.running > 0} />
        <KpiCard label="Sin contacto" value={totals.failed} icon={PhoneMissed} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          {items.length === 0 && (
            <div className="surface-card p-6 text-sm text-outline shadow-soft">
              Todavía no hay campañas. Creá un recordatorio de 24h para empezar.
            </div>
          )}
          {items.map((c) => {
            const counts = (c.jobs || []).reduce((acc: any, j: any) => {
              acc[j.status] = (acc[j.status] || 0) + 1
              return acc
            }, {})
            const active = selected?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => open(c.id)}
                className={`surface-card p-4 w-full text-left transition-colors shadow-soft ${
                  active ? 'ring-2 ring-primary/25 border-primary/40' : 'hover:border-primary/40'
                }`}
              >
                <div className="flex justify-between gap-2 items-start">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-full bg-primary-100 text-primary shrink-0">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {TYPE_LABEL[c.type] || c.type} · {c._count?.jobs ?? c.jobs?.length ?? 0}{' '}
                        llamadas
                        {c.scheduledAt
                          ? ` · ${formatArgentina(c.scheduledAt, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={c.status}
                    label={STATUS_LABEL[c.status] || c.status}
                  />
                </div>
                {Object.keys(counts).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(counts).map(([k, v]) => (
                      <StatusBadge
                        key={k}
                        status={k}
                        label={`${STATUS_LABEL[k] || k}: ${v}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="surface-card p-5 shadow-soft">
          {!selected ? (
            <p className="text-sm text-outline">Seleccioná una campaña</p>
          ) : (
            <>
              <div className="flex justify-between items-start mb-4 gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">{selected.name}</h3>
                  <p className="text-sm text-on-surface-variant">
                    {TYPE_LABEL[selected.type] || selected.type}
                  </p>
                  <div className="mt-2">
                    <StatusBadge
                      status={selected.status}
                      label={STATUS_LABEL[selected.status] || selected.status}
                    />
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    campaignsApi.start(selected.id).then(() => open(selected.id))
                  }
                >
                  <Play className="w-3.5 h-3.5" />
                  Iniciar
                </button>
              </div>
              <div className="space-y-2 max-h-[520px] overflow-auto">
                {(selected.jobs || []).map((j: any) => (
                  <div
                    key={j.id}
                    className="border border-outline-variant/50 rounded-xl px-3 py-2.5 text-sm flex justify-between gap-2 hover:bg-primary-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        firstName={j.patient?.firstName}
                        lastName={j.patient?.lastName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {j.patient?.firstName} {j.patient?.lastName}
                        </p>
                        <p className="text-xs text-on-surface-variant tabular-nums">
                          {j.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge
                        status={j.status}
                        label={STATUS_LABEL[j.status] || j.status}
                      />
                      <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                        {JOB_ACTIONS.map((a) => (
                          <IconAction
                            key={a.status}
                            icon={
                              a.status === 'CONFIRMED'
                                ? CheckCircle2
                                : a.status === 'FAILED'
                                  ? XCircle
                                  : a.status === 'VOICEMAIL'
                                    ? Voicemail
                                    : PhoneMissed
                            }
                            label={a.label}
                            tone={a.tone}
                            onClick={() =>
                              campaignsApi
                                .updateJob(j.id, { status: a.status })
                                .then(() => open(selected.id))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}
