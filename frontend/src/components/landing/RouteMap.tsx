import FloatingPass from '../common/FloatingPass'

interface RouteMapProps {
  highlightedRoute?: string | null
}

const ROUTE_DETAILS: Record<
  string,
  { flightNumber: string; origin: string; destination: string; dep: string; arr: string; seat: string }
> = {
  'CGK-DPS': { flightNumber: 'GA-402', origin: 'CGK', destination: 'DPS', dep: '07.40', arr: '10.30', seat: '14A' },
  'CGK-SUB': { flightNumber: 'GA-308', origin: 'CGK', destination: 'SUB', dep: '08.15', arr: '09.50', seat: '12F' },
  'CGK-UPG': { flightNumber: 'ID-6280', origin: 'CGK', destination: 'UPG', dep: '06.30', arr: '10.00', seat: '08A' },
  'DPS-JOG': { flightNumber: 'JT-565', origin: 'DPS', destination: 'JOG', dep: '13.20', arr: '13.45', seat: '19C' },
  'SUB-DPS': { flightNumber: 'QG-712', origin: 'SUB', destination: 'DPS', dep: '15.00', arr: '16.55', seat: '05F' },
  'CGK-KNO': { flightNumber: 'GA-186', origin: 'CGK', destination: 'KNO', dep: '09.00', arr: '11.25', seat: '11A' },
}

export default function RouteMap({ highlightedRoute }: RouteMapProps) {
  const activeRoute =
    (highlightedRoute && ROUTE_DETAILS[highlightedRoute]) || ROUTE_DETAILS['CGK-DPS']

  return (
    <div className="relative flex flex-col justify-between min-h-[280px] md:min-h-[340px] select-none w-full py-2">
      {/* Top-Right Floating Status & Promo Badge (Leaves center Globe & Airplane 100% unobstructed) */}
      <div className="self-end flex flex-col items-end gap-2.5">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/65 backdrop-blur-md border border-white/20 text-white shadow-lg">
          <span className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
            <span className="material-symbols-outlined text-[18px]">public</span>
          </span>
          <div className="text-left leading-tight pr-1">
            <span className="text-[11px] font-bold text-white block">
              Rute Domestik &amp; Global
            </span>
            <span className="text-[10px] text-sky-300 font-medium block">
              100+ Destinasi Dunia Terhubung
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-200 text-[11px] font-semibold shadow-md">
          <span className="material-symbols-outlined text-[14px] text-emerald-300">local_offer</span>
          <span>Promo PP Hemat 10% &amp; Grup s/d 15%</span>
        </div>
      </div>

      {/* Bottom-Right Floating Boarding Pass Card */}
      <div className="self-end mt-auto pt-12 mr-1 sm:mr-2 z-10">
        <FloatingPass
          flightNumber={activeRoute.flightNumber}
          origin={activeRoute.origin}
          destination={activeRoute.destination}
          departureTime={activeRoute.dep}
          arrivalTime={activeRoute.arr}
          seatNumber={activeRoute.seat}
          zone="ZONA 2"
          className="backdrop-blur-md bg-raised/90 border-white/25"
        />
      </div>
    </div>
  )
}
