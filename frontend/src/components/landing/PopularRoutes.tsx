import { useNavigate } from 'react-router-dom'

export interface RouteItem {
  id: string
  airlineCode: string
  originCode: string
  originCity: string
  destinationCode: string
  destinationCity: string
  departureTime: string
  arrivalTime: string
  duration: string
  transitInfo?: string
  isDirect: boolean
  startPrice: number
}

const POPULAR_ROUTES: RouteItem[] = [
  {
    id: 'cgk-dps',
    airlineCode: 'GA',
    originCode: 'CGK',
    originCity: 'Jakarta',
    destinationCode: 'DPS',
    destinationCity: 'Denpasar',
    departureTime: '07.40',
    arrivalTime: '10.30',
    duration: '2j 50m',
    isDirect: true,
    startPrice: 1286000,
  },
  {
    id: 'cgk-sub',
    airlineCode: 'ID',
    originCode: 'CGK',
    originCity: 'Jakarta',
    destinationCode: 'SUB',
    destinationCity: 'Surabaya',
    departureTime: '06.15',
    arrivalTime: '07.45',
    duration: '1j 30m',
    isDirect: true,
    startPrice: 840000,
  },
  {
    id: 'cgk-upg',
    airlineCode: 'QG',
    originCode: 'CGK',
    originCity: 'Jakarta',
    destinationCode: 'UPG',
    destinationCity: 'Makassar',
    departureTime: '06.15',
    arrivalTime: '10.50',
    duration: '4j 35m',
    transitInfo: 'Transit di SUB (1j 05m)',
    isDirect: false,
    startPrice: 1450000,
  },
  {
    id: 'dps-jog',
    airlineCode: 'JT',
    originCode: 'DPS',
    originCity: 'Denpasar',
    destinationCode: 'JOG',
    destinationCity: 'Yogyakarta',
    departureTime: '11.20',
    arrivalTime: '11.45',
    duration: '1j 25m',
    isDirect: true,
    startPrice: 780000,
  },
  {
    id: 'sub-dps',
    airlineCode: 'SJ',
    originCode: 'SUB',
    originCity: 'Surabaya',
    destinationCode: 'DPS',
    destinationCity: 'Denpasar',
    departureTime: '13.10',
    arrivalTime: '14.05',
    duration: '55m',
    isDirect: true,
    startPrice: 620000,
  },
  {
    id: 'cgk-kno',
    airlineCode: 'GA',
    originCode: 'CGK',
    originCity: 'Jakarta',
    destinationCode: 'KNO',
    destinationCity: 'Medan',
    departureTime: '08.00',
    arrivalTime: '10.20',
    duration: '2j 20m',
    isDirect: true,
    startPrice: 1150000,
  },
]

interface PopularRoutesProps {
  onHoverRoute?: (routeKey: string | null) => void
  onSelectRoute?: (route: RouteItem) => void
}

export default function PopularRoutes({ onHoverRoute, onSelectRoute }: PopularRoutesProps) {
  const navigate = useNavigate()

  const handleRouteClick = (route: RouteItem) => {
    if (onSelectRoute) {
      onSelectRoute(route)
    } else {
      const todayStr = new Date().toISOString().slice(0, 10)
      navigate(
        `/search?origin=${route.originCode}&destination=${route.destinationCode}&date=${todayStr}&passengers=1&class=economy`
      )
    }
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    })
      .format(val)
      .replace('IDR', 'Rp')
      .trim()
  }

  return (
    <section className="w-full py-10 md:py-16 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight font-sans">
            Rute penerbangan populer
          </h2>
          <p className="text-sm md:text-base text-subtle mt-1 font-sans">
            Jadwal harian dengan kepastian kursi dan bagasi tercatat.
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center gap-2 text-subtle text-xs md:text-sm font-sans">
          <span className="w-2 h-2 rounded-full bg-brand-fg" />
          <span>Tarif terendah 30 hari ke depan</span>
        </div>
      </div>

      {/* Departure Board Rows */}
      <div className="w-full bg-panel rounded-ticket border border-line overflow-hidden shadow-sm">
        {POPULAR_ROUTES.map((route, index) => {
          const routeKey = `${route.originCode}-${route.destinationCode}`
          const isLast = index === POPULAR_ROUTES.length - 1

          return (
            <div
              key={route.id}
              onMouseEnter={() => onHoverRoute && onHoverRoute(routeKey)}
              onMouseLeave={() => onHoverRoute && onHoverRoute(null)}
              onClick={() => handleRouteClick(route)}
              className={`group grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 transition-all duration-200 cursor-pointer ${
                !isLast ? 'border-b border-line' : ''
              } hover:bg-tint/60 hover:pl-5`}
            >
              {/* Airline Badge & Route Name */}
              <div className="md:col-span-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-control bg-raised border border-line flex items-center justify-center text-brand-fg font-bold text-sm select-none group-hover:scale-105 group-hover:border-brand-fg transition-all">
                  {route.airlineCode}
                </div>
                <div>
                  <div className="text-base font-bold text-ink tracking-tight font-sans flex items-center gap-1.5">
                    <span>{route.originCode}</span>
                    <span className="text-brand-fg group-hover:translate-x-0.5 transition-transform">→</span>
                    <span>{route.destinationCode}</span>
                  </div>
                  <div className="text-xs text-subtle">
                    {route.originCity} ke {route.destinationCity}
                  </div>
                </div>
              </div>

              {/* Timing & Transit info */}
              <div className="md:col-span-4 flex items-center justify-between">
                <div className="text-left">
                  <div className="text-base font-bold text-ink tabular-nums font-sans">
                    {route.departureTime} – {route.arrivalTime}
                  </div>
                  <div className="text-xs text-subtle flex items-center gap-1.5">
                    {route.isDirect ? (
                      <span>Langsung • {route.duration}</span>
                    ) : (
                      <span>
                        {route.transitInfo} • {route.duration}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                    route.isDirect
                      ? 'bg-tint text-brand-fg'
                      : 'bg-panel border border-line text-subtle'
                  }`}
                >
                  {route.isDirect ? 'Langsung' : '1 Transit'}
                </div>
              </div>

              {/* Price */}
              <div className="md:col-span-3 text-left md:text-right">
                <span className="block text-[10px] uppercase tracking-wider text-subtle font-semibold">
                  Mulai dari
                </span>
                <span className="text-base md:text-lg font-bold text-ink group-hover:text-brand-fg tabular-nums font-sans transition-colors">
                  {formatRupiah(route.startPrice)}
                </span>
              </div>

              {/* Action Button */}
              <div className="md:col-span-2 flex justify-start md:justify-end">
                <span className="inline-flex items-center gap-1 text-sm text-brand-fg font-semibold group-hover:underline">
                  <span>Lihat jadwal</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1.5 transition-transform duration-200">
                    chevron_right
                  </span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
