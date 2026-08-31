'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <div className="text-center surface-card p-8 max-w-md">
        <h2 className="text-2xl font-bold text-status-error mb-4">
          Algo salió mal
        </h2>
        <p className="text-on-surface-variant mb-4">{error.message}</p>
        <button onClick={reset} className="btn-primary">
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
