interface AirportCodeProps {
  code: string
  city?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function AirportCode({
  code,
  city,
  name,
  size = 'md',
}: AirportCodeProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  return (
    <div className="flex flex-col">
      <span
        className={`${sizeClasses[size]} font-bold tracking-tight text-ink tabular-nums uppercase leading-none`}
      >
        {code}
      </span>
      {city && (
        <span className="text-xs text-subtle font-medium mt-1 truncate">
          {city}
        </span>
      )}
      {name && (
        <span className="text-[11px] text-subtle truncate max-w-[140px]">
          {name}
        </span>
      )}
    </div>
  )
}
