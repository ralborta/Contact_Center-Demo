'use client'

import type { LucideIcon } from 'lucide-react'
import { Check, CheckCheck } from 'lucide-react'

export type KpiTone =
  | 'teal'
  | 'blue'
  | 'green'
  | 'red'
  | 'amber'
  | 'whatsapp'
  | 'violet'
  | 'slate'

const KPI_TONES: Record<
  KpiTone,
  { iconBg: string; iconFg: string; card: string; value: string }
> = {
  teal: {
    iconBg: 'bg-primary-100',
    iconFg: 'text-primary',
    card: 'border-l-[3px] border-l-primary bg-gradient-to-br from-primary-50/80 to-white',
    value: 'text-primary-700',
  },
  blue: {
    iconBg: 'bg-sky-100',
    iconFg: 'text-sky-700',
    card: 'border-l-[3px] border-l-sky-500 bg-gradient-to-br from-sky-50/90 to-white',
    value: 'text-sky-800',
  },
  green: {
    iconBg: 'bg-emerald-100',
    iconFg: 'text-emerald-700',
    card: 'border-l-[3px] border-l-emerald-500 bg-gradient-to-br from-emerald-50/90 to-white',
    value: 'text-emerald-800',
  },
  red: {
    iconBg: 'bg-red-100',
    iconFg: 'text-red-600',
    card: 'border-l-[3px] border-l-red-500 bg-gradient-to-br from-red-50/90 to-white',
    value: 'text-red-700',
  },
  amber: {
    iconBg: 'bg-amber-100',
    iconFg: 'text-amber-700',
    card: 'border-l-[3px] border-l-amber-500 bg-gradient-to-br from-amber-50/90 to-white',
    value: 'text-amber-800',
  },
  whatsapp: {
    iconBg: 'bg-[#DCF8C6]',
    iconFg: 'text-[#128C7E]',
    card: 'border-l-[3px] border-l-[#25D366] bg-gradient-to-br from-[#F0FFF4] to-white',
    value: 'text-[#075E54]',
  },
  violet: {
    iconBg: 'bg-violet-100',
    iconFg: 'text-violet-700',
    card: 'border-l-[3px] border-l-violet-500 bg-gradient-to-br from-violet-50/90 to-white',
    value: 'text-violet-800',
  },
  slate: {
    iconBg: 'bg-slate-100',
    iconFg: 'text-slate-600',
    card: 'border-l-[3px] border-l-slate-400 bg-gradient-to-br from-slate-50 to-white',
    value: 'text-slate-700',
  },
}

const BADGE: Record<string, string> = {
  // citas
  RESERVED: 'bg-sky-50 text-sky-700 border-sky-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED_BY_PATIENT: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED_BY_DOCTOR: 'bg-orange-50 text-orange-700 border-orange-200',
  RESCHEDULED: 'bg-amber-50 text-amber-800 border-amber-200',
  NEEDS_RESCHEDULE: 'bg-amber-50 text-amber-800 border-amber-300',
  COMPLETED: 'bg-slate-100 text-slate-600 border-slate-200',
  NO_SHOW: 'bg-rose-50 text-rose-700 border-rose-200',
  // whatsapp
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  // llamadas / misc
  INBOUND: 'bg-sky-50 text-sky-700 border-sky-200',
  OUTBOUND: 'bg-amber-50 text-amber-800 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-200',
  FREE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BLOCKED: 'bg-slate-100 text-slate-600 border-slate-300',
  // campañas
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  QUEUED: 'bg-sky-50 text-sky-700 border-sky-200',
  RUNNING: 'bg-violet-50 text-violet-700 border-violet-200',
  CALLING: 'bg-sky-50 text-sky-700 border-sky-200',
  NO_ANSWER: 'bg-amber-50 text-amber-800 border-amber-200',
  VOICEMAIL: 'bg-amber-50 text-amber-800 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
}

const SPECIALTY_PALETTE = [
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
]

function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function initials(first?: string | null, last?: string | null, fallback = '?') {
  const a = (first || '').trim().charAt(0)
  const b = (last || '').trim().charAt(0)
  const out = `${a}${b}`.toUpperCase()
  return out || fallback
}

const AVATAR_BG = [
  'bg-primary text-on-primary',
  'bg-sky-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-violet-600 text-white',
  'bg-[#128C7E] text-white',
  'bg-rose-600 text-white',
  'bg-cyan-700 text-white',
]

export function Avatar({
  firstName,
  lastName,
  label,
  size = 'md',
  className = '',
}: {
  firstName?: string | null
  lastName?: string | null
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const text = label || initials(firstName, lastName)
  const key = `${firstName || ''}${lastName || ''}${label || ''}`
  const tone = AVATAR_BG[hashStr(key) % AVATAR_BG.length]
  const sz =
    size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide ${sz} ${tone} ${className}`}
      aria-hidden
    >
      {text.slice(0, 2)}
    </span>
  )
}

export function StatusBadge({
  status,
  label,
  className = '',
}: {
  status?: string | null
  label?: string
  className?: string
}) {
  const key = String(status || '')
  const tone = BADGE[key] || 'bg-surface-muted text-on-surface-variant border-outline-variant'
  return (
    <span className={`status-pill border ${tone} ${className}`}>
      {label || key || '—'}
    </span>
  )
}

export function SpecialtyChip({ name }: { name?: string | null }) {
  if (!name) return null
  const tone = SPECIALTY_PALETTE[hashStr(name) % SPECIALTY_PALETTE.length]
  return <span className={`status-pill border ${tone}`}>{name}</span>
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'teal',
  live,
}: {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  tone?: KpiTone
  live?: boolean
}) {
  const t = KPI_TONES[tone]
  return (
    <div className={`surface-card p-4 shadow-soft ${t.card}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-full ${t.iconBg} ${t.iconFg}`}>
          <Icon className="w-4 h-4" strokeWidth={2.25} />
        </div>
        {live && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft" />}
      </div>
      <p className={`text-2xl md:text-3xl font-display font-semibold tabular-nums ${t.value}`}>
        {value}
      </p>
      <p className="label-caps mt-1.5">{label}</p>
    </div>
  )
}

export function IconAction({
  icon: Icon,
  label,
  onClick,
  href,
  tone = 'primary',
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  href?: string
  tone?: 'primary' | 'danger' | 'amber' | 'muted'
  disabled?: boolean
}) {
  const tones = {
    primary: 'text-primary border-primary/25 hover:bg-primary-50',
    danger: 'text-red-700 border-red-200 hover:bg-red-50',
    amber: 'text-amber-800 border-amber-200 hover:bg-amber-50',
    muted: 'text-on-surface-variant border-outline-variant hover:bg-surface-muted',
  }
  const cls = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-40 ${tones[tone]}`
  if (href) {
    return (
      <a href={href} className={cls}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </a>
    )
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

/** Mini sparkline SVG from numeric series */
export function Sparkline({
  values,
  className = '',
  stroke = '#0F5C5C',
}: {
  values: number[]
  className?: string
  stroke?: string
}) {
  const nums = values.length ? values : [0]
  const max = Math.max(...nums, 1)
  const min = Math.min(...nums, 0)
  const w = 120
  const h = 36
  const pts = nums
    .map((v, i) => {
      const x = (i / Math.max(nums.length - 1, 1)) * w
      const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  )
}

export function WaTicks({ read }: { read?: boolean }) {
  if (read) return <CheckCheck className="w-3.5 h-3.5 inline text-[#53BDEB] ml-1" />
  return <Check className="w-3.5 h-3.5 inline text-white/70 ml-1" />
}

export function specialtyBarColor(name: string, index: number) {
  const colors = [
    '#0F5C5C',
    '#2B6CB0',
    '#6D28D9',
    '#B7791F',
    '#C53030',
    '#128C7E',
    '#0891B2',
    '#DB2777',
  ]
  return colors[hashStr(name + index) % colors.length]
}
