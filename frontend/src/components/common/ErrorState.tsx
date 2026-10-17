
interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export default function ErrorState({
  title = 'Terjadi Gangguan',
  message,
  onRetry,
  retryLabel = 'Coba Lagi',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-panel border border-danger/20 rounded-ticket ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[30px]">error_outline</span>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-ink mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-subtle max-w-sm mb-6 leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-10 px-5 bg-panel border border-line hover:bg-tint text-ink rounded-control text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  )
}
