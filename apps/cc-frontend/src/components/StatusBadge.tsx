'use client'

const STYLES: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-status-success',
  IN_PROGRESS: 'bg-blue-100 text-primary-container',
  ABANDONED: 'bg-amber-100 text-amber-700',
  NEW: 'bg-surface-container-high text-on-surface-variant',
  FAILED: 'bg-red-100 text-status-error',
  RESOLVED: 'bg-emerald-100 text-status-success',
  ACTIVE: 'bg-emerald-100 text-status-success',
  INACTIVE: 'bg-surface-container-high text-on-surface-variant',
}

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] || STYLES.NEW
  return <span className={`status-pill ${style}`}>{status}</span>
}
