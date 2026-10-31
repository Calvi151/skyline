import { useMemo, useRef, useState } from 'react'

/* ───────────────── Area / line chart with hover crosshair ───────────────── */
export interface SeriesPoint {
  label: string
  value: number
}

export function AreaChart({
  data,
  height = 240,
  formatValue = (v) => String(v),
  formatLabel = (l) => l,
}: {
  data: SeriesPoint[]
  height?: number
  formatValue?: (v: number) => string
  formatLabel?: (l: string) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const W = 800
  const H = height
  const padL = 44
  const padR = 12
  const padT = 16
  const padB = 28

  const { max, ticks, points, line, area } = useMemo(() => {
    const raw = Math.max(1, ...data.map((d) => d.value))
    // nice ceiling
    const mag = Math.pow(10, Math.floor(Math.log10(raw)))
    const max = Math.ceil(raw / mag) * mag
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t)
    const n = Math.max(1, data.length - 1)
    const points = data.map((d, i) => ({
      x: padL + (i / n) * (W - padL - padR),
      y: padT + (1 - d.value / max) * (H - padT - padB),
    }))
    // smooth path (monotone-ish cardinal)
    let line = ''
    points.forEach((p, i) => {
      if (i === 0) return (line = `M ${p.x} ${p.y}`)
      const prev = points[i - 1]
      const cx = (prev.x + p.x) / 2
      line += ` C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`
    })
    const area = points.length
      ? `${line} L ${points[points.length - 1].x} ${H - padB} L ${points[0].x} ${H - padB} Z`
      : ''
    return { max, ticks, points, line, area }
  }, [data, H])

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current || !data.length) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const n = Math.max(1, data.length - 1)
    const idx = Math.round(((x - padL) / (W - padL - padR)) * n)
    setHover(Math.min(data.length - 1, Math.max(0, idx)))
  }

  const labelEvery = Math.max(1, Math.ceil(data.length / 7))
  const hp = hover !== null ? points[hover] : null

  return (
    <div ref={ref} className="relative w-full select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => {
          const y = padT + (1 - t / max) * (H - padT - padB)
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} className="stroke-line" strokeDasharray="3 4" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
                {formatValue(t)}
              </text>
            </g>
          )
        })}

        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={d.label} x={points[i]?.x} y={H - 8} textAnchor="middle" className="fill-subtle text-[11px]">
              {formatLabel(d.label)}
            </text>
          ) : null,
        )}

        <g className="text-brand-fg">
          <path d={area} fill="url(#area-fill)" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        </g>

        {hp && (
          <g>
            <line x1={hp.x} x2={hp.x} y1={padT} y2={H - padB} className="stroke-ink/20" />
            <circle cx={hp.x} cy={hp.y} r="5" className="fill-raised stroke-brand-fg" strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full px-3 py-2 rounded-control bg-ink text-page shadow-lg text-xs whitespace-nowrap"
          style={{ left: `${(hp.x / W) * 100}%`, top: `${(hp.y / H) * 100}%`, marginTop: -10 }}
        >
          <span className="block opacity-70">{formatLabel(data[hover].label)}</span>
          <span className="block font-bold tabular-nums">{formatValue(data[hover].value)}</span>
        </div>
      )}
    </div>
  )
}

/* ───────────────── Sparkline ───────────────── */
export function Sparkline({ values, className = 'text-brand-fg' }: { values: number[]; className?: string }) {
  const W = 120
  const H = 36
  const max = Math.max(1, ...values)
  const n = Math.max(1, values.length - 1)
  const pts = values.map((v, i) => `${(i / n) * W},${H - 2 - (v / max) * (H - 4)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-24 h-9 ${className}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ───────────────── Donut ───────────────── */
export interface DonutSlice {
  label: string
  value: number
  color: string // tailwind stroke class, e.g. 'stroke-emerald-500'
  dot: string // tailwind bg class
}

export function Donut({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel: string }) {
  const [active, setActive] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = 54
  const c = 2 * Math.PI * r
  let acc = 0

  const shown = active !== null ? slices[active] : null

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-40 h-40 shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" strokeWidth="16" className="stroke-line/60" />
          {total > 0 &&
            slices.map((s, i) => {
              const len = (s.value / total) * c
              const el = (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  strokeWidth={active === i ? 20 : 16}
                  strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                  strokeDashoffset={-acc}
                  className={`${s.color} transition-all duration-200 cursor-pointer`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              )
              acc += len
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-ink tabular-nums">{shown ? shown.value : total}</span>
          <span className="text-[11px] text-subtle">{shown ? shown.label : centerLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {slices.map((s, i) => {
          const pct = total ? Math.round((s.value / total) * 100) : 0
          return (
            <li
              key={s.label}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-3 px-2.5 py-1.5 rounded-control text-xs transition-colors cursor-default ${
                active === i ? 'bg-panel' : ''
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              <span className="flex-1 text-ink font-medium">{s.label}</span>
              <span className="tabular-nums text-subtle">{s.value}</span>
              <span className="tabular-nums font-semibold text-ink w-10 text-right">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ───────────────── Segmented control ───────────────── */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex p-0.5 rounded-control bg-panel border border-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 h-7 rounded-[6px] text-xs font-semibold transition-all ${
            value === o.value ? 'bg-raised text-ink shadow-xs' : 'text-subtle hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

