import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ThemeToggle from '../../components/common/ThemeToggle'
import { api } from '../../lib/api'

export default function CheckEmail() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || 'nama@email.com'

  const [cooldown, setCooldown] = useState(45)
  const [isResending, setIsResending] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['14A', '15C'])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return
    setIsResending(true)

    try {
      await api.post('/auth/resend-verification', { email })
    } catch (err) {
      console.warn('Resend verification API fallback:', err)
    } finally {
      setIsResending(false)
      setCooldown(45)
      setShowToast(true)
    }
  }

  const toggleSeat = (seatId: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatId)
        ? prev.filter((s) => s !== seatId)
        : [...prev, seatId]
    )
  }

  return (
    <div className="min-h-screen w-full bg-page text-ink flex flex-col lg:flex-row font-sans">
      {/* ─── LEFT HALF: BRAND PANEL (Pinned to Screen, Zero Gaps) ─── */}
      <div className="hidden lg:flex lg:w-1/2 lg:fixed lg:inset-y-0 lg:left-0 bg-brand-panel text-on-chrome p-6 xl:p-10 flex-col justify-between relative overflow-hidden select-none z-10">
        {/* Top Header: Logo & Back Link */}
        <div className="z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-control bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm shadow-sm group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-white text-[22px]">
                flight_takeoff
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight text-white font-sans">Sky</span>
              <span className="text-xl font-bold tracking-tight text-sky-200 font-sans">Book</span>
              <span className="ml-1 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-white/20 text-white">
                WINGS
              </span>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors py-1.5 px-3 rounded-control hover:bg-white/10 border border-transparent hover:border-white/20"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Kembali ke beranda</span>
          </Link>
        </div>

        {/* Center Graphic: Cabin Seat Map Showcase (Interactive Stitch B3 Design) */}
        <div className="z-10 my-auto py-2 mb-6 relative w-full max-w-[460px] mx-auto">
          {/* Header & Tagline */}
          <div className="mb-3 text-left">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-semibold tracking-wide text-sky-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>Pilihan Kabin Fleksibel</span>
            </span>
            <h2 className="text-lg xl:text-xl font-bold tracking-tight text-white mt-1.5 leading-snug">
              Pilih kursi sendiri sebelum terbang.
            </h2>
            <p className="text-xs text-white/75 mt-1 leading-relaxed">
              Buat akun, verifikasi email, lalu pesan tiket ke seluruh Indonesia.
            </p>
          </div>

          {/* Graphic Container with Peeking Secondary Ticket & Seat Map Card */}
          <div className="relative pt-4 pb-2">
            {/* Peeking Background Ticket */}
            <div className="absolute -bottom-2 right-1 w-64 h-36 bg-white/10 backdrop-blur-md rounded-ticket p-3.5 border border-white/20 transform rotate-6 translate-x-3 translate-y-3 pointer-events-none z-0 hidden sm:block">
              <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">
                  BOARDING TICKET
                </span>
                <span className="text-[10px] font-bold text-sky-200 tabular-nums">SB-882</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[8px] text-white/60">Rute</p>
                  <p className="text-xs font-bold text-white tracking-tight">CGK → DPS</p>
                </div>
                <div className="w-10 h-10 bg-white/15 border border-white/30 rounded flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">qr_code</span>
                </div>
              </div>
            </div>

            {/* Main Interactive Seat Map Card */}
            <div className="relative z-10 bg-panel text-ink rounded-ticket p-4 sm:p-5 shadow-2xl border border-line transform -rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="flex items-center justify-between pb-2.5 border-b border-line">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-fg" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                    PETA KURSI KABIN (ROW 14-16)
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tint text-brand-fg border border-line/60">
                  Boeing 737-800
                </span>
              </div>

              {/* Column Identifiers */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-subtle my-2.5 px-1">
                <div>A</div>
                <div>B</div>
                <div>C</div>
                <div className="text-[8px] text-muted flex items-center justify-center font-medium tracking-tighter">
                  LORONG
                </div>
                <div>D</div>
                <div>E</div>
                <div>F</div>
              </div>

              {/* Seat Matrix Grid */}
              <div className="space-y-1.5">
                {/* Row 14 */}
                <div className="grid grid-cols-7 gap-1.5 items-center text-center">
                  <button
                    type="button"
                    onClick={() => toggleSeat('14A')}
                    className={`h-8 rounded-control flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                      selectedSeats.includes('14A')
                        ? 'bg-signal text-white ring-2 ring-signal/30 scale-105'
                        : 'bg-panel border border-line text-ink hover:border-brand-fg'
                    }`}
                  >
                    {selectedSeats.includes('14A') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '14A'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSeat('14B')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all ${
                      selectedSeats.includes('14B')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg'
                    }`}
                  >
                    14B
                  </button>

                  <div className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed">
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  <span className="text-[10px] font-bold text-subtle">14</span>

                  <div className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed">
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSeat('14E')}
                    className="h-8 rounded-control bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg flex items-center justify-center text-[11px] font-medium"
                  >
                    14E
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSeat('14F')}
                    className="h-8 rounded-control bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg flex items-center justify-center text-[11px] font-medium"
                  >
                    14F
                  </button>
                </div>

                {/* Row 15 */}
                <div className="grid grid-cols-7 gap-1.5 items-center text-center relative">
                  <button
                    type="button"
                    onClick={() => toggleSeat('15A')}
                    className="h-8 rounded-control bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg flex items-center justify-center text-[11px] font-medium"
                  >
                    15A
                  </button>

                  <div className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed">
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSeat('15C')}
                    className={`h-8 rounded-control flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                      selectedSeats.includes('15C')
                        ? 'bg-signal text-white ring-2 ring-signal/30 scale-105'
                        : 'bg-panel border border-line text-ink hover:border-brand-fg'
                    }`}
                  >
                    {selectedSeats.includes('15C') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '15C'
                    )}
                  </button>

                  <span className="text-[10px] font-bold text-subtle">15</span>

                  <button
                    type="button"
                    onClick={() => toggleSeat('15D')}
                    className="h-8 rounded-control bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg flex items-center justify-center text-[11px] font-medium"
                  >
                    15D
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSeat('15E')}
                    className="h-8 rounded-control bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg flex items-center justify-center text-[11px] font-medium"
                  >
                    15E
                  </button>

                  <div className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed">
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-signal inline-block" />
                  <span className="font-bold text-ink">{selectedSeats.length} kursi dipilih</span>
                </div>
                <span className="font-semibold text-brand-fg tabular-nums">
                  + Rp 90.000 ruang kaki lebih luas
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Rows */}
        <div className="z-10 border-t border-white/20 pt-4">
          <div className="space-y-1.5 text-xs xl:text-sm text-white/90">
            <div className="flex items-center gap-2.5 p-1">
              <span className="material-symbols-outlined text-[15px]">airline_seat_recline_extra</span>
              <span>Peta kursi interaktif langsung dari sistem reservasi</span>
            </div>
            <div className="flex items-center gap-2.5 p-1 border-t border-white/10 pt-1.5">
              <span className="material-symbols-outlined text-[15px]">mark_email_read</span>
              <span>Verifikasi email cepat dalam 24 jam</span>
            </div>
            <div className="flex items-center gap-2.5 p-1 border-t border-white/10 pt-1.5">
              <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
              <span>Penyimpanan e-tiket otomatis &amp; check-in instan</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-[10px] text-white/60">
            <span>&copy; 2026 SkyBook Indonesia</span>
            <span>Standar Keselamatan IATA</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT HALF: FORM PANEL ─── */}
      <div className="w-full lg:w-1/2 lg:ml-[50%] min-h-screen bg-page flex flex-col justify-between p-6 sm:p-8 lg:p-10 relative overflow-y-auto">
        {/* Top Header */}
        <div className="w-full flex justify-between items-center mb-6">
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-fg text-[24px]">flight_takeoff</span>
            <span className="text-xl font-bold tracking-tight text-ink font-sans">
              Sky<span className="text-brand-fg">Book</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>

        {/* Centered Check Email Card */}
        <div className="w-full max-w-[480px] mx-auto my-auto py-2">
          {/* Step Indicator */}
          <div className="mb-4 flex items-center justify-between text-xs font-semibold text-subtle uppercase tracking-wider">
            <span>Langkah 2 dari 2 • Aktivasi Akun</span>
          </div>

          <div className="bg-panel rounded-ticket border border-line p-6 sm:p-8 shadow-sm">
            {/* Envelope Icon Header */}
            <div className="w-12 h-12 rounded-full bg-tint flex items-center justify-center text-brand-fg mb-5">
              <span className="material-symbols-outlined text-[26px]">mark_email_unread</span>
            </div>

            {/* Headline */}
            <h1 className="text-2xl font-bold text-ink tracking-tight font-sans mb-2">
              Cek email kamu
            </h1>

            {/* Description */}
            <p className="text-sm text-subtle leading-relaxed mb-4">
              Kami telah mengirim tautan verifikasi ke{' '}
              <span className="font-semibold text-ink">{email}</span>. Tautan berlaku selama 24 jam.
            </p>

            {/* Spam Note */}
            <div className="flex items-start gap-2 p-3 rounded-control bg-page border border-line text-xs text-subtle mb-6">
              <span className="material-symbols-outlined text-[16px] text-brand-fg shrink-0 mt-0.5">
                info
              </span>
              <span>Tidak menemukan email? Cek folder spam atau promosi di akun email kamu.</span>
            </div>

            {/* 3-Step Guided Sequence */}
            <div className="bg-page/70 border border-line/60 rounded-control p-4 mb-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-tint text-brand-fg flex items-center justify-center shrink-0 text-xs font-bold">
                  1
                </div>
                <p className="text-xs text-ink font-medium pt-0.5">
                  Buka kotak masuk email dari SkyBook
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-tint text-brand-fg flex items-center justify-center shrink-0 text-xs font-bold">
                  2
                </div>
                <p className="text-xs text-ink font-medium pt-0.5">
                  Klik tombol <strong>Verifikasi email</strong> di dalam pesan
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-tint text-brand-fg flex items-center justify-center shrink-0 text-xs font-bold">
                  3
                </div>
                <p className="text-xs text-ink font-medium pt-0.5">
                  Kembali ke tab ini atau login untuk mulai memesan tiket
                </p>
              </div>
            </div>

            {/* Resend Button with Cooldown & Progress Bar */}
            <div className="space-y-2 mb-6">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || isResending}
                className={`w-full h-11 rounded-control text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  cooldown > 0
                    ? 'bg-page text-subtle cursor-not-allowed border border-line'
                    : 'bg-brand hover:bg-brand-hover text-white active:scale-[0.99] shadow-sm'
                }`}
              >
                {isResending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mengirim ulang...</span>
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    <span>Kirim ulang email ({cooldown}s)</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    <span>Kirim ulang email sekarang</span>
                  </>
                )}
              </button>

              {/* Cooldown progress track */}
              {cooldown > 0 && (
                <div className="w-full h-1 bg-page rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-fg transition-all duration-1000 ease-linear"
                    style={{ width: `${(cooldown / 45) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Alternate Actions */}
            <div className="text-center pt-2 border-t border-line">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-fg hover:underline"
              >
                <span>Lanjut cari tiket penerbangan</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </Link>
              <p className="text-[11px] text-subtle mt-1">
                Kamu tetap dapat menelusuri jadwal dan rute sebelum verifikasi
              </p>
            </div>
          </div>

          {/* Toast Notification Alert */}
          {showToast && (
            <div className="mt-4 bg-panel border border-line rounded-control p-3.5 shadow-md flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[15px]">check</span>
                </div>
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-ink truncate">Email verifikasi baru berhasil dikirim</p>
                  <p className="text-subtle text-[11px] truncate">Terkirim ke {email} • Baru saja</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToast(false)}
                className="text-subtle hover:text-ink p-1 rounded transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="w-full flex justify-between items-center text-xs text-subtle pt-4 border-t border-line/60">
          <span>Portal Reservasi Maskapai Nusantara</span>
          <span>v2.4 - Sistem Terverifikasi IATA</span>
        </div>
      </div>
    </div>
  )
}
