import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'

interface BookingDetailData {
  id: number
  bookingCode?: string
  booking_code?: string
  totalPrice?: string | number
  total_price?: string | number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  createdAt?: string
  created_at?: string
  expires_at?: string
  flight?: any
  flightSchedule?: any
  passengers: Array<{
    id: number
    fullName?: string
    full_name?: string
    idNumber?: string
    id_number?: string
    gender?: string
    seatClass?: string
    seat_class?: string
    seatNumber?: string | null
    seat_number?: string | null
    seat?: { seatNumber: string } | null
    baggageOption?: { name: string; weightKg?: number; weight_kg?: number; price: string | number } | null
    baggage_option?: { name: string; weightKg?: number; weight_kg?: number; price: string | number } | null
  }>
  payment?: any
}

export default function Checkout() {
  const { bookingId } = useParams<{ bookingId: string }>()

  const [booking, setBooking] = useState<BookingDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<'bca_va' | 'mandiri_va' | 'qris' | 'credit_card'>('bca_va')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)

  // Countdown timer state (seconds remaining)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600) // 1 hour default

  // Fetch Booking by ID
  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) return
      setLoading(true)
      setErrorMsg(null)
      try {
        const res = await api.get<any>(`/bookings/${bookingId}`)
        const data = res?.data?.data || res?.data
        if (data && (data.booking_code || data.bookingCode || data.id)) {
          setBooking(data)

          // Calculate remaining time from createdAt (1 hour window)
          const createdTime = new Date(data.created_at || data.createdAt || Date.now()).getTime()
          const expiresTime = data.expires_at ? new Date(data.expires_at).getTime() : createdTime + 60 * 60 * 1000
          const now = Date.now()
          const remaining = Math.max(0, Math.floor((expiresTime - now) / 1000))
          setSecondsRemaining(remaining)
        } else {
          setErrorMsg('Data pesanan tidak ditemukan.')
        }
      } catch (err: any) {
        console.error('Failed to load booking:', err)
        setErrorMsg(err?.message || 'Gagal memuat detail pemesanan.')
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [bookingId])

  // Countdown timer tick
  useEffect(() => {
    if (secondsRemaining <= 0) return
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [secondsRemaining])

  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(secondsRemaining / 60)
    const secs = secondsRemaining % 60
    return `${String(mins).padStart(2, '0')}.${String(secs).padStart(2, '0')}`
  }, [secondsRemaining])

  const progressPercent = useMemo(() => {
    return Math.min(100, (secondsRemaining / 3600) * 100)
  }, [secondsRemaining])

  // Handle Pay CTA
  const handlePay = async () => {
    if (!booking) return
    setIsProcessing(true)
    try {
      await api.post('/payments/simulate', {
        booking_id: booking.id,
        payment_method: paymentMethod,
      })
      setIsProcessing(false)
      setIsSuccessModalOpen(true)
    } catch (err: any) {
      console.error('Payment error:', err)
      setIsProcessing(false)
    }
  }

  const formatRupiah = (val?: string | number | null) => {
    if (!val) return 'Rp 0'
    return `Rp ${Number(val).toLocaleString('id-ID')}`
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return '--:--'
    }
  }

  const flight = booking?.flight || booking?.flightSchedule
  const firstSeg = flight?.segments?.[0]
  const lastSeg = flight?.segments?.[flight?.segments?.length - 1]

  if (loading) {
    return (
      <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between">
        <Navbar />
        <main className="w-full pt-[72px] flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-3 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-subtle font-medium">Memuat ringkasan pembayaran...</span>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (errorMsg || !booking) {
    return (
      <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between">
        <Navbar />
        <main className="w-full pt-[72px] flex-1 flex items-center justify-center p-8">
          <div className="bg-raised border border-line rounded-ticket p-8 text-center max-w-md shadow-sm space-y-4">
            <span className="material-symbols-outlined text-danger text-[40px]">error_outline</span>
            <h2 className="font-bold text-ink text-lg">Pemesanan Tidak Ditemukan</h2>
            <p className="text-sm text-subtle">{errorMsg || 'Jadwal atau kode booking tidak valid.'}</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand text-white font-semibold text-xs shadow-sm hover:bg-brand-hover"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between antialiased">
      <Navbar />

      <main className="w-full pt-[72px] flex-1 pb-20">
        {/* ─── Top Countdown Banner (Stitch B7) ─── */}
        <section className="bg-raised border-b border-line shadow-xs">
          <div className="max-w-content mx-auto px-4 md:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">timer</span>
                </div>
                <div>
                  <span className="text-xs text-subtle font-medium block">
                    Batas Waktu Pembayaran
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tabular-nums text-ink">
                      {formattedCountdown}
                    </span>
                    <span className="text-xs text-subtle">
                      (Selesaikan sebelum waktu berakhir)
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking Code Pill */}
              <div className="flex items-center gap-2 text-xs bg-panel border border-line px-3 py-1.5 rounded-control shrink-0">
                <span className="text-subtle">Kode Pemesanan (PNR):</span>
                <strong className="text-brand-fg font-mono tracking-wider font-bold text-sm">
                  {booking.bookingCode || booking.booking_code}
                </strong>
              </div>
            </div>

            {/* Time progress bar */}
            <div className="w-full h-1 bg-line/60 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-brand-fg transition-all duration-1000 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </section>

        {/* ─── Main Content Canvas ─── */}
        <div className="max-w-content mx-auto px-4 md:px-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ════ LEFT COLUMN: Payment Methods & Passenger Breakdown (760px) ════ */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Flight Summary Card */}
              <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-control bg-tint text-brand-fg flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">flight</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-ink text-sm">
                        {flight?.airline?.name || 'SkyBook Air'} • {flight?.flightNumber || flight?.flight_number || 'KA 412'}
                      </h3>
                      <span className="text-xs text-subtle font-medium">
                        {flight?.airplane?.model || 'Boeing 737'}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-tint text-brand-fg uppercase">
                    Terverifikasi
                  </span>
                </div>

                {/* Journey Times */}
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="text-left">
                    <span className="font-bold text-base tabular-nums text-ink block">
                      {formatTime(firstSeg?.departureTime || firstSeg?.departure_time)}
                    </span>
                    <span className="text-xs font-semibold text-subtle">
                      {firstSeg?.origin?.code || firstSeg?.originAirport?.code || 'CGK'} ({firstSeg?.origin?.city || firstSeg?.originAirport?.city || 'Jakarta'})
                    </span>
                  </div>

                  <div className="flex flex-col items-center px-2">
                    <span className="text-[10px] text-subtle mb-0.5">
                      {(flight?.flightType || flight?.flight_type) === 'transit' ? 'Transit' : 'Langsung'}
                    </span>
                    <div className="w-24 sm:w-36 h-0.5 bg-line relative flex items-center justify-center">
                      <span className="material-symbols-outlined text-[14px] text-brand-fg absolute">
                        flight
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-base tabular-nums text-ink block">
                      {formatTime(lastSeg?.arrivalTime || lastSeg?.arrival_time)}
                    </span>
                    <span className="text-xs font-semibold text-subtle">
                      {lastSeg?.destination?.code || lastSeg?.destinationAirport?.code || 'DPS'} ({lastSeg?.destination?.city || lastSeg?.destinationAirport?.city || 'Denpasar'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Passenger & Assigned Seats Card */}
              <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-3">
                <h3 className="font-bold text-ink text-sm sm:text-base border-b border-line pb-2.5">
                  Daftar Penumpang & Alokasi Kursi
                </h3>

                <div className="space-y-2">
                  {booking.passengers.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-3.5 bg-page rounded-control border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-tint text-brand-fg font-bold flex items-center justify-center text-[11px]">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-ink text-sm block">{p.fullName || p.full_name}</span>
                          <span className="text-subtle font-mono">NIK: {p.idNumber || p.id_number}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#E8532F]/10 text-[#E8532F] font-bold">
                          <span className="material-symbols-outlined text-[14px]">event_seat</span>
                          <span>Kursi {p.seat?.seatNumber || p.seat_number || p.seatNumber || 'Otomatis'}</span>
                        </div>

                        {(p.baggageOption || p.baggage_option) && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-tint text-brand-fg font-semibold">
                            <span className="material-symbols-outlined text-[14px]">luggage</span>
                            <span>{(p.baggageOption || p.baggage_option)?.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector (Stitch B7) */}
              <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-4">
                <h3 className="font-bold text-ink text-sm sm:text-base border-b border-line pb-2.5">
                  Metode Pembayaran
                </h3>

                <div className="space-y-2.5 text-xs sm:text-sm">
                  {/* BCA Virtual Account */}
                  <label
                    className={`p-3.5 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                      paymentMethod === 'bca_va'
                        ? 'bg-tint border-brand-fg ring-2 ring-brand-fg/20'
                        : 'bg-page border-line hover:bg-tint/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === 'bca_va'}
                        onChange={() => setPaymentMethod('bca_va')}
                        className="w-4 h-4 text-brand accent-brand cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">BCA Virtual Account</span>
                        <span className="text-[10px] bg-line text-subtle px-1.5 py-0.5 rounded font-bold uppercase">
                          Otomatis
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-brand-fg text-[20px]">
                      account_balance
                    </span>
                  </label>

                  {/* Mandiri Virtual Account */}
                  <label
                    className={`p-3.5 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                      paymentMethod === 'mandiri_va'
                        ? 'bg-tint border-brand-fg ring-2 ring-brand-fg/20'
                        : 'bg-page border-line hover:bg-tint/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === 'mandiri_va'}
                        onChange={() => setPaymentMethod('mandiri_va')}
                        className="w-4 h-4 text-brand accent-brand cursor-pointer"
                      />
                      <span className="font-bold text-ink">Mandiri Virtual Account</span>
                    </div>
                    <span className="material-symbols-outlined text-brand-fg text-[20px]">
                      account_balance
                    </span>
                  </label>

                  {/* QRIS */}
                  <label
                    className={`p-3.5 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                      paymentMethod === 'qris'
                        ? 'bg-tint border-brand-fg ring-2 ring-brand-fg/20'
                        : 'bg-page border-line hover:bg-tint/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === 'qris'}
                        onChange={() => setPaymentMethod('qris')}
                        className="w-4 h-4 text-brand accent-brand cursor-pointer"
                      />
                      <div>
                        <span className="font-bold text-ink block">QRIS (GoPay, OVO, ShopeePay)</span>
                        <span className="text-[11px] text-subtle">Pindai kode QR untuk pembayaran instan</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-brand-fg text-[20px]">
                      qr_code_2
                    </span>
                  </label>

                  {/* Credit Card */}
                  <label
                    className={`p-3.5 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                      paymentMethod === 'credit_card'
                        ? 'bg-tint border-brand-fg ring-2 ring-brand-fg/20'
                        : 'bg-page border-line hover:bg-tint/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === 'credit_card'}
                        onChange={() => setPaymentMethod('credit_card')}
                        className="w-4 h-4 text-brand accent-brand cursor-pointer"
                      />
                      <span className="font-bold text-ink">Kartu Kredit / Debit Online</span>
                    </div>
                    <span className="material-symbols-outlined text-brand-fg text-[20px]">
                      credit_card
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* ════ RIGHT COLUMN: Price Breakdown & Pay CTA (360px) ════ */}
            <aside className="w-full lg:col-span-4 sticky top-[90px] bg-raised border border-line rounded-ticket p-5 shadow-sm space-y-4">
              <div className="border-b border-line pb-3">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider block">
                  Rincian Pembayaran
                </span>
                <h3 className="font-bold text-ink text-base mt-0.5">
                  {booking.passengers.length} Tiket Penumpang
                </h3>
              </div>

              {/* Price Rows */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-subtle">Total Tagihan Tiket</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatRupiah(booking.totalPrice || booking.total_price)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-subtle">
                  <span>Pajak Penerbangan & Asuransi</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Termasuk (Bebas Biaya)
                  </span>
                </div>
              </div>

              <div className="h-px bg-line" />

              {/* Total Amount */}
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-bold text-subtle uppercase block">
                    Total Yang Harus Dibayar
                  </span>
                  <span className="text-xl font-bold text-brand-fg tabular-nums">
                    {formatRupiah(booking.totalPrice || booking.total_price)}
                  </span>
                </div>
                <span className="text-[10px] text-subtle">IDR</span>
              </div>

              {/* Pay Now Button */}
              <button
                type="button"
                onClick={handlePay}
                disabled={isProcessing || secondsRemaining <= 0}
                className="w-full h-12 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses pembayaran...</span>
                  </>
                ) : (
                  <>
                    <span>Bayar sekarang</span>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-subtle text-center leading-relaxed">
                Dengan melanjutkan, Anda menyetujui Ketentuan Pembelian dan Kebijakan Privasi
                SkyBook Nusantara.
              </p>
            </aside>
          </div>
        </div>
      </main>

      {/* ─── Success Payment Modal ─── */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-raised border border-line rounded-ticket p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Pembayaran Berhasil!</h3>
              <p className="text-xs text-subtle mt-1">
                E-tiket penerbangan Anda telah diterbitkan dengan kode PNR:
              </p>
              <div className="mt-2 text-2xl font-bold font-mono text-brand-fg tracking-widest bg-tint py-1 rounded">
                {booking.bookingCode || booking.booking_code}
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                to={`/check-in?bookingCode=${booking.bookingCode || booking.booking_code}`}
                className="h-11 px-5 rounded-control bg-brand text-white font-semibold text-sm hover:bg-brand-hover flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">airline_seat_recline_extra</span>
                <span>Check-in Online</span>
              </Link>
              <Link
                to="/"
                className="h-11 px-5 rounded-control border border-line bg-panel hover:bg-tint text-ink font-semibold text-sm flex items-center justify-center"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
