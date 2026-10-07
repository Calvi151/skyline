import { useState } from 'react'
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

  return (
    <div className="min-h-screen bg-page font-sans">
      <Navbar />

      <main className="w-full pt-[72px] min-h-screen">
        <div className="max-w-content mx-auto px-4 md:px-6">
          <div className="flex flex-col w-full">
            {/* ─── SECTION 1: HERO ─── */}
            <section className="relative w-full rounded-ticket p-6 md:p-10 bg-gradient-to-b from-page to-sky-end overflow-visible mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-8">
                {/* Left Column: Headline */}
                <div className="lg:col-span-6 flex flex-col items-start text-left animate-fadeInUp">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tint/50 text-ink text-[11px] uppercase tracking-wider font-semibold mb-4">
                    <span className="w-2 h-2 rounded-full bg-brand-fg" />
                    <span>Sistem Reservasi Nusantara</span>
                  </div>

                  <h1 className="text-3xl md:text-5xl font-bold text-ink tracking-tight leading-tight">
                    Pesan tiket, pilih kursi, check-in online.
                  </h1>

                  <p className="text-base md:text-lg text-subtle mt-4 max-w-xl leading-relaxed">
                    Penerbangan langsung dan transit antar kota di Indonesia, dengan
                    kursi pilihan sendiri. Transparan tanpa biaya tersembunyi.
                  </p>

                  <div className="mt-6 flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-ink">
                      <span className="material-symbols-outlined text-brand-fg text-[20px] select-none">
                        verified
                      </span>
                      <span>Konfirmasi Langsung</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-ink">
                      <span className="material-symbols-outlined text-brand-fg text-[20px] select-none">
                        airline_seat_recline_extra
                      </span>
                      <span>Peta Kursi Real-Time</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Abstract Route Map with FloatingPass */}
                <div className="lg:col-span-6 animate-fadeInUp" style={{ animationDelay: '100ms' }}>
                  <RouteMap highlightedRoute={highlightedRoute} />
                </div>
              </div>

              {/* Search Panel (boarding-pass style) */}
              <div className="animate-fadeInUp" style={{ animationDelay: '200ms' }}>
                <SearchPanel />
              </div>
            </section>

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
