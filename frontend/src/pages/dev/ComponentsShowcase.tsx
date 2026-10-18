import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import AirportCode from '../../components/common/AirportCode'
import RouteLine from '../../components/common/RouteLine'
import TicketPanel from '../../components/common/TicketPanel'
import StatusChip from '../../components/common/StatusChip'
import PriceText from '../../components/common/PriceText'
import TimeText from '../../components/common/TimeText'
import DurationText from '../../components/common/DurationText'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import FloatingPass from '../../components/common/FloatingPass'
import PasswordChecklist from '../../components/auth/PasswordChecklist'
import EmailVerificationBanner from '../../components/auth/EmailVerificationBanner'

export default function ComponentsShowcase() {
  return (
    <div className="min-h-screen bg-page flex flex-col font-sans text-ink">
      <Navbar />

      <main className="flex-1 pt-[88px] pb-16 px-4 md:px-6">
        <div className="max-w-[1200px] mx-auto space-y-12">
          {/* Header */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-fg">
              SkyBook Design System
            </span>
            <h1 className="text-3xl font-bold text-ink mt-1">Komponen Dasar (Phase 1)</h1>
            <p className="text-sm text-subtle mt-1">
              Showcase token semantik, format angka tabular, dan komponen reusable.
            </p>
          </div>

          {/* Email Verification Banner */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink">1. EmailVerificationBanner</h2>
            <div className="border border-line rounded-control overflow-hidden">
              <EmailVerificationBanner email="penumpang@skybook.id" />
            </div>
          </section>

          {/* AirportCode & RouteLine */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-ink">2. AirportCode & RouteLine</h2>
            <div className="bg-panel border border-line rounded-ticket p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <AirportCode code="CGK" city="Jakarta" name="Soekarno-Hatta Int'l" size="lg" />
              <div className="flex-1 w-full max-w-xs">
                <RouteLine duration="1j 50m" flightType="direct" />
              </div>
              <AirportCode code="DPS" city="Denpasar" name="Ngurah Rai Int'l" size="lg" />
            </div>

            <div className="bg-panel border border-line rounded-ticket p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <AirportCode code="SUB" city="Surabaya" name="Juanda" size="md" />
              <div className="flex-1 w-full max-w-xs">
                <RouteLine duration="4j 30m" flightType="transit" transitStops={['CGK']} />
              </div>
              <AirportCode code="KNO" city="Medan" name="Kualanamu Int'l" size="md" />
            </div>
          </section>

          {/* TicketPanel with Perforations */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-ink">3. TicketPanel (Notch & Perforasi)</h2>
            <TicketPanel orientation="horizontal" notchPositionPercent={70}>
              <div className="p-6 grid grid-cols-1 md:grid-cols-10 gap-6 items-center">
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-fg text-sm">Garuda Indonesia</span>
                    <span className="text-xs text-subtle">• GA 402 • Boeing 737-800</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <TimeText time="07.40" />
                      <div className="text-xs text-subtle">CGK</div>
                    </div>
                    <div className="w-28">
                      <RouteLine duration="1j 50m" flightType="direct" />
                    </div>
                    <div>
                      <TimeText time="10.30" timezone="WITA" />
                      <div className="text-xs text-subtle">DPS</div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 flex flex-col items-end justify-center md:pl-4">
                  <span className="text-xs text-subtle">Mulai dari</span>
                  <PriceText amount={1286000} size="lg" className="text-brand-fg" />
                  <button className="mt-3 w-full h-10 px-4 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold">
                    Pilih Kursi
                  </button>
                </div>
              </div>
            </TicketPanel>
          </section>

          {/* StatusChip & PriceText & TimeText */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-ink">4. StatusChip & Tabular Numerals</h2>
            <div className="bg-panel border border-line rounded-ticket p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusChip status="pending" />
                <StatusChip status="paid" />
                <StatusChip status="cancelled" />
                <StatusChip status="refunded" />
                <StatusChip status="checked_in" />
                <StatusChip status="boarded" />
                <StatusChip status="no_show" />
              </div>

              <div className="pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-subtle block">Format Harga:</span>
                  <PriceText amount={2450000} size="xl" />
                </div>
                <div>
                  <span className="text-xs text-subtle block">Format Waktu:</span>
                  <TimeText time="14.25" timezone="WIB" className="text-xl" />
                </div>
                <div>
                  <span className="text-xs text-subtle block">Format Durasi:</span>
                  <DurationText minutes={170} className="text-xl text-ink font-bold" />
                </div>
              </div>
            </div>
          </section>

          {/* Password Checklist */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-ink">5. PasswordChecklist</h2>
            <div className="bg-panel border border-line rounded-ticket p-6 max-w-md">
              <PasswordChecklist password="Pass123" />
            </div>
          </section>

          {/* FloatingPass & States */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-ink">6. FloatingPass & State Placeholders</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="p-4 bg-brand-panel rounded-ticket flex items-center justify-center min-h-[300px]">
                <FloatingPass
                  flightNumber="SB 101"
                  origin="CGK"
                  destination="DPS"
                  departureTime="07.40"
                  arrivalTime="10.30"
                  seatNumber="14C"
                />
              </div>

              <EmptyState
                icon="flight_takeoff"
                title="Belum Ada Tiket"
                description="Anda belum memiliki pemesanan tiket penerbangan aktif."
                action={{
                  label: 'Cari Penerbangan',
                  onClick: () => {},
                  icon: 'search',
                }}
              />

              <ErrorState
                title="Gagal Memuat Jadwal"
                message="Terjadi gangguan koneksi ke server. Silakan coba beberapa saat lagi."
                onRetry={() => alert('Coba lagi ditekan')}
              />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
