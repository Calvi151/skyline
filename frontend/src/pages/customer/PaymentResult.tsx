import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import { AirlineLogo } from '../../components/common/AirlineLogo'

interface BookingData {
  id: number
  booking_code: string
  total_price: number | string
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  created_at: string
  expires_at?: string
  flight?: {
    id: number
    flight_number: string
    airline?: { name: string; code: string; logo?: string | null } | null
    airplane?: { model: string; registration_number: string } | null
    status: string
    delay_minutes: number
    segments?: Array<{
      id: number
      segment_order: number
      origin: { code: string; city: string; name: string } | null
      destination: { code: string; city: string; name: string } | null
      departure_time: string
      arrival_time: string
      transit_duration_minutes?: number | null
    }>
  } | null
  passengers: Array<{
    id: number
    full_name: string
    id_number: string
    gender: string
    seat_class: string
    seat_number?: string | null
    baggage_option?: { id: number; name: string; weight_kg: number; price: number } | null
  }>
  payment?: {
    id: number
    payment_status: string
    payment_method: string
    amount: number
    paid_at?: string | null
  } | null
}

export default function PaymentResult() {
  const [searchParams] = useSearchParams()

  // Booking ID could come from ?booking=ID or ?bookingId=ID or ?order_id=PNR-timestamp
  const bookingParam = searchParams.get('booking') || searchParams.get('bookingId') || searchParams.get('order_id')

  const [booking, setBooking] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [pollCount, setPollCount] = useState(0)

  // Fetch Booking Details
  const fetchBooking = async () => {
    if (!bookingParam) {
      setErrorMsg('Parameter pesanan tidak ditemukan.')
      setLoading(false)
      return
    }

    try {
      // If bookingParam has hyphen (order_id format), extract booking code or query directly
      const cleanId = bookingParam.includes('-') ? bookingParam.split('-')[0] : bookingParam
      const res = await api.get<{ data: BookingData }>(`/bookings/${cleanId}`)
      const bData = (res?.data as any)?.data || res?.data
      if (bData && bData.id) {
        setBooking(bData)
        setErrorMsg(null)
      } else {
        setErrorMsg('Data pesanan tidak ditemukan.')
      }
    } catch (err: any) {
      console.error('Failed to fetch booking:', err)
      setErrorMsg(err?.message || 'Gagal memuat konfirmasi pembayaran.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBooking()
  }, [bookingParam])

  // Polling every 3s if status is still 'pending' (max 60 seconds / 20 attempts)
  useEffect(() => {
    if (!booking || booking.status !== 'pending' || pollCount >= 20) return

    const timer = setTimeout(() => {
      setPollCount((prev) => prev + 1)
      fetchBooking()
    }, 3000)

    return () => clearTimeout(timer)
  }, [booking?.status, pollCount])

  // Copy PNR Code Handler
  const handleCopyCode = () => {
    if (!booking?.booking_code) return
    navigator.clipboard.writeText(booking.booking_code).then(() => {
      setCopied(true)
      setToastMessage(`Kode booking ${booking.booking_code} disalin ke papan klip`)
      setShowToast(true)
      setTimeout(() => {
        setCopied(false)
      }, 3000)
      setTimeout(() => {
        setShowToast(false)
      }, 5000)
    })
  }

  // Download PDF E-Ticket handler
  const handleDownloadTicket = async () => {
    if (!booking?.id) return
    try {
      setToastMessage('Mengunduh e-tiket PDF...')
      setShowToast(true)
      const res = await api.get(`/bookings/${booking.id}/e-ticket`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `eticket-${booking.booking_code}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setToastMessage(`Berkas eticket-${booking.booking_code}.pdf berhasil diunduh.`)
      setTimeout(() => setShowToast(false), 4000)
    } catch (err: any) {
      console.error('Failed to download e-ticket:', err)
      setToastMessage('Gagal mengunduh e-tiket. Pastikan pesanan telah lunas.')
      setTimeout(() => setShowToast(false), 4000)
    }
  }

  // Format date and time helpers
  const formatRupiah = (val?: number | string | null) => {
    if (!val) return 'Rp 0'
    return `Rp ${Number(val).toLocaleString('id-ID')}`
  }

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return '--:--'
    }
  }

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '---'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return '---'
    }
  }

  const flight = booking?.flight
  const segments = flight?.segments || []
  const firstSeg = segments[0]
  const lastSeg = segments[segments.length - 1]

  // Calculate check-in open time (24 hours before departure)
  const departureDate = firstSeg?.departure_time ? new Date(firstSeg.departure_time) : null
  const checkinOpenTime = departureDate ? new Date(departureDate.getTime() - 24 * 60 * 60 * 1000) : null
  const now = new Date()
  const hoursUntilCheckin = checkinOpenTime ? Math.max(0, Math.floor((checkinOpenTime.getTime() - now.getTime()) / (1000 * 60 * 60))) : 0
  const minutesUntilCheckin = checkinOpenTime ? Math.max(0, Math.floor(((checkinOpenTime.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60))) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between">
        <Navbar />
        <main className="w-full pt-[72px] flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-subtle font-medium">Memverifikasi transaksi pembayaran...</span>
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
            <span className="material-symbols-outlined text-danger text-[48px]">error_outline</span>
            <h2 className="font-bold text-ink text-xl">Pesanan Tidak Ditemukan</h2>
            <p className="text-sm text-subtle">{errorMsg || 'Data pemesanan atau transaksi tidak valid.'}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Link
                to="/"
                className="px-5 py-2.5 rounded-control bg-brand text-white font-semibold text-xs shadow-sm hover:bg-brand-hover"
              >
                Ke Beranda
              </Link>
              <Link
                to="/bookings"
                className="px-5 py-2.5 rounded-control border border-line bg-panel hover:bg-tint text-ink font-semibold text-xs"
              >
                Pesanan Saya
              </Link>
            </div>
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
        <div className="w-full max-w-content mx-auto px-4 md:px-6 py-6 sm:py-10">
          {/* ─── Top Step Progress Indicator (Stitch B8) ─── */}
          <div className="w-full bg-raised border border-line rounded-ticket p-4 mb-8 shadow-xs">
            <div className="flex items-center justify-between">
              {/* Step 1: Data Penumpang (Done) */}
              <div className="flex items-center gap-2 text-subtle">
                <div className="w-6 h-6 rounded-full bg-tint text-brand-fg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </div>
                <span className="text-xs font-semibold text-ink hidden sm:inline">1. Data penumpang</span>
              </div>
              <div className="h-0.5 flex-1 mx-3 sm:mx-4 bg-tint"></div>

              {/* Step 2: Kursi & Bagasi (Done) */}
              <div className="flex items-center gap-2 text-subtle">
                <div className="w-6 h-6 rounded-full bg-tint text-brand-fg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </div>
                <span className="text-xs font-semibold text-ink hidden sm:inline">2. Kursi &amp; bagasi</span>
              </div>
              <div className="h-0.5 flex-1 mx-3 sm:mx-4 bg-brand-fg"></div>

              {/* Step 3: Pembayaran (Active/Done) */}
              <div className="flex items-center gap-2 text-brand-fg">
                <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">
                    {booking.status === 'paid' ? 'check' : 'schedule'}
                  </span>
                </div>
                <span className="text-xs font-bold text-brand-fg">
                  {booking.status === 'paid' ? '3. Pembayaran selesai' : '3. Menunggu pembayaran'}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Main Content Split Grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* ════ LEFT COLUMN: Confirmation & Lifecycle Timeline (7 cols) ════ */}
            <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
              {/* Header Status Block */}
              <div className="space-y-3">
                {booking.status === 'paid' && (
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span className="tracking-wide uppercase font-bold text-[11px]">
                      Transaksi berhasil diverifikasi oleh Midtrans
                    </span>
                  </div>
                )}

                {booking.status === 'pending' && (
                  <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-amber-700 dark:text-amber-400 text-xs font-medium">
                    <span className="material-symbols-outlined text-[18px]">timelapse</span>
                    <span className="tracking-wide uppercase font-bold text-[11px]">
                      Menunggu konfirmasi pembayaran otomatis
                    </span>
                  </div>
                )}

                {booking.status === 'cancelled' && (
                  <div className="inline-flex items-center gap-2 bg-danger/10 border border-danger/20 px-3 py-1 rounded-full text-danger text-xs font-medium">
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    <span className="tracking-wide uppercase font-bold text-[11px]">
                      Pesanan telah dibatalkan
                    </span>
                  </div>
                )}

                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                    {booking.status === 'paid'
                      ? 'Pembayaran berhasil'
                      : booking.status === 'pending'
                      ? 'Menunggu Konfirmasi'
                      : 'Transaksi Dibatalkan'}
                  </h1>
                  <p className="text-sm text-subtle mt-1.5 leading-relaxed max-w-xl">
                    {booking.status === 'paid'
                      ? 'E-tiket dan bukti transaksi resmi telah dikirim ke email terdaftar Anda. Simpan kode reservasi (PNR) di bawah untuk proses check-in online.'
                      : booking.status === 'pending'
                      ? 'Kami sedang menunggu konfirmasi dari sistem pembayaran. Halaman ini akan diperbarui secara otomatis ketika pembayaran berhasil diterima.'
                      : 'Batas waktu pembayaran pesanan ini telah kedaluwarsa atau transaksi dibatalkan.'}
                  </p>
                </div>
              </div>

              {/* Booking Code (PNR) Hero Card */}
              <div className="bg-raised border border-line rounded-ticket p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-subtle uppercase tracking-wider block mb-1">
                      Kode Booking (PNR)
                    </span>
                    <span className="text-3xl sm:text-4xl font-bold font-mono tracking-widest text-ink block">
                      {booking.booking_code}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-control border border-line bg-panel hover:bg-tint text-ink font-semibold text-xs transition-all shadow-2xs active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px] text-brand-fg">
                      {copied ? 'done' : 'content_copy'}
                    </span>
                    <span>{copied ? 'Tersalin' : 'Salin Kode'}</span>
                  </button>
                </div>
              </div>

              {/* Action CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                {booking.status === 'paid' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadTicket}
                      className="h-11 px-5 rounded-control bg-brand text-white font-semibold text-sm hover:bg-brand-hover flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      <span>Unduh e-tiket (PDF)</span>
                    </button>
                    <Link
                      to={`/bookings/${booking.id}`}
                      className="h-11 px-5 rounded-control border border-line bg-panel hover:bg-tint text-ink font-semibold text-sm flex items-center justify-center transition-colors"
                    >
                      Lihat detail tiket
                    </Link>
                  </>
                ) : booking.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPollCount(0)
                        fetchBooking()
                      }}
                      className="h-11 px-5 rounded-control bg-brand text-white font-semibold text-sm hover:bg-brand-hover flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      <span>Cek status sekarang</span>
                    </button>
                    <Link
                      to={`/checkout/${booking.id}`}
                      className="h-11 px-5 rounded-control border border-line bg-panel hover:bg-tint text-ink font-semibold text-sm flex items-center justify-center transition-colors"
                    >
                      Kembali ke pembayaran
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/"
                    className="h-11 px-5 rounded-control bg-brand text-white font-semibold text-sm hover:bg-brand-hover flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">search</span>
                    <span>Cari penerbangan lain</span>
                  </Link>
                )}
              </div>

              {/* Section: Langkah Berikutnya (Departure Protocol Timeline) */}
              <div className="bg-raised border border-line rounded-ticket p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="font-bold text-ink text-base">Langkah berikutnya</h2>
                  <span className="text-[11px] font-bold text-subtle uppercase tracking-wider">
                    Protokol Keberangkatan
                  </span>
                </div>

                <div className="relative pl-6 space-y-6">
                  {/* Vertical Timeline Guide Line */}
                  <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-line"></div>

                  {/* Step 1: Pembayaran diterima */}
                  <div className="relative flex items-start gap-4">
                    <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-raised flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-[13px]">check</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs">
                        <span className="font-bold text-ink text-sm">Pembayaran diterima</span>
                        <span className="text-subtle font-medium">
                          {booking.payment?.paid_at ? formatDate(booking.payment.paid_at) : 'Terverifikasi sistem'}
                        </span>
                      </div>
                      <p className="text-xs text-subtle mt-0.5">
                        Metode pembayaran {booking.payment?.payment_method || 'Midtrans'} telah divalidasi.
                      </p>
                    </div>
                  </div>

                  {/* Step 2: E-tiket tersedia */}
                  <div className="relative flex items-start gap-4">
                    <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-raised flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-[13px]">check</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs">
                        <span className="font-bold text-ink text-sm">E-tiket tersedia di akunmu</span>
                        <span className="text-brand-fg font-bold text-xs">Siap diunduh</span>
                      </div>
                      <p className="text-xs text-subtle mt-0.5">
                        Dokumen digital PDF dan barcode reservasi tersimpan otomatis di sistem.
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Check-in online */}
                  <div className="relative flex items-start gap-4">
                    <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-raised flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center ring-4 ring-tint">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs">
                        <span className="font-bold text-ink text-sm">Check-in online dibuka</span>
                        <span className="text-brand-fg font-bold text-xs">
                          {hoursUntilCheckin > 0
                            ? `dalam ${hoursUntilCheckin}j ${minutesUntilCheckin}m`
                            : 'Sudah Dibuka!'}
                        </span>
                      </div>
                      <p className="text-xs text-subtle mt-0.5">
                        {checkinOpenTime ? formatDate(checkinOpenTime.toISOString()) : '24 jam sebelum keberangkatan'}. Pengingat akan dikirim ke email Anda.
                      </p>
                    </div>
                  </div>

                  {/* Step 4: Boarding */}
                  <div className="relative flex items-start gap-4">
                    <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-raised flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-panel border border-line text-subtle flex items-center justify-center">
                        <span className="material-symbols-outlined text-[13px]">flight_takeoff</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs">
                        <span className="font-bold text-ink text-sm">
                          Boarding {firstSeg ? formatTime(firstSeg.departure_time) : '--:--'} WIB
                        </span>
                        <span className="text-subtle font-medium">Gate Siaga</span>
                      </div>
                      <p className="text-xs text-subtle mt-0.5">
                        {firstSeg?.origin?.name || 'Bandara Keberangkatan'} ({firstSeg?.origin?.code || 'CGK'}).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ════ RIGHT COLUMN: Boarding Pass Style Summary (5 cols) ════ */}
            <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
              <div className="bg-raised border border-line rounded-ticket shadow-sm overflow-hidden">
                {/* Header Bar */}
                <div className="bg-panel border-b border-line p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AirlineLogo
                      code={flight?.airline?.code}
                      name={flight?.airline?.name}
                      logo={flight?.airline?.logo}
                      size="xs"
                    />
                    <span className="font-bold text-ink text-sm">
                      {flight?.airline?.name || 'SkyBook Air'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-subtle">
                      {flight?.flight_number}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-tint text-brand-fg">
                      {booking.passengers[0]?.seat_class === 'business' ? 'Bisnis' : 'Ekonomi'}
                    </span>
                  </div>
                </div>

                {/* Route & Times */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-3xl font-bold font-sans text-ink leading-none block">
                        {firstSeg?.origin?.code || 'CGK'}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-ink mt-1 block">
                        {formatTime(firstSeg?.departure_time)}
                      </span>
                      <span className="text-xs text-subtle">
                        {firstSeg?.origin?.city || 'Jakarta'}
                      </span>
                    </div>

                    {/* Route Line Graphic */}
                    <div className="flex-1 px-4 flex flex-col items-center">
                      <span className="text-[10px] font-bold uppercase text-subtle tracking-wider mb-1">
                        {segments.length > 1 ? 'Transit' : 'Langsung'}
                      </span>
                      <div className="w-full relative flex items-center justify-center">
                        <div className="w-full h-0.5 bg-line"></div>
                        <div className="absolute bg-raised px-1 text-brand-fg">
                          <span className="material-symbols-outlined text-[16px]">flight</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-3xl font-bold font-sans text-ink leading-none block">
                        {lastSeg?.destination?.code || 'DPS'}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-ink mt-1 block">
                        {formatTime(lastSeg?.arrival_time)}
                      </span>
                      <span className="text-xs text-subtle">
                        {lastSeg?.destination?.city || 'Denpasar'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-subtle">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">calendar_today</span>
                      <span>{firstSeg?.departure_time ? formatDate(firstSeg.departure_time) : '---'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-ink">
                      <span className="material-symbols-outlined text-[15px] text-brand-fg">airplane_ticket</span>
                      <span>{flight?.airplane?.model || 'Boeing 737'}</span>
                    </span>
                  </div>
                </div>

                {/* Perforation Divider with Half-circle notches */}
                <div className="relative w-full flex items-center my-0">
                  <div className="w-4 h-6 bg-page rounded-r-full -ml-2 border-r border-line"></div>
                  <div className="flex-1 mx-2 h-0 border-t-2 border-dashed border-line"></div>
                  <div className="w-4 h-6 bg-page rounded-l-full -mr-2 border-l border-line"></div>
                </div>

                {/* Passenger Breakdown */}
                <div className="p-6 space-y-3">
                  <span className="text-[11px] font-bold text-subtle uppercase tracking-wider block">
                    Daftar Penumpang ({booking.passengers.length})
                  </span>

                  <div className="space-y-2">
                    {booking.passengers.map((p, idx) => (
                      <div key={p.id || idx} className="p-3 bg-panel rounded-control border border-line space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink">
                            {idx + 1}. {p.full_name}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-subtle">
                            {p.gender === 'male' ? 'Tuan' : 'Nyonya'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-subtle">
                          <span className="flex items-center gap-1 text-brand-fg font-semibold">
                            <span className="material-symbols-outlined text-[14px]">event_seat</span>
                            <span>Kursi {p.seat_number || 'Ditentukan saat check-in'}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">luggage</span>
                            <span>{p.baggage_option ? p.baggage_option.name : 'Kabin 7 kg'}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Recap Box */}
                <div className="p-5 bg-panel border-t border-line space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-subtle">Total Transaksi</span>
                    <span className="font-bold text-ink text-sm tabular-nums">
                      {formatRupiah(booking.total_price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>{booking.status === 'paid' ? 'Lunas' : 'Tertunda'}</span>
                    </span>
                    <span className="text-subtle font-mono text-[11px]">
                      {booking.payment?.payment_method?.toUpperCase() || 'MIDTRANS'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Support Card */}
              <div className="bg-raised border border-line rounded-ticket p-4 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-full bg-tint text-brand-fg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">support_agent</span>
                </div>
                <div className="text-left space-y-0.5 text-xs">
                  <h3 className="font-bold text-ink">Butuh bantuan reservasi?</h3>
                  <p className="text-subtle">
                    Layanan pelanggan SkyBook siap membantu Anda jika ada kendala perjalanan atau pengajuan khusus.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Floating Toast Notification ─── */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-raised border border-line text-ink px-4 py-3 rounded-control shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            className="ml-2 text-subtle hover:text-ink"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <Footer />
    </div>
  )
}
