
interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: string
  }
  className?: string
}

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-panel border border-line rounded-ticket ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-tint text-brand-fg flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[30px]">{icon}</span>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-ink mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-subtle max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="h-10 px-5 bg-brand hover:bg-brand-hover text-white rounded-control text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
        >
          {action.icon && (
            <span className="material-symbols-outlined text-[16px]">
              {action.icon}
            </span>
          )}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  )
}
