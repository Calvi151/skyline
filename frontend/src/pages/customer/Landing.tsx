import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import RouteMap from '../../components/landing/RouteMap'
import SearchPanel from '../../components/landing/SearchPanel'
import PopularRoutes from '../../components/landing/PopularRoutes'
import HowItWorks from '../../components/landing/HowItWorks'
import SeatShowcase from '../../components/landing/SeatShowcase'
import KeyRules from '../../components/landing/KeyRules'
import FAQ from '../../components/landing/FAQ'

export default function Landing() {
  const [highlightedRoute, setHighlightedRoute] = useState<string | null>(null)
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-page font-sans">
      <Navbar />

      <main className="w-full min-h-screen">
        {/* ─── SECTION 1: FULL-WIDTH HERO BANNER (EDGE-TO-EDGE) ─── */}
        <section className="relative w-full pt-[92px] pb-12 md:pt-[108px] md:pb-16 overflow-visible">
          {/* Full-Bleed World Globe & Airplane Background (No thick blue fog) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <img
              src="/images/hero-globe-plane.jpg"
              alt="Dunia dan Pesawat SkyBook"
              className="w-full h-full object-cover object-[center_12%]"
            />
            {/* Light scrim only behind left text for readability; keeps Globe & Plane crystal clear */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/25 to-transparent" />
            {/* Smooth transition only at the very bottom edge into the page body */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-page via-page/50 to-transparent" />
          </div>

          <div className="relative z-10 max-w-content mx-auto px-4 md:px-6">
            {/* Admin Quick Action Banner */}
            {user?.role === 'admin' && (
              <div className="mb-6 p-3.5 bg-slate-900/75 backdrop-blur-md border border-white/20 rounded-control flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs md:text-sm text-white shadow-md animate-fadeInUp">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-sky-400 text-[22px]">admin_panel_settings</span>
                  <span>
                    Anda masuk sebagai <strong>Administrator ({user.name})</strong>. Kelola jadwal penerbangan, bandara, dan armada di panel admin.
                  </span>
                </div>
                <Link
                  to="/admin"
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-fg active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[16px]">dashboard</span>
                  <span>Ke Dashboard Admin</span>
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-8">
              {/* Left Column: Headline & Slogan */}
              <div className="lg:col-span-6 flex flex-col items-start text-left animate-fadeInUp">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 text-white text-[11px] uppercase tracking-wider font-semibold mb-4 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span>Sistem Reservasi Nusantara</span>
                </div>

                <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                  Pesan tiket, pilih kursi, check-in online.
                </h1>

                <p className="text-base md:text-lg text-white/90 mt-4 max-w-xl leading-relaxed font-medium drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
                  Penerbangan langsung dan transit antar kota di Indonesia, dengan
                  kursi pilihan sendiri. Transparan tanpa biaya tersembunyi.
                </p>

                <div className="mt-6 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white bg-slate-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-sm">
                    <span className="material-symbols-outlined text-sky-400 text-[20px] select-none">
                      verified
                    </span>
                    <span>Konfirmasi Langsung</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white bg-slate-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-sm">
                    <span className="material-symbols-outlined text-sky-400 text-[20px] select-none">
                      airline_seat_recline_extra
                    </span>
                    <span>Peta Kursi Real-Time</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Route Map with FloatingPass */}
              <div className="lg:col-span-6 animate-fadeInUp" style={{ animationDelay: '100ms' }}>
                <RouteMap highlightedRoute={highlightedRoute} />
              </div>
            </div>

            {/* Search Panel (boarding-pass style) */}
            <div className="relative z-20 animate-fadeInUp" style={{ animationDelay: '200ms' }}>
              <SearchPanel />
            </div>
          </div>
        </section>

        <div className="max-w-content mx-auto px-4 md:px-6">
          <div className="flex flex-col w-full">

            {/* ─── SECTION 2: RUTE POPULER ─── */}
            <PopularRoutes
              onHoverRoute={setHighlightedRoute}
            />

            {/* ─── SECTION 3: CARA KERJA ─── */}
            <HowItWorks />

            {/* ─── SECTION 4: KURSI PILIHAN SENDIRI ─── */}
            <SeatShowcase />

            {/* ─── SECTION 5: ATURAN PENTING ─── */}
            <KeyRules />

            {/* ─── SECTION 6: FAQ ─── */}
            <div id="faq">
              <FAQ />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
