interface RouteLineProps {
  duration?: string
  flightType?: 'direct' | 'transit'
  transitStops?: string[]
}

export default function RouteLine({
  duration,
  flightType = 'direct',
  transitStops = [],
}: RouteLineProps) {
  const isTransit = flightType === 'transit' || transitStops.length > 0

  return (
    <div className="flex flex-col items-center justify-center w-full min-w-[100px] px-2">
      {/* Duration text above the line */}
      {duration && (
        <span className="text-[11px] font-medium text-subtle tabular-nums mb-1">
          {duration}
        </span>
      )}

      {/* Flight line with plane icon */}
      <div className="relative w-full flex items-center justify-center">
        {/* Track line */}
        <div className="w-full h-[2px] bg-line relative flex items-center">
          <div className="w-full h-full bg-brand-fg/60" />
        </div>

        {/* Start dot */}
        <div className="absolute left-0 w-2 h-2 rounded-full bg-brand-fg ring-2 ring-panel" />

        {/* Transit dots (if transit) */}
        {isTransit &&
          (transitStops.length > 0
            ? transitStops.map((stop, i) => (
                <div
                  key={stop}
                  className="absolute w-2 h-2 rounded-full bg-signal ring-2 ring-panel"
                  style={{
                    left: `${((i + 1) / (transitStops.length + 1)) * 100}%`,
                    transform: 'translateX(-50%)',
                  }}
                  title={`Transit di ${stop}`}
                />
              ))
            : (
                <div
                  className="absolute w-2 h-2 rounded-full bg-signal ring-2 ring-panel left-1/2 -translate-x-1/2"
                  title="1 Transit"
                />
              ))}

        {/* End dot */}
        <div className="absolute right-0 w-2 h-2 rounded-full bg-brand-fg ring-2 ring-panel" />

        {/* Airplane glyph in center */}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-[1px] bg-panel px-1 text-brand-fg">
          <span className="material-symbols-outlined text-[14px] rotate-90 block">
            flight
          </span>
        </div>
      </div>

      {/* Flight type text below the line */}
      <span className="text-[10px] text-subtle mt-1 font-medium">
        {isTransit
          ? transitStops.length > 0
            ? `${transitStops.length} Transit (${transitStops.join(', ')})`
            : '1 Transit'
          : 'Langsung'}
      </span>
    </div>
  )
}
