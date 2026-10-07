import FloatingPass from '../common/FloatingPass'

interface RouteMapProps {
  highlightedRoute?: string | null
}

export default function RouteMap({ highlightedRoute }: RouteMapProps) {
  // Routes mapping
  const isCgkDps = !highlightedRoute || highlightedRoute === 'CGK-DPS'
  const isCgkSub = highlightedRoute === 'CGK-SUB'
  const isCgkUpg = highlightedRoute === 'CGK-UPG'
  const isDpsJog = highlightedRoute === 'DPS-JOG'
  const isSubDps = highlightedRoute === 'SUB-DPS'
  const isCgkKno = highlightedRoute === 'CGK-KNO'

  return (
    <div className="relative flex items-center justify-center min-h-[360px] select-none w-full">
      <div className="w-full relative h-[340px] flex items-center justify-center">
        <svg
          className="w-full h-full"
          fill="none"
          viewBox="0 0 680 340"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="routeGradient" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#1d5bd6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1d5bd6" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Network Connections (Hairline curves) */}
          {/* CGK -> KNO */}
          <path
            d="M 260 170 Q 200 130 120 70"
            stroke={isCgkKno ? '#1d5bd6' : 'currentColor'}
            className={isCgkKno ? 'text-brand-fg' : 'text-line'}
            strokeWidth={isCgkKno ? 3 : 1.5}
            strokeDasharray={isCgkKno ? 'none' : '4 4'}
            strokeLinecap="round"
          />

          {/* CGK -> JOG */}
          <path
            d="M 260 170 Q 320 180 360 195"
            stroke={highlightedRoute === 'CGK-JOG' ? '#1d5bd6' : 'currentColor'}
            className={highlightedRoute === 'CGK-JOG' ? 'text-brand-fg' : 'text-line'}
            strokeWidth={highlightedRoute === 'CGK-JOG' ? 3 : 1.5}
          />

          {/* JOG -> DPS */}
          <path
            d="M 360 195 Q 400 205 440 215"
            stroke={isDpsJog ? '#1d5bd6' : 'currentColor'}
            className={isDpsJog ? 'text-brand-fg' : 'text-line'}
            strokeWidth={isDpsJog ? 3 : 1.5}
          />

          {/* SUB -> UPG */}
          <path
            d="M 410 175 Q 470 160 520 150"
            stroke={isCgkUpg ? '#1d5bd6' : 'currentColor'}
            className={isCgkUpg ? 'text-brand-fg' : 'text-line'}
            strokeWidth={isCgkUpg ? 3 : 1.5}
            strokeDasharray={isCgkUpg ? 'none' : '4 4'}
          />

          {/* CGK -> SUB */}
          <path
            d="M 260 170 Q 330 170 410 175"
            stroke={isCgkSub ? '#1d5bd6' : 'currentColor'}
            className={isCgkSub ? 'text-brand-fg' : 'text-line'}
            strokeWidth={isCgkSub ? 3.5 : 1.5}
            strokeDasharray={isCgkSub ? 'none' : '5 5'}
          />

          {/* SUB -> DPS */}
          <path
            d="M 410 175 Q 425 200 440 215"
            stroke={isSubDps ? '#1d5bd6' : 'currentColor'}
            className={isSubDps ? 'text-brand-fg' : 'text-line'}
            strokeWidth={isSubDps ? 3.5 : 1.5}
          />

          {/* CGK -> DPS Primary Route */}
          <path
            d="M 260 170 C 320 200, 390 220, 440 215"
            id="activeFlightPath"
            stroke="#1d5bd6"
            className="text-brand-fg transition-all duration-300"
            strokeLinecap="round"
            strokeWidth={isCgkDps ? 3.5 : 2}
          />

          {/* Animated Flight Stream Dash on CGK -> DPS */}
          {isCgkDps && (
            <path
              d="M 260 170 C 320 200, 390 220, 440 215"
              stroke="#1d5bd6"
              className="text-brand-fg opacity-80 animate-flight-dash"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          )}

          {/* Trailing Dash on CGK -> DPS */}
          <path
            d="M 260 170 C 290 185, 330 200, 360 208"
            stroke="#1d5bd6"
            className="text-brand-fg opacity-40"
            strokeDasharray="4 4"
            strokeWidth="2"
          />

          {/* Airplane Glyph along CGK-DPS with subtle bobbing */}
          <g className="transition-transform duration-500 hover:scale-110 cursor-pointer">
            <g transform="translate(365, 204) rotate(16)">
              <circle
                cx="0"
                cy="0"
                r="14"
                className="fill-panel stroke-brand-fg shadow-md transition-colors"
                strokeWidth="1.5"
              />
              <path
                d="M-5 -1 L0 -7 L5 -1 L2 4 L-2 4 Z"
                className="fill-brand-fg"
              />
            </g>
          </g>

          {/* City Nodes */}
          {/* KNO (Medan) */}
          <circle cx="120" cy="70" r="5" className={`transition-all duration-300 ${isCgkKno ? 'fill-brand-fg scale-125' : 'fill-subtle'}`} />
          <text
            x="110"
            y="55"
            className="fill-ink font-bold text-sm tracking-tight"
          >
            KNO
          </text>
          <text x="110" y="90" className="fill-subtle text-[11px]">
            Medan
          </text>

          {/* CGK (Jakarta) */}
          {/* Radar ripple wave */}
          <circle
            cx="260"
            cy="170"
            r="16"
            stroke="#1d5bd6"
            fill="none"
            className="text-brand-fg opacity-40"
            strokeWidth="1.5"
          >
            <animate attributeName="r" values="8;24" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="260" cy="170" r="7" className="fill-brand-fg transition-transform duration-300 hover:scale-125 cursor-pointer" />
          <text
            x="215"
            y="165"
            className="fill-ink font-bold text-base tracking-tight"
          >
            CGK
          </text>
          <text x="215" y="185" className="fill-subtle text-[11px]">
            Jakarta
          </text>

          {/* JOG (Yogyakarta) */}
          <circle cx="360" cy="195" r="4.5" className={isDpsJog ? 'fill-brand-fg' : 'fill-subtle'} />
          <text
            x="350"
            y="222"
            className="fill-ink font-bold text-sm tracking-tight"
          >
            JOG
          </text>
          <text x="340" y="238" className="fill-subtle text-[11px]">
            Yogyakarta
          </text>

          {/* SUB (Surabaya) */}
          <circle cx="410" cy="175" r="5" className={isCgkSub || isSubDps ? 'fill-brand-fg' : 'fill-subtle'} />
          <text
            x="415"
            y="165"
            className="fill-ink font-bold text-sm tracking-tight"
          >
            SUB
          </text>
          <text x="415" y="180" className="fill-subtle text-[11px]">
            Surabaya
          </text>

          {/* DPS (Denpasar) */}
          <circle
            cx="440"
            cy="215"
            r="16"
            stroke="#1d5bd6"
            fill="none"
            className="text-brand-fg opacity-40"
            strokeWidth="1.5"
          >
            <animate attributeName="r" values="8;24" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="440" cy="215" r="7" className="fill-brand-fg transition-transform duration-300 hover:scale-125 cursor-pointer" />
          <text
            x="455"
            y="218"
            className="fill-ink font-bold text-base tracking-tight"
          >
            DPS
          </text>
          <text x="455" y="235" className="fill-subtle text-[11px]">
            Denpasar
          </text>

          {/* UPG (Makassar) */}
          <circle cx="520" cy="150" r="5" className={isCgkUpg ? 'fill-brand-fg' : 'fill-subtle'} />
          <text
            x="532"
            y="148"
            className="fill-ink font-bold text-sm tracking-tight"
          >
            UPG
          </text>
          <text x="532" y="165" className="fill-subtle text-[11px]">
            Makassar
          </text>
        </svg>

        {/* Floating Mini Boarding Pass - Overlapping bottom-left */}
        <div className="absolute bottom-1 left-2 sm:left-6 z-10">
          <FloatingPass
            flightNumber="GA-402"
            origin="CGK"
            destination="DPS"
            departureTime="07.40"
            arrivalTime="10.30"
            seatNumber="14A"
            zone="ZONA 2"
          />
        </div>
      </div>
    </div>
  )
}
