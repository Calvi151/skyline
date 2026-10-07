interface FloatingPassProps {
  flightNumber?: string
  origin?: string
  destination?: string
  departureTime?: string
  arrivalTime?: string
  seatNumber?: string
  zone?: string
  className?: string
}

export default function FloatingPass({
  flightNumber = 'GA-402',
  origin = 'CGK',
  destination = 'DPS',
  departureTime = '07.40',
  arrivalTime = '10.30',
  seatNumber = '14A',
  zone = 'ZONA 2',
  className = '',
}: FloatingPassProps) {
  return (
    <div
      className={`bg-raised text-ink p-4 rounded-ticket border border-line shadow-[0_20px_35px_rgba(11,37,69,0.14)] dark:shadow-[0_20px_35px_rgba(0,0,0,0.45)] w-64 animate-float hover:!transform-none hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 select-none overflow-hidden relative ${className}`}
    >
      {/* Shimmer light reflection beam */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-ticket">
        <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent skew-x-[-20deg] animate-shimmer" />
      </div>

      <div className="flex items-center justify-between border-b border-line pb-2 mb-2 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-brand-fg">
            BOARDING PASS
          </span>
        </div>
        <span className="text-[10px] font-semibold tracking-wider uppercase text-subtle">
          {flightNumber}
        </span>
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-2xl font-bold tracking-tight text-ink font-sans tabular-nums">
            {origin}
          </span>
          <p className="text-[11px] text-subtle font-sans">{departureTime}</p>
        </div>
        <span className="material-symbols-outlined text-brand-fg text-[18px]">
          arrow_forward
        </span>
        <div className="text-right">
          <span className="text-2xl font-bold tracking-tight text-ink font-sans tabular-nums">
            {destination}
          </span>
          <p className="text-[11px] text-subtle font-sans">{arrivalTime}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-dashed border-line text-[12px]">
        <div>
          <span className="text-subtle block text-[10px] uppercase font-medium">
            Kursi
          </span>
          <span className="text-sm font-bold text-signal font-sans">
            {seatNumber}
          </span>
        </div>
        <div className="text-right">
          <span className="text-subtle block text-[10px] uppercase font-medium">
            Zona
          </span>
          <span className="font-semibold text-ink text-[12px]">{zone}</span>
        </div>
      </div>
    </div>
  )
}
