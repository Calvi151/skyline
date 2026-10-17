import { Link } from 'react-router-dom'
import FloatingPass from '../common/FloatingPass'

interface BrandPanelProps {
  heading?: string
  subheading?: string
}

export default function BrandPanel({
  heading = 'Terbang Lebih Nyaman ke Penjuru Negeri',
  subheading = 'Reservasi tiket langsung, check-in online 24 jam sebelum terbang, dan e-ticket resmi terverifikasi IATA.',
}: BrandPanelProps) {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-brand-panel text-on-chrome p-8 xl:p-12 flex-col justify-between relative overflow-hidden select-none">
      {/* Top Header: Logo */}
      <div className="z-10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-control bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm shadow-sm group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-white text-[24px]">
              flight_takeoff
            </span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white font-sans">
            Sky<span className="text-sky-200">Book</span>
          </span>
        </Link>
        <span className="text-xs uppercase font-medium tracking-widest text-white/70 px-3 py-1 rounded-full border border-white/15 bg-white/5">
          Resmi & Terpercaya
        </span>
      </div>

      {/* Middle Content: Floating Pass & Brand Value */}
      <div className="z-10 my-auto py-8">
        <div className="mb-8">
          <FloatingPass
            flightNumber="SB 204"
            origin="CGK"
            destination="DPS"
            departureTime="07.40"
            arrivalTime="10.30"
            seatNumber="12A"
            zone="ZONA 1"
          />
        </div>

        <h2 className="text-2xl xl:text-3xl font-bold text-white tracking-tight leading-snug max-w-md">
          {heading}
        </h2>
        <p className="text-sm text-white/80 mt-3 leading-relaxed max-w-md font-normal">
          {subheading}
        </p>

        {/* 3 Value Pillars */}
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 max-w-md">
          <div>
            <div className="text-lg font-bold text-white tabular-nums">0%</div>
            <div className="text-[11px] text-white/70 mt-0.5">Biaya Tersembunyi</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white tabular-nums">H-24</div>
            <div className="text-[11px] text-white/70 mt-0.5">Check-in Online</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white tabular-nums">100%</div>
            <div className="text-[11px] text-white/70 mt-0.5">Garansi Kursi</div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="z-10 text-xs text-white/60 flex items-center justify-between border-t border-white/10 pt-4">
        <span>© 2026 SkyBook Indonesia</span>
        <span>Sistem Reservasi Penerbangan</span>
      </div>

      {/* Background Graphic Elements */}
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />
    </div>
  )
}
