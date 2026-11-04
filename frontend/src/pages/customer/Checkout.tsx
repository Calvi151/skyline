import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import { AirlineLogo } from '../../components/common/AirlineLogo'
import { RealQrCode } from '../../components/common/RealQrCode'
import { gateAudio } from '../../lib/audioFeedback'

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

type PaymentMethodType = 'bca_va' | 'mandiri_va' | 'bri_va' | 'qris' | 'credit_card'

export default function Checkout() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()

  const [booking, setBooking] = useState<BookingDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Checkout Step: 'select_method' (Pilih Metode) vs 'invoice' (Layar Tagihan / Instruksi Bayar)
  const [checkoutStep, setCheckoutStep] = useState<'select_method' | 'invoice'>('select_method')

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('bca_va')

  // Processing & Simulation States
  const [isProcessingSim, setIsProcessingSim] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  // Copy Feedback States
  const [copiedVa, setCopiedVa] = useState(false)
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [copiedPnr, setCopiedPnr] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Instruction Tab for VA (mbanking / atm / ibanking)
  const [instructionTab, setInstructionTab] = useState<'mbanking' | 'atm' | 'ibanking'>('mbanking')

  // Credit Card Simulation Form State
  const [cardForm, setCardForm] = useState({
    number: '4111 2222 3333 4444',
    expiry: '12/28',
    cvv: '123',
    name: '',
  })

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

          // If booking is already paid, redirect straight to result
          if (data.status === 'paid') {
            navigate(`/payment/result?booking=${data.id}`, { replace: true })
            return
          }

          // Set cardholder name default
          const primaryPaxName =
            data.passengers?.[0]?.fullName || data.passengers?.[0]?.full_name || 'PENUMPANG UTAMA'
          setCardForm((prev) => ({ ...prev, name: primaryPaxName.toUpperCase() }))

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
  }, [bookingId, navigate])

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
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }, [secondsRemaining])

  const progressPercent = useMemo(() => {
    return Math.min(100, (secondsRemaining / 3600) * 100)
  }, [secondsRemaining])

  // Helper Formatter
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

  // Realistic Virtual Account Number Generator
  const vaNumber = useMemo(() => {
    if (!booking) return '8214 0812 3456 7890'
    const idStr = String(booking.id).padStart(6, '0')
    switch (paymentMethod) {
      case 'bca_va':
        return `8214 0812 ${idStr.slice(0, 3)} ${idStr.slice(3)}`
      case 'mandiri_va':
        return `8870 8923 ${idStr.slice(0, 3)} ${idStr.slice(3)}`
      case 'bri_va':
        return `1280 0764 ${idStr.slice(0, 3)} ${idStr.slice(3)}`
      default:
        return `8214 0812 ${idStr.slice(0, 3)} ${idStr.slice(3)}`
    }
  }, [booking, paymentMethod])

  // Dynamic QRIS Payload
  const qrisPayload = useMemo(() => {
    const pnr = booking?.bookingCode || booking?.booking_code || 'SKYBOOK'
    const amt = booking?.totalPrice || booking?.total_price || 0
    return `00020101021226590014ID.LINKAJA.WWW011893600911002${booking?.id || 1}520458125303360540${amt}5802ID5917SKYBOOK NUSANTARA6007JAKARTA62070703${pnr}6304`
  }, [booking])

  // Copy Handlers
  const handleCopyVa = () => {
    const cleanVa = vaNumber.replace(/\s+/g, '')
    navigator.clipboard.writeText(cleanVa)
    setCopiedVa(true)
    setToastMessage(`Nomor Virtual Account ${cleanVa} berhasil disalin!`)
    setTimeout(() => setCopiedVa(false), 3000)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleCopyAmount = () => {
    if (!booking) return
    const amt = String(Math.round(Number(booking.totalPrice || booking.total_price || 0)))
    navigator.clipboard.writeText(amt)
    setCopiedAmount(true)
    setToastMessage(`Nominal Rp ${Number(amt).toLocaleString('id-ID')} berhasil disalin!`)
    setTimeout(() => setCopiedAmount(false), 3000)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleCopyPnr = () => {
    const pnr = booking?.bookingCode || booking?.booking_code
    if (!pnr) return
    navigator.clipboard.writeText(pnr)
    setCopiedPnr(true)
    setToastMessage(`Kode booking ${pnr} berhasil disalin!`)
    setTimeout(() => setCopiedPnr(false), 3000)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Handle proceed to invoice
  const handleProceedToInvoice = () => {
    setCheckoutStep('invoice')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle Sandbox Payment Simulation (The realistic pay execution)
  const handleSimulatePayment = async () => {
    if (!booking) return
    setIsProcessingSim(true)
    setErrorMsg(null)

    try {
      // Simulasi delay gateway 1.2 detik layaknya verifikasi bank online
      await new Promise((resolve) => setTimeout(resolve, 1200))

      await api.post('/payments/simulate', {
        booking_id: booking.id,
        payment_method: paymentMethod,
      })

      // Play joyful airport DCS chime
      gateAudio.playSuccess()

      // Redirect ke halaman bukti pembayaran resmi & e-tiket
      navigate(`/payment/result?booking=${booking.id}&payment_status=success`, { replace: true })
    } catch (err: any) {
      console.error('Payment simulation error:', err)
      setIsProcessingSim(false)
      setErrorMsg(err?.response?.data?.message || err?.message || 'Gagal memproses simulasi pembayaran.')
    }
  }

  // Handle Cancel Booking
  const handleCancelBooking = async () => {
    if (!booking) return
    setIsCancelling(true)
    try {
      await api.post(`/bookings/${booking.id}/cancel`)
      navigate('/', { replace: true })
    } catch (err: any) {
      console.error('Failed to cancel booking:', err)
      setErrorMsg('Gagal membatalkan pesanan.')
      setIsCancelling(false)
      setIsCancelModalOpen(false)
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
            <span className="text-sm text-subtle font-medium">Menyiapkan portal pembayaran...</span>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (errorMsg && !booking) {
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

  if (!booking) return null

  // If status is cancelled
  if (booking.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between">
        <Navbar />
        <main className="w-full pt-[72px] flex-1 flex items-center justify-center p-8">
          <div className="bg-raised border border-line rounded-ticket p-8 text-center max-w-md shadow-sm space-y-4">
            <span className="material-symbols-outlined text-danger text-[40px]">cancel</span>
            <h2 className="font-bold text-ink text-lg">Pemesanan Telah Dibatalkan</h2>
            <p className="text-sm text-subtle">
              Batas waktu pembayaran untuk pesanan ini telah habis atau pesanan dibatalkan. Kursi telah dikembalikan ke sistem.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand text-white font-semibold text-xs shadow-sm hover:bg-brand-hover"
            >
              Cari Penerbangan Lain
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
        {/* ─── Top Live Countdown Bar ─── */}
        <section className="bg-raised border-b border-line shadow-xs">
          <div className="max-w-content mx-auto px-4 md:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px] animate-pulse">timer</span>
                </div>
                <div>
                  <span className="text-xs text-subtle font-medium block">
                    Selesaikan Pembayaran Dalam:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tabular-nums font-mono text-amber-600 dark:text-amber-400">
                      {formattedCountdown}
                    </span>
                    <span className="text-xs text-subtle font-medium">
                      (Batas waktu transaksi aman)
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking Code Pill */}
              <div className="flex items-center gap-2 text-xs bg-panel border border-line px-3.5 py-1.5 rounded-control shrink-0 shadow-2xs">
                <span className="text-subtle">Kode Booking (PNR):</span>
                <strong className="text-brand-fg font-mono tracking-wider font-bold text-sm">
                  {booking.bookingCode || booking.booking_code}
                </strong>
                <button
                  type="button"
                  onClick={handleCopyPnr}
                  className="p-1 hover:text-brand-fg text-subtle transition-colors"
                  title="Salin PNR"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {copiedPnr ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            {/* Time progress bar */}
            <div className="w-full h-1 bg-line/60 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-amber-500 transition-all duration-1000 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </section>

        {/* ─── Step Breadcrumb ─── */}
        <div className="max-w-content mx-auto px-4 md:px-6 mt-4">
          <div className="flex items-center gap-2 text-xs text-subtle">
            <span className={checkoutStep === 'select_method' ? 'font-bold text-brand-fg' : 'text-subtle'}>
              1. Pilih Metode Pembayaran
            </span>
            <span>&rarr;</span>
            <span className={checkoutStep === 'invoice' ? 'font-bold text-brand-fg' : 'text-subtle'}>
              2. Tagihan &amp; Instruksi Transfer
            </span>
            <span>&rarr;</span>
            <span className="text-subtle opacity-60">3. E-Tiket Diterbitkan</span>
          </div>
        </div>

        {/* ─── MAIN WORKSPACE CANVAS ─── */}
        <div className="max-w-content mx-auto px-4 md:px-6 mt-5">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-danger/10 border border-danger/30 rounded-control text-danger text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAHAP 1: PEMILIHAN METODE PEMBAYARAN                                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {checkoutStep === 'select_method' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
              {/* Left Column: Flight Summary & Payment Method Choices */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Flight Summary Card */}
                <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2.5">
                      <AirlineLogo
                        code={flight?.airline?.code}
                        name={flight?.airline?.name}
                        logo={flight?.airline?.logo}
                        size="sm"
                      />
                      <div>
                        <h3 className="font-bold text-ink text-sm">
                          {flight?.airline?.name || 'SkyBook Air'} • {flight?.flightNumber || flight?.flight_number || 'KA 412'}
                        </h3>
                        <span className="text-xs text-subtle font-medium">
                          {flight?.airplane?.model || 'Boeing 737-800'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Menunggu Pembayaran
                    </span>
                  </div>

                  {/* Journey Times */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="text-left">
                      <span className="font-bold text-base tabular-nums text-ink block font-mono">
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
                      <span className="font-bold text-base tabular-nums text-ink block font-mono">
                        {formatTime(lastSeg?.arrivalTime || lastSeg?.arrival_time)}
                      </span>
                      <span className="text-xs font-semibold text-subtle">
                        {lastSeg?.destination?.code || lastSeg?.destinationAirport?.code || 'DPS'} ({lastSeg?.destination?.city || lastSeg?.destinationAirport?.city || 'Denpasar'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Passenger Breakdown Card */}
                <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-3">
                  <h3 className="font-bold text-ink text-sm sm:text-base border-b border-line pb-2.5">
                    Daftar Penumpang ({booking.passengers.length} Orang)
                  </h3>

                  <div className="space-y-2">
                    {booking.passengers.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="p-3 bg-page rounded-control border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-tint text-brand-fg font-bold flex items-center justify-center text-[11px]">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-bold text-ink text-sm block">{p.fullName || p.full_name}</span>
                            <span className="text-subtle font-mono text-[11px]">NIK: {p.idNumber || p.id_number}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#E8532F]/10 text-[#E8532F] font-bold">
                            <span className="material-symbols-outlined text-[13px]">event_seat</span>
                            <span>Kursi {p.seat?.seatNumber || p.seat_number || p.seatNumber || 'Otomatis'}</span>
                          </div>
                          {(p.baggageOption || p.baggage_option) && (
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-tint text-brand-fg font-semibold">
                              <span className="material-symbols-outlined text-[13px]">luggage</span>
                              <span>{(p.baggageOption || p.baggage_option)?.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-4">
                  <div className="border-b border-line pb-2.5">
                    <h3 className="font-bold text-ink text-sm sm:text-base">
                      Pilih Metode Pembayaran
                    </h3>
                    <p className="text-xs text-subtle mt-0.5">
                      Pilih saluran pembayaran resmi. Anda akan mendapatkan instruksi transfer dan nomor Virtual Account di langkah berikutnya.
                    </p>
                  </div>

                  <div className="space-y-2.5 text-xs sm:text-sm">
                    {/* BCA VA */}
                    <label
                      className={`p-4 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                        paymentMethod === 'bca_va'
                          ? 'bg-tint/70 border-brand-fg ring-2 ring-brand-fg/20 shadow-xs'
                          : 'bg-page border-line hover:bg-tint/20'
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
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink">BCA Virtual Account</span>
                            <span className="text-[9px] bg-brand text-white px-1.5 py-0.5 rounded font-black uppercase">
                              Populer
                            </span>
                          </div>
                          <span className="text-[11px] text-subtle block mt-0.5">
                            Verifikasi otomatis 24 jam via m-BCA, KlikBCA, atau ATM BCA
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-brand-fg text-[22px]">
                        account_balance
                      </span>
                    </label>

                    {/* Mandiri VA */}
                    <label
                      className={`p-4 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                        paymentMethod === 'mandiri_va'
                          ? 'bg-tint/70 border-brand-fg ring-2 ring-brand-fg/20 shadow-xs'
                          : 'bg-page border-line hover:bg-tint/20'
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
                        <div>
                          <span className="font-bold text-ink block">Mandiri Virtual Account</span>
                          <span className="text-[11px] text-subtle block mt-0.5">
                            Bayar instan melalui Livin' by Mandiri atau ATM Mandiri
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-brand-fg text-[22px]">
                        account_balance
                      </span>
                    </label>

                    {/* BRI VA */}
                    <label
                      className={`p-4 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                        paymentMethod === 'bri_va'
                          ? 'bg-tint/70 border-brand-fg ring-2 ring-brand-fg/20 shadow-xs'
                          : 'bg-page border-line hover:bg-tint/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payMethod"
                          checked={paymentMethod === 'bri_va'}
                          onChange={() => setPaymentMethod('bri_va')}
                          className="w-4 h-4 text-brand accent-brand cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-ink block">BRI Virtual Account (BRIVA)</span>
                          <span className="text-[11px] text-subtle block mt-0.5">
                            Bayar instan melalui aplikasi BRImo atau ATM BRI
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-brand-fg text-[22px]">
                        account_balance
                      </span>
                    </label>

                    {/* QRIS */}
                    <label
                      className={`p-4 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                        paymentMethod === 'qris'
                          ? 'bg-tint/70 border-brand-fg ring-2 ring-brand-fg/20 shadow-xs'
                          : 'bg-page border-line hover:bg-tint/20'
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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink">QRIS (Semua E-Wallet &amp; m-Banking)</span>
                            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black uppercase">
                              Instan
                            </span>
                          </div>
                          <span className="text-[11px] text-subtle block mt-0.5">
                            Scan via GoPay, OVO, Dana, ShopeePay, BCA Mobile, Livin, dll
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-brand-fg text-[22px]">
                        qr_code_2
                      </span>
                    </label>

                    {/* Credit Card */}
                    <label
                      className={`p-4 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                        paymentMethod === 'credit_card'
                          ? 'bg-tint/70 border-brand-fg ring-2 ring-brand-fg/20 shadow-xs'
                          : 'bg-page border-line hover:bg-tint/20'
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
                        <div>
                          <span className="font-bold text-ink block">Kartu Kredit / Debit Online</span>
                          <span className="text-[11px] text-subtle block mt-0.5">
                            Visa, Mastercard, JCB (Simulasi Sandbox 3D-Secure)
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-brand-fg text-[22px]">
                        credit_card
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Price Summary & CTA to Invoice */}
              <aside className="w-full lg:col-span-4 sticky top-[90px] bg-raised border border-line rounded-ticket p-5 shadow-sm space-y-4">
                <div className="border-b border-line pb-3">
                  <span className="text-xs font-bold text-subtle uppercase tracking-wider block">
                    Rincian Pembayaran
                  </span>
                  <h3 className="font-bold text-ink text-base mt-0.5">
                    {booking.passengers.length} Tiket Penerbangan
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-subtle">Tarif Dasar Tiket</span>
                    <span className="font-bold text-ink tabular-nums">
                      {formatRupiah(booking.totalPrice || booking.total_price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-subtle">
                    <span>Biaya Layanan &amp; Pajak</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Rp 0 (Termasuk)
                    </span>
                  </div>
                </div>

                <div className="h-px bg-line" />

                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-subtle uppercase block">
                      Total Tagihan
                    </span>
                    <span className="text-2xl font-black text-brand-fg tabular-nums font-mono">
                      {formatRupiah(booking.totalPrice || booking.total_price)}
                    </span>
                  </div>
                  <span className="text-[10px] text-subtle font-bold font-mono">IDR</span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToInvoice}
                  className="w-full h-12 bg-brand hover:bg-brand-hover text-white rounded-control font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <span>Lanjutkan ke Pembayaran</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>

                <div className="pt-2 border-t border-line text-center">
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(true)}
                    className="text-xs text-subtle hover:text-danger font-medium transition-colors cursor-pointer"
                  >
                    Batalkan Pemesanan Ini
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAHAP 2: LAYAR TAGIHAN & INSTRUKSI PEMBAYARAN REALISTIS (INVOICE)    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {checkoutStep === 'invoice' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
              {/* Left Column: Bank Invoice & Transfer Instructions */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Invoice Main Banner Card */}
                <div className="bg-raised border-2 border-brand/30 rounded-ticket p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand/10 text-brand-fg flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">
                          {paymentMethod === 'qris'
                            ? 'qr_code_2'
                            : paymentMethod === 'credit_card'
                            ? 'credit_card'
                            : 'account_balance'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-subtle uppercase tracking-wider block">
                          Metode Pembayaran Resmi
                        </span>
                        <h2 className="text-lg font-bold text-ink">
                          {paymentMethod === 'bca_va' && 'BCA Virtual Account'}
                          {paymentMethod === 'mandiri_va' && 'Mandiri Virtual Account'}
                          {paymentMethod === 'bri_va' && 'BRI Virtual Account (BRIVA)'}
                          {paymentMethod === 'qris' && 'QRIS Standar Pembayaran Nasional'}
                          {paymentMethod === 'credit_card' && 'Kartu Kredit / Debit Sandbox'}
                        </h2>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCheckoutStep('select_method')}
                      className="text-xs text-brand-fg hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Ubah Metode</span>
                    </button>
                  </div>

                  {/* ── CASE A: VIRTUAL ACCOUNT DETAILS ── */}
                  {(paymentMethod === 'bca_va' || paymentMethod === 'mandiri_va' || paymentMethod === 'bri_va') && (
                    <div className="space-y-4">
                      {/* Virtual Account Number Box */}
                      <div className="bg-panel p-4 sm:p-5 rounded-control border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <span className="text-xs text-subtle font-medium block">
                            Nomor Virtual Account
                          </span>
                          <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-brand-fg block my-0.5">
                            {vaNumber}
                          </span>
                          <span className="text-[11px] text-subtle">
                            Atas Nama: <strong className="text-ink">SkyBook Nusantara / PT Wings Tiket</strong>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyVa}
                          className="h-10 px-4 rounded-control bg-tint hover:bg-brand hover:text-white text-brand-fg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            {copiedVa ? 'check' : 'content_copy'}
                          </span>
                          <span>{copiedVa ? 'Tersalin' : 'Salin Nomor VA'}</span>
                        </button>
                      </div>

                      {/* Total Amount Box */}
                      <div className="bg-panel p-4 sm:p-5 rounded-control border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <span className="text-xs text-subtle font-medium block">
                            Total Jumlah yang Harus Ditransfer
                          </span>
                          <span className="text-2xl sm:text-3xl font-black font-mono text-ink block my-0.5 tabular-nums">
                            {formatRupiah(booking.totalPrice || booking.total_price)}
                          </span>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            <span>Transfer tepat sampai digit terakhir untuk verifikasi otomatis</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyAmount}
                          className="h-10 px-4 rounded-control border border-line bg-page hover:bg-tint text-ink font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            {copiedAmount ? 'check' : 'content_copy'}
                          </span>
                          <span>{copiedAmount ? 'Tersalin' : 'Salin Jumlah'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── CASE B: QRIS DETAILS ── */}
                  {paymentMethod === 'qris' && (
                    <div className="flex flex-col items-center bg-panel p-6 rounded-control border border-line space-y-4">
                      {/* Official QRIS Header */}
                      <div className="w-full max-w-xs flex items-center justify-between px-3 py-1.5 bg-slate-900 text-white rounded text-[11px] font-black tracking-widest uppercase">
                        <span>QRIS</span>
                        <span className="text-[10px] text-slate-300 font-normal">GPN NASIONAL</span>
                      </div>

                      <div className="p-4 bg-white rounded-control border-2 border-slate-200 shadow-sm inline-block">
                        <RealQrCode
                          value={qrisPayload}
                          size={200}
                          border={2}
                          alt="QRIS Payment Code"
                        />
                      </div>

                      <div className="text-center">
                        <span className="text-xs text-subtle block">Total Tagihan QRIS</span>
                        <span className="text-2xl font-black font-mono text-ink tracking-tight block">
                          {formatRupiah(booking.totalPrice || booking.total_price)}
                        </span>
                        <span className="text-[11px] text-subtle mt-1 block">
                          NMID: ID102003920194 • SkyBook Nusantara
                        </span>
                      </div>

                      <p className="text-xs text-subtle max-w-sm text-center leading-relaxed">
                        Buka aplikasi <strong>BCA Mobile, Livin, GoPay, OVO, Dana, ShopeePay</strong>, atau m-Banking pilihan Anda, lalu scan kode QR di atas.
                      </p>
                    </div>
                  )}

                  {/* ── CASE C: CREDIT CARD SANDBOX DETAILS ── */}
                  {paymentMethod === 'credit_card' && (
                    <div className="space-y-4">
                      {/* Virtual Card Graphic */}
                      <div className="w-full max-w-sm mx-auto bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-800 text-white p-5 rounded-ticket shadow-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300">
                            SkyBook Sandbox Card
                          </span>
                          <span className="text-base font-black italic">VISA</span>
                        </div>
                        <div className="w-9 h-7 bg-amber-400/80 rounded-sm" />
                        <div className="text-lg sm:text-xl font-mono tracking-widest font-bold">
                          {cardForm.number}
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="text-[8px] text-slate-400 block uppercase">Pemegang Kartu</span>
                            <span className="font-bold">{cardForm.name || 'PENUMPANG UTAMA'}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-400 block uppercase">Exp</span>
                            <span className="font-bold">{cardForm.expiry}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-panel p-4 rounded-control border border-line">
                        <div className="col-span-2">
                          <label className="text-[11px] text-subtle font-semibold block mb-1">
                            Nomor Kartu (Mode Uji Coba)
                          </label>
                          <input
                            type="text"
                            value={cardForm.number}
                            onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })}
                            className="w-full h-10 px-3 rounded bg-page border border-line font-mono font-bold text-ink"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-subtle font-semibold block mb-1">
                            Masa Berlaku (MM/YY)
                          </label>
                          <input
                            type="text"
                            value={cardForm.expiry}
                            onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })}
                            className="w-full h-10 px-3 rounded bg-page border border-line font-mono font-bold text-ink"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-subtle font-semibold block mb-1">CVV</label>
                          <input
                            type="password"
                            value={cardForm.cvv}
                            onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value })}
                            className="w-full h-10 px-3 rounded bg-page border border-line font-mono font-bold text-ink"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive Payment Instructions Accordion */}
                <div className="bg-raised border border-line rounded-ticket p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-ink text-sm sm:text-base border-b border-line pb-2.5">
                    Petunjuk Cara Pembayaran
                  </h3>

                  {/* Tabs */}
                  <div className="flex border-b border-line text-xs font-semibold gap-4">
                    <button
                      type="button"
                      onClick={() => setInstructionTab('mbanking')}
                      className={`pb-2 border-b-2 transition-all cursor-pointer ${
                        instructionTab === 'mbanking'
                          ? 'border-brand-fg text-brand-fg font-bold'
                          : 'border-transparent text-subtle hover:text-ink'
                      }`}
                    >
                      Mobile Banking (m-Banking)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstructionTab('atm')}
                      className={`pb-2 border-b-2 transition-all cursor-pointer ${
                        instructionTab === 'atm'
                          ? 'border-brand-fg text-brand-fg font-bold'
                          : 'border-transparent text-subtle hover:text-ink'
                      }`}
                    >
                      Mesin ATM
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstructionTab('ibanking')}
                      className={`pb-2 border-b-2 transition-all cursor-pointer ${
                        instructionTab === 'ibanking'
                          ? 'border-brand-fg text-brand-fg font-bold'
                          : 'border-transparent text-subtle hover:text-ink'
                      }`}
                    >
                      Internet Banking
                    </button>
                  </div>

                  {/* Instruction Content */}
                  <div className="text-xs text-ink/90 space-y-2.5 leading-relaxed">
                    {paymentMethod === 'bca_va' && instructionTab === 'mbanking' && (
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Buka aplikasi <strong>BCA mobile</strong> dan masukkan kode akses Anda.</li>
                        <li>Pilih menu <strong>m-Transfer</strong> &gt; <strong>BCA Virtual Account</strong>.</li>
                        <li>Masukkan nomor Virtual Account: <strong className="font-mono text-brand-fg">{vaNumber}</strong> lalu tekan <strong>Send</strong>.</li>
                        <li>Periksa tagihan tiket pesawat Anda: <strong className="font-mono">{formatRupiah(booking.totalPrice || booking.total_price)}</strong>.</li>
                        <li>Masukkan PIN m-BCA Anda untuk menyelesaikan pembayaran.</li>
                      </ol>
                    )}

                    {paymentMethod === 'bca_va' && instructionTab === 'atm' && (
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Masukkan kartu ATM BCA dan 6 digit PIN Anda.</li>
                        <li>Pilih menu <strong>Transaksi Lainnya</strong> &gt; <strong>Transfer</strong> &gt; <strong>Ke Rek BCA Virtual Account</strong>.</li>
                        <li>Masukkan nomor Virtual Account: <strong className="font-mono text-brand-fg">{vaNumber}</strong> lalu tekan <strong>Benar</strong>.</li>
                        <li>Pastikan nama merchant adalah <strong>SkyBook Nusantara</strong> dan nominal sesuai.</li>
                        <li>Tekan <strong>Ya</strong> untuk menyelesaikan transaksi.</li>
                      </ol>
                    )}

                    {paymentMethod === 'bca_va' && instructionTab === 'ibanking' && (
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Login ke <strong>KlikBCA Individual</strong>.</li>
                        <li>Pilih menu <strong>Transfer Dana</strong> &gt; <strong>Transfer ke BCA Virtual Account</strong>.</li>
                        <li>Masukkan nomor Virtual Account <strong className="font-mono text-brand-fg">{vaNumber}</strong>.</li>
                        <li>Verifikasi rincian tagihan menggunakan respon KeyBCA Appli 1.</li>
                      </ol>
                    )}

                    {paymentMethod === 'mandiri_va' && (
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Buka aplikasi <strong>Livin' by Mandiri</strong> dan login dengan biometrik/password.</li>
                        <li>Pilih menu <strong>Bayar</strong> &gt; cari penyedia jasa <strong>SkyBook / PT Wings Tiket</strong>.</li>
                        <li>Masukkan nomor Virtual Account: <strong className="font-mono text-brand-fg">{vaNumber}</strong>.</li>
                        <li>Periksa nominal tagihan penerbangan Anda, lalu masukkan PIN Livin'.</li>
                      </ol>
                    )}

                    {paymentMethod === 'bri_va' && (
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Buka aplikasi <strong>BRImo</strong> dan pilih menu <strong>Tagihan</strong> &gt; <strong>BRIVA</strong>.</li>
                        <li>Pilih <strong>Pembayaran Baru</strong> dan masukkan nomor BRIVA: <strong className="font-mono text-brand-fg">{vaNumber}</strong>.</li>
                        <li>Layar akan menampilkan informasi tiket pesawat SkyBook Nusantara.</li>
                        <li>Tekan <strong>Bayar</strong> dan masukkan PIN BRImo Anda.</li>
                      </ol>
                    )}

                    {paymentMethod === 'qris' && (
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Buka aplikasi mobile banking atau e-wallet (BCA mobile, Livin, GoPay, OVO, ShopeePay).</li>
                        <li>Pilih menu <strong>Scan QRIS</strong>.</li>
                        <li>Arahkan kamera ke kode QRIS di atas.</li>
                        <li>Periksa nama penerima <strong>SkyBook Nusantara</strong> dan nominalnya.</li>
                        <li>Konfirmasi dan selesaikan pembayaran.</li>
                      </ol>
                    )}

                    {paymentMethod === 'credit_card' && (
                      <p>
                        Pembayaran kartu kredit disimulasikan menggunakan pengujian 3D-Secure otomatis. Klik tombol konfirmasi simulasi di samping untuk memproses otorisasi pembayaran.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Realistic Sandbox Simulator Panel & Summary */}
              <aside className="w-full lg:col-span-4 sticky top-[90px] flex flex-col gap-5">
                {/* 🧪 THE SIMULATOR BOX */}
                <div className="bg-gradient-to-br from-panel via-raised to-tint/40 border-2 border-brand-fg/50 rounded-ticket p-5 shadow-md space-y-4">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-line">
                    <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-[18px]">science</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-brand-fg block">
                        Simulator Gateway
                      </span>
                      <h4 className="font-bold text-ink text-sm">
                        Kotak Uji Coba Pembayaran
                      </h4>
                    </div>
                  </div>

                  <p className="text-xs text-subtle leading-relaxed">
                    Di lingkungan demo ini, Anda tidak perlu mentransfer dana asli. Klik tombol di bawah untuk mensimulasikan bahwa transfer m-Banking / scan QRIS telah berhasil dilakukan.
                  </p>

                  <button
                    type="button"
                    onClick={handleSimulatePayment}
                    disabled={isProcessingSim || secondsRemaining <= 0}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-control font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessingSim ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Memverifikasi transaksi bank...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[19px]">check_circle</span>
                        <span>Simulasikan Bayar Berhasil</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 flex items-center justify-between text-xs border-t border-line">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('select_method')}
                      className="text-brand-fg hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                      <span>Ubah Metode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="text-subtle hover:text-danger font-medium transition-colors cursor-pointer"
                    >
                      Batalkan Pesanan
                    </button>
                  </div>
                </div>

                {/* Brief Order Details Box */}
                <div className="bg-raised border border-line rounded-ticket p-4 text-xs space-y-2.5 shadow-2xs">
                  <div className="flex justify-between items-center text-subtle">
                    <span>Kode Pemesanan (PNR)</span>
                    <strong className="text-ink font-mono font-bold text-xs">{booking.bookingCode || booking.booking_code}</strong>
                  </div>
                  <div className="flex justify-between items-center text-subtle">
                    <span>Status Transaksi</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold uppercase text-[10px]">
                      Pending (Menunggu)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-subtle">
                    <span>Total Pembayaran</span>
                    <strong className="text-brand-fg font-mono font-black text-sm">
                      {formatRupiah(booking.totalPrice || booking.total_price)}
                    </strong>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* ─── Cancel Booking Confirmation Dialog Modal ─── */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-raised border border-line rounded-ticket p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">warning</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">Batalkan Pemesanan?</h3>
              <p className="text-xs text-subtle mt-1.5 leading-relaxed">
                Kursi yang sudah Anda pilih akan dibebaskan kembali ke sistem untuk penumpang lain. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 h-10 rounded-control border border-line bg-panel hover:bg-tint text-ink text-xs font-semibold cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="flex-1 h-10 rounded-control bg-danger hover:bg-danger/90 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                {isCancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <aside
          aria-label="Pemberitahuan sistem"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-control shadow-2xl text-xs font-semibold animate-fadeIn"
        >
          <span className="material-symbols-outlined text-[17px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </aside>
      )}

      <Footer />
    </div>
  )
}
