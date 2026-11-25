'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  Settings2,
  XCircle,
  CalendarClock,
  Clock,
  Stethoscope,
} from 'lucide-react'
import PageShell from '@/components/PageShell'
import { Avatar, KpiCard, StatusBadge, WaTicks } from '@/components/ui'
import {
  APPT_STATUS_LABEL,
  WA_CHAT_STATUS_LABEL,
  formatLaPaz,
  whatsappApi,
} from '@/lib/api'

type Tab = 'inbox' | 'config'

function humanPreview(text?: string | null) {
  const t = String(text || '').trim()
  if (!t) return '—'
  if (/^(SEED:|KIND:|OPCIONES:)/i.test(t)) return 'Conversación'
  if (/^conv_/i.test(t) || /^test[-_]/i.test(t)) return 'Conversación'
  return t
}

export default function WhatsappPage() {
  const [tab, setTab] = useState<Tab>('inbox')
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [options, setOptions] = useState<any[]>([])
  const [showReschedule, setShowReschedule] = useState(false)

  async function loadList() {
    const [rows, m] = await Promise.all([
      whatsappApi.list(filter || undefined),
      whatsappApi.metrics(),
    ])
    setConversations(rows)
    setMetrics(m)
    if (!selectedId && rows[0]) setSelectedId(rows[0].id)
  }

  async function loadDetail(id: string) {
    if (!id) {
      setDetail(null)
      return
    }
    const d = await whatsappApi.get(id)
    setDetail(d)
    setShowReschedule(false)
    setOptions([])
    if (
      d?.status === 'PENDING' &&
      (d.kind === 'DOCTOR_CANCEL' || d.kind === 'DOCTOR_RESCHEDULE')
    ) {
      try {
        const opts = await whatsappApi.options(id)
        setOptions(opts)
        if (opts.length) setShowReschedule(true)
      } catch {
        /* ignore */
      }
    }
  }

  async function loadConfig() {
    const c = await whatsappApi.getConfig()
    setConfig(c)
  }

  useEffect(() => {
    void (async () => {
      try {
        await whatsappApi.seedDemo()
      } catch {
        /* ignore */
      }
      await loadList()
      await loadConfig()
      try {
        const params = new URLSearchParams(window.location.search)
        const fromQuery = params.get('chat')
        const focus = fromQuery || sessionStorage.getItem('wa_focus')
        if (focus) {
          setSelectedId(focus)
          sessionStorage.removeItem('wa_focus')
        }
      } catch {
        /* ignore */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId])

  const visibleMessages = useMemo(() => {
    return (detail?.messages || []).filter(
      (m: any) => m.direction !== 'SYSTEM' && !String(m.body || '').startsWith('OPCIONES:'),
    )
  }, [detail])

  async function simulate(action: 'confirm' | 'cancel' | 'reschedule', newSlotId?: string) {
    if (!selectedId) return
    setBusy(true)
    setMessage('')
    try {
      if (action === 'reschedule' && !newSlotId) {
        await whatsappApi.simulateReply(selectedId, { action: 'reschedule' })
        const opts = await whatsappApi.options(selectedId)
        setOptions(opts)
        setShowReschedule(true)
        await loadDetail(selectedId)
        await loadList()
        setMessage('Se pidieron opciones de horario al paciente')
        return
      }
      await whatsappApi.simulateReply(selectedId, { action, newSlotId })
      setShowReschedule(false)
      setOptions([])
      await loadDetail(selectedId)
      await loadList()
      setMessage(
        action === 'confirm'
          ? 'Cita confirmada'
          : action === 'cancel'
            ? 'Cita cancelada · horario liberado'
            : 'Cita reprogramada',
      )
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'No se pudo simular')
    } finally {
      setBusy(false)
    }
  }

  async function saveConfig() {
    if (!config) return
    setBusy(true)
    try {
      const saved = await whatsappApi.updateConfig({
        enabled: !!config.enabled,
        mode: config.mode,
        hoursBefore: Number(config.hoursBefore),
        dayBeforeTime: config.dayBeforeTime,
        intervalMinutes: Number(config.intervalMinutes),
        sendWindowStart: config.sendWindowStart,
        sendWindowEnd: config.sendWindowEnd,
        messageTemplate: config.messageTemplate,
      })
      setConfig(saved)
      setMessage('Configuración guardada')
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      icon={MessageCircle}
      title="WhatsApp"
      subtitle="Confirmación de citas con pacientes"
      actions={
        <div className="flex gap-2">
          <button
            className={`btn-secondary ${tab === 'inbox' ? '!bg-[#128C7E] !text-white !border-[#128C7E]' : ''}`}
            onClick={() => setTab('inbox')}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Bandeja
          </button>
          <button
            className={`btn-secondary ${tab === 'config' ? '!bg-[#128C7E] !text-white !border-[#128C7E]' : ''}`}
            onClick={() => setTab('config')}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configuración
          </button>
        </div>
      }
    >
      {message && (
        <p className="mb-4 text-sm text-status-success bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      {tab === 'inbox' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <KpiCard label="Confirmadas" value={metrics?.confirmed ?? '—'} icon={CheckCircle2} tone="green" />
            <KpiCard label="Canceladas" value={metrics?.cancelled ?? '—'} icon={XCircle} tone="red" />
            <KpiCard label="Reprogramadas" value={metrics?.rescheduled ?? '—'} icon={CalendarClock} tone="amber" />
            <KpiCard label="Sin respuesta" value={metrics?.pending ?? '—'} icon={Clock} tone="slate" />
            <KpiCard label="Cambios por doctor" value={metrics?.doctorChanges ?? '—'} icon={Stethoscope} tone="teal" />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              className={`status-pill cursor-pointer ${!filter ? 'bg-primary text-on-primary' : 'bg-surface-muted'}`}
              onClick={() => setFilter('')}
            >
              Todas
            </button>
            {Object.entries(WA_CHAT_STATUS_LABEL).map(([k, v]) => (
              <button
                key={k}
                className={`status-pill cursor-pointer ${filter === k ? 'bg-primary text-on-primary' : 'bg-surface-muted'}`}
                onClick={() => setFilter(k)}
              >
                {v}
              </button>
            ))}
            <button
              className="btn-secondary ml-auto"
              onClick={() => loadList()}
              title="Actualizar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
          </div>

          <div className="surface-card overflow-hidden grid md:grid-cols-[320px_1fr] min-h-[520px] shadow-soft">
            <aside className="border-r border-outline-variant/50 max-h-[640px] overflow-y-auto bg-[#F0F2F5]">
              {conversations.length === 0 && (
                <p className="p-4 text-sm text-outline">Sin conversaciones</p>
              )}
              {conversations.map((c) => {
                const active = c.id === selectedId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-3 py-3 border-b border-outline-variant/30 hover:bg-white/80 ${
                      active ? 'bg-white shadow-sm' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar
                        firstName={c.patient?.firstName}
                        lastName={c.patient?.lastName}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm truncate">
                            {c.patient?.firstName} {c.patient?.lastName}
                          </p>
                          <StatusBadge
                            status={c.status}
                            label={WA_CHAT_STATUS_LABEL[c.status] || c.status}
                          />
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">
                          {humanPreview(
                            c.lastMessagePreview || c.appointment?.specialty?.name,
                          )}
                        </p>
                        <p className="text-[11px] text-outline mt-1">
                          {c.lastMessageAt
                            ? formatLaPaz(c.lastMessageAt, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </aside>

            <section className="flex flex-col min-h-[520px]">
              {!detail ? (
                <p className="p-6 text-sm text-outline">Seleccioná una conversación</p>
              ) : (
                <>
                  <header className="px-4 py-3 border-b border-black/5 bg-[#075E54] text-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar
                          firstName={detail.patient?.firstName}
                          lastName={detail.patient?.lastName}
                          size="md"
                          className="!bg-white/20 !text-white ring-2 ring-white/30"
                        />
                        <div>
                          <p className="font-semibold">
                            {detail.patient?.firstName} {detail.patient?.lastName}
                          </p>
                          <p className="text-xs text-white/75">
                            {detail.appointment?.specialty?.name || 'Sin especialidad'}
                            {detail.appointment?.doctor
                              ? ` · Dr(a). ${detail.appointment.doctor.lastName}`
                              : ''}
                            {detail.appointment?.slot
                              ? ` · ${formatLaPaz(detail.appointment.slot.startsAt, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <StatusBadge
                          status={detail.status}
                          label={WA_CHAT_STATUS_LABEL[detail.status] || detail.status}
                          className="!bg-white/15 !text-white !border-white/25"
                        />
                        {detail.appointment && (
                          <StatusBadge
                            status={detail.appointment.status}
                            label={`Cita: ${
                              APPT_STATUS_LABEL[detail.appointment.status] ||
                              detail.appointment.status
                            }`}
                            className="!bg-white/15 !text-white !border-white/25"
                          />
                        )}
                        {detail.appointmentId && (
                          <Link
                            href={`/citas?cita=${detail.appointmentId}`}
                            className="text-xs font-semibold text-white/90 underline underline-offset-2"
                          >
                            Ver cita
                          </Link>
                        )}
                      </div>
                    </div>
                  </header>

                  <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[420px] bg-wa-chat">
                    {visibleMessages.map((m: any) => {
                      const inbound = m.direction === 'INBOUND'
                      return (
                        <div
                          key={m.id}
                          className={`flex ${inbound ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={inbound ? 'wa-bubble-in' : 'wa-bubble-out'}>
                            <p className="text-[10px] font-bold text-[#128C7E] mb-0.5">
                              {inbound ? 'Paciente' : 'Hospital'}
                            </p>
                            {m.body}
                            <p className="text-[10px] text-right text-on-surface-variant/80 mt-1 tabular-nums">
                              {formatLaPaz(m.createdAt, { timeStyle: 'short' })}
                              {!inbound && <WaTicks read={detail.status !== 'PENDING'} />}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {detail.status === 'PENDING' && (
                    <footer className="p-4 border-t border-outline-variant/50 space-y-3 bg-surface-muted/20">
                      <p className="label-caps">Simular respuesta del paciente</p>
                      {(detail.kind === 'DOCTOR_CANCEL' ||
                        detail.kind === 'DOCTOR_RESCHEDULE') ? (
                        <>
                          <p className="text-xs text-on-surface-variant">
                            Aviso del doctor: el paciente puede elegir un horario o declinar.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn-primary"
                              disabled={busy}
                              onClick={async () => {
                                const opts = await whatsappApi.options(selectedId)
                                setOptions(opts)
                                setShowReschedule(true)
                              }}
                            >
                              Elegir horario
                            </button>
                            <button
                              className="btn-danger"
                              disabled={busy}
                              onClick={() => simulate('cancel')}
                            >
                              Declinar / cancelar
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn-primary"
                            disabled={busy}
                            onClick={() => simulate('confirm')}
                          >
                            Confirmar
                          </button>
                          <button
                            className="btn-danger"
                            disabled={busy}
                            onClick={() => simulate('cancel')}
                          >
                            Cancelar
                          </button>
                          <button
                            className="btn-secondary"
                            disabled={busy}
                            onClick={() => simulate('reschedule')}
                          >
                            Cambiar horario
                          </button>
                        </div>
                      )}

                      {showReschedule && (
                        <div className="surface-card p-3 space-y-2">
                          <p className="text-sm font-medium">Elegí el nuevo horario</p>
                          {options.length === 0 && (
                            <p className="text-xs text-outline">No hay horarios libres</p>
                          )}
                          {options.map((o) => (
                            <button
                              key={o.slotId}
                              type="button"
                              disabled={busy}
                              className="w-full text-left text-sm px-3 py-2 rounded-lg border border-outline-variant/50 hover:border-primary/40 hover:bg-primary-50/50"
                              onClick={() => simulate('reschedule', o.slotId)}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </footer>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}

      {tab === 'config' && config && (
        <div className="surface-card p-5 max-w-3xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">Envío de confirmaciones</p>
              <p className="text-sm text-on-surface-variant">
                Cuándo y cómo se avisa a los pacientes por WhatsApp
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={!!config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              />
              {config.enabled ? 'Activo' : 'Pausado'}
            </label>
          </div>

          <div>
            <p className="label-caps mb-2">Momento del envío</p>
            <div className="space-y-2">
              {[
                { value: 'SAME_DAY', label: 'El mismo día, horas antes de la cita' },
                { value: 'DAY_BEFORE', label: 'El día anterior, a una hora fija' },
                { value: 'BOTH', label: 'Ambas opciones' },
              ].map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={config.mode === o.value}
                    onChange={() => setConfig({ ...config, mode: o.value })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-caps">Horas antes (mismo día)</label>
              <input
                type="number"
                min={1}
                max={24}
                className="field-input mt-1"
                value={config.hoursBefore}
                onChange={(e) => setConfig({ ...config, hoursBefore: e.target.value })}
              />
            </div>
            <div>
              <label className="label-caps">Hora del día anterior</label>
              <input
                type="time"
                className="field-input mt-1"
                value={config.dayBeforeTime}
                onChange={(e) => setConfig({ ...config, dayBeforeTime: e.target.value })}
              />
            </div>
            <div>
              <label className="label-caps">Frecuencia del proceso</label>
              <select
                className="field-input mt-1"
                value={config.intervalMinutes}
                onChange={(e) => setConfig({ ...config, intervalMinutes: e.target.value })}
              >
                <option value={15}>Cada 15 minutos</option>
                <option value={30}>Cada 30 minutos</option>
                <option value={60}>Cada 60 minutos</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-caps">Desde</label>
                <input
                  type="time"
                  className="field-input mt-1"
                  value={config.sendWindowStart}
                  onChange={(e) => setConfig({ ...config, sendWindowStart: e.target.value })}
                />
              </div>
              <div>
                <label className="label-caps">Hasta</label>
                <input
                  type="time"
                  className="field-input mt-1"
                  value={config.sendWindowEnd}
                  onChange={(e) => setConfig({ ...config, sendWindowEnd: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label-caps">Plantilla del mensaje</label>
            <p className="text-xs text-on-surface-variant mb-1">
              Variables: {'{{paciente}}'}, {'{{doctor}}'}, {'{{especialidad}}'}, {'{{fecha}}'}, {'{{hora}}'}
            </p>
            <textarea
              className="field-input mt-1 min-h-[120px]"
              value={config.messageTemplate || ''}
              onChange={(e) => setConfig({ ...config, messageTemplate: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const r = await whatsappApi.runNow()
                  setMessage(`Proceso ejecutado · enviados: ${r.sent ?? 0}`)
                  await loadList()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Ejecutar ahora
            </button>
            <button className="btn-primary" disabled={busy} onClick={saveConfig}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </PageShell>
  )
}
