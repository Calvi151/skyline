import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import RealQrCode from '../../components/common/RealQrCode'
import LandmarkWatermark from '../../components/common/LandmarkWatermark'
import { AirlineLogo } from '../../components/common/AirlineLogo'
import { getDestinationVisual, formatFlightDuration } from '../../lib/destinationMedia'

interface Passenger {
  id: number
  full_name: string
  id_number: string
  birth_date: string
  gender: string
  seat_class: string
  seat_number?: string | null
  boarding_pass_code?: string | null
  is_checked_in?: boolean
  baggage_option?: {
    id: number
    name: string
    weight_kg: number
    price: number
  } | null
}

interface Segment {
  id: number
  segment_order: number
  origin: { code: string; city: string; name: string } | null
  destination: { code: string; city: string; name: string } | null
  departure_time: string
  arrival_time: string
  transit_duration_minutes?: number | null
}

interface BookingDetail {
  id: number
  booking_code: string
  total_price: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  created_at: string
  expires_at?: string
  flight?: {
    id: number
    flight_number: string
    airline?: { name: string; code: string; logo?: string | null } | null
    airplane?: { model: string; registration_number: string } | null
    status: 'scheduled' | 'delayed' | 'cancelled'
    delay_minutes: number
    segments?: Segment[]
  } | null
  passengers: Passenger[]
  payment?: {
    id: number
    payment_status: string
    payment_method: string
    amount: number
    paid_at?: string | null
  } | null
}

interface RefundInfo {
  id: number
  status: 'pending' | 'approved' | 'rejected' | 'refunded'
  reason: string
  refund_amount: number
  kind: 'customer' | 'flight_cancelled'
  requested_at: string
}

export default function BookingTicket() {
  const { id } = useParams<{ id: string }>()

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [refundInfo, setRefundInfo] = useState<RefundInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Passenger selection tabs
  const [activePassengerIndex, setActivePassengerIndex] = useState(0)

  // Collapsed accordion state for secondary passengers
  const [expandedPassengerIndex, setExpandedPassengerIndex] = useState<number | null>(null)

  // QR zoom modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  // Refund dialog state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [selectedPaxForRefund, setSelectedPaxForRefund] = useState<number[]>([])
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  // Toast alert
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Fetch Booking Details & Refund Status
  const fetchBookingData = async () => {
    if (!id) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const [bookingRes, refundRes] = await Promise.all([
        api.get<any>(`/bookings/${id}`),
        api.get<any>(`/refunds/booking/${id}`).catch(() => ({ data: null })),
      ])

      const bData: BookingDetail | null = bookingRes?.data?.data || bookingRes?.data || null
      if (bData && bData.id) {
        setBooking(bData)

        // Default all passengers selected for refund
        if (bData.passengers) {
          setSelectedPaxForRefund(bData.passengers.map((p: any) => p.id))
        }

        // Pre-fill reason if flight is cancelled
        if (bData.flight?.status === 'cancelled') {
          setRefundReason('Penerbangan dibatalkan oleh pihak maskapai.')
        }
      } else {
        setErrorMsg('Data pesanan tidak ditemukan.')
      }

      const rData: RefundInfo | null =
        refundRes?.data?.data !== undefined ? refundRes.data.data : refundRes?.data || null
      setRefundInfo(rData)
    } catch (err: any) {
      console.error('Failed to load booking detail:', err)
      setErrorMsg(err?.message || 'Gagal memuat detail e-tiket pesanan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookingData()
  }, [id])

  // Helpers
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

  const isFlightCancelled = flight?.status === 'cancelled'
  const isDelayed = flight?.status === 'delayed' && (flight.delay_minutes || 0) > 0

  // Calculate hours remaining before departure for refund policy
  const departureDate = firstSeg?.departure_time ? new Date(firstSeg.departure_time) : null
  const now = new Date()
  const hoursUntilDeparture = departureDate ? (departureDate.getTime() - now.getTime()) / (1000 * 60 * 60) : 0
  const isRefundAllowed = isFlightCancelled || (booking?.status === 'paid' && hoursUntilDeparture >= 6)

  // Cooling-off 24 Jam Rule & Auto-Approval Detection
  const bookingCreatedAt = booking?.created_at ? new Date(booking.created_at).getTime() : 0
  const bookingAgeHours = bookingCreatedAt ? (now.getTime() - bookingCreatedAt) / (1000 * 60 * 60) : 999
  const isCoolingOff = bookingAgeHours <= 24 && hoursUntilDeparture >= 24
  const isAutoApproved = isFlightCancelled || isCoolingOff

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!booking) return
    setDownloading(true)
    try {
      setToastMessage('Mengunduh e-tiket PDF...')
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
      setToastMessage(`E-tiket ${booking.booking_code} berhasil diunduh.`)
      setTimeout(() => setToastMessage(null), 4000)
    } catch (err: any) {
      console.error('Download error:', err)
      setToastMessage('Gagal mengunduh e-tiket. Pastikan status pesanan telah lunas.')
      setTimeout(() => setToastMessage(null), 4000)
    } finally {
      setDownloading(false)
    }
  }

  // Handle Submit Refund Request
  const handleSubmitRefund = async () => {
    if (!booking) return
    if (refundReason.trim().length < 10) {
      setRefundError('Harap berikan alasan refund minimal 10 karakter.')
      return
    }

    setRefundSubmitting(true)
    setRefundError(null)

    try {
      const res = await api.post('/refunds', {
        booking_id: booking.id,
        reason: refundReason.trim(),
        passenger_ids: selectedPaxForRefund,
      })

      if (res.data) {
        setIsRefundModalOpen(false)
        const isApprovedNow = res.data.data?.status === 'approved'
        if (isApprovedNow) {
          setToastMessage(
            isFlightCancelled
              ? 'Refund penuh (100%) disetujui otomatis oleh sistem karena kendala penerbangan! Dana segera dikembalikan.'
              : 'Refund disetujui otomatis oleh sistem (Garansi Pembatalan 24 Jam)! Dana segera diproses.',
          )
        } else {
          setToastMessage('Pengajuan refund berhasil dikirim dan sedang ditinjau maskapai.')
        }
        setTimeout(() => setToastMessage(null), 5000)
        fetchBookingData()
      }
    } catch (err: any) {
      console.error('Refund submit error:', err)
      setRefundError(err?.response?.data?.message || err?.message || 'Gagal mengajukan refund.')
    } finally {
      setRefundSubmitting(false)
    }
  }

  // Refund computation
  const refundEstimation = useMemo(() => {
    if (!booking) return { base: 0, cancelFee: 0, adminFee: 0, net: 0 }
    const total = Number(booking.total_price)
    if (isFlightCancelled) {
      // 100% full refund
      return { base: total, cancelFee: 0, adminFee: 0, net: total }
    }
    const cancelFee = Math.round(total * 0.2)
    const adminFee = 25000
    const net = Math.max(0, total - cancelFee - adminFee)
    return { base: total, cancelFee, adminFee, net }
  }, [booking, isFlightCancelled])

  const activePax = booking?.passengers[activePassengerIndex] || booking?.passengers[0]
  const destVisual = useMemo(
    () => getDestinationVisual(lastSeg?.destination?.code, lastSeg?.destination?.city),
    [lastSeg?.destination?.code, lastSeg?.destination?.city],
  )
  const flightDurationStr = useMemo(
    () => formatFlightDuration(firstSeg?.departure_time, lastSeg?.arrival_time),
    [firstSeg?.departure_time, lastSeg?.arrival_time],
  )
  const boardingTimeStr = useMemo(() => {
    if (!firstSeg?.departure_time) return '07.10'
    try {
      const d = new Date(firstSeg.departure_time)
      d.setMinutes(d.getMinutes() - 30)
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return '07.10'
    }
  }, [firstSeg?.departure_time])

  const barcodeNumber = useMemo(() => {
    const rawCode = (booking?.booking_code || '412093').replace(/\D/g, '') || '412093'
    const paxId = activePax?.id || 1
    return `${rawCode}${String(paxId).padStart(3, '0')}120471039`.slice(0, 15)
  }, [booking?.booking_code, activePax?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between">
        <Navbar />
        <main className="w-full pt-[72px] flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-3 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-subtle font-medium">Memuat rincian e-tiket penerbangan...</span>
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
            <p className="text-sm text-subtle">{errorMsg || 'Data e-tiket tidak tersedia.'}</p>
            <Link
              to="/bookings"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand text-white font-semibold text-xs shadow-sm hover:bg-brand-hover"
            >
              Kembali ke Pesanan Saya
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
        <div className="w-full max-w-[1240px] mx-auto px-4 md:px-6 py-6 sm:py-8 flex flex-col gap-6">
          {/* ─── Top Action & Navigation Horizon (Stitch B10) ─── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <Link
                to="/bookings"
                className="inline-flex items-center gap-1.5 text-subtle hover:text-brand-fg text-xs font-medium transition-colors group"
              >
                <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-0.5 transition-transform">
                  arrow_back
                </span>
                <span>Kembali ke pesanan saya</span>
              </Link>

              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <span className="text-xs uppercase font-bold text-subtle tracking-wider">
                  Kode Reservasi
                </span>
                <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-ink">
                  {booking.booking_code}
                </h1>

                {/* Status Badge */}
                {booking.status === 'paid' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    <span>Dibayar</span>
                  </span>
                )}

                {booking.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">schedule</span>
                    <span>Menunggu Pembayaran</span>
                  </span>
                )}

                {booking.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-danger/10 text-danger text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                    <span>Dibatalkan</span>
                  </span>
                )}

                {booking.status === 'refunded' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-subtle/15 text-subtle text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">remove_circle_outline</span>
                    <span>Refunded</span>
                  </span>
                )}

                <span className="text-subtle text-xs hidden sm:inline">•</span>
                <span className="text-subtle text-xs">
                  Dipesan pada {formatDate(booking.created_at)}
                </span>
              </div>
            </div>

            {/* Action Cluster */}
            <div className="flex items-center gap-2.5 self-start md:self-auto">
              {booking.status === 'paid' && (
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-raised border border-line text-ink font-semibold text-xs hover:bg-tint transition-all shadow-2xs active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {downloading ? 'hourglass_top' : 'file_download'}
                  </span>
                  <span>{downloading ? 'Mengunduh...' : 'Unduh PDF'}</span>
                </button>
              )}

              {/* Refund Trigger Button */}
              {refundInfo ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 text-xs font-medium">
                  <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
                  <span>Refund {refundInfo.status === 'pending' ? 'Diproses' : refundInfo.status}</span>
                </div>
              ) : isRefundAllowed ? (
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control text-danger hover:bg-danger/10 font-semibold text-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
                  <span>Ajukan refund</span>
                </button>
              ) : (
                <span
                  className="text-xs text-subtle cursor-not-allowed opacity-60"
                  title="Batas waktu refund 6 jam sebelum penerbangan telah lewat"
                >
                  Batas refund lewat
                </span>
              )}
            </div>
          </div>

          {/* ─── Revisi Data Real: Peringatan Pembatalan Maskapai (B10) ─── */}
          {isFlightCancelled && (
            <div className="p-4 bg-danger/10 border border-danger/30 rounded-ticket text-danger text-xs sm:text-sm font-medium flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] shrink-0">cancel</span>
                <div>
                  <span className="font-bold block">Penerbangan dibatalkan maskapai</span>
                  <span>
                    Kamu berhak mengajukan refund penuh (100% tanpa potongan). Klik tombol ajukan refund di samping.
                  </span>
                </div>
              </div>
              {!refundInfo && (
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(true)}
                  className="shrink-0 px-4 py-1.5 rounded-control bg-danger text-white font-bold text-xs hover:bg-danger/90 shadow-2xs"
                >
                  Ajukan Refund Penuh
                </button>
              )}
            </div>
          )}

          {/* ─── Revisi Data Real: Peringatan Keterlambatan (B10) ─── */}
          {isDelayed && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-ticket text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0">
                schedule
              </span>
              <span>
                <strong>Tertunda {flight?.delay_minutes} menit.</strong> Perkiraan jam keberangkatan diperbarui mengikuti operasional maskapai.
              </span>
            </div>
          )}

          {/* ─── Main Workspace Split (8 cols ticket deck + 4 cols policy) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
            {/* ════ LEFT COLUMN: Ticket Deck & Passenger Cards (8 cols) ════ */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Passenger Switcher Tabs */}
              {booking.passengers.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <div className="flex items-center gap-1.5 bg-panel border border-line p-1 rounded-control">
                    {booking.passengers.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActivePassengerIndex(idx)}
                        className={`px-3 py-1.5 rounded-control text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activePassengerIndex === idx
                            ? 'bg-raised text-brand-fg shadow-2xs border border-line'
                            : 'text-subtle hover:text-ink'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            activePassengerIndex === idx ? 'bg-brand-fg' : 'bg-subtle/40'
                          }`}
                        ></span>
                        <span>
                          {p.full_name} ({p.seat_number || 'Seat ?'})
                        </span>
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-subtle hidden sm:inline ml-2">
                    Pilih penumpang untuk melihat rincian tiket pass
                  </span>
                </div>
              )}

              {/* ─── Landscape Ticket Pass Card (Figma Blue Frame + Dribbble Arc + Vector Barcode) ─── */}
              {activePax && (
                <div className="w-full p-2.5 sm:p-3 rounded-[22px] bg-[#1E60B5] dark:bg-[#154687] shadow-xl relative transition-all duration-300">
                  <div className="w-full bg-raised rounded-[16px] relative overflow-hidden text-ink">
                    <div className="flex flex-col md:flex-row relative">
                      {/* Ticket Body (Left Section: Main Flight Ticket) */}
                      <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
                        {/* 1. AIRLINE STRIP & AIRCRAFT (Clean Figma Header with Airline Logo) */}
                        <div className="px-5 sm:px-7 py-3.5 sm:py-4 border-b border-line flex items-center justify-between gap-3 bg-panel/30">
                          <div className="flex items-center gap-3">
                            <AirlineLogo
                              code={flight?.airline?.code}
                              name={flight?.airline?.name}
                              logo={flight?.airline?.logo}
                              size="md"
                            />
                            <div>
                              <h2 className="font-bold text-ink text-sm sm:text-base leading-tight">
                                {flight?.airline?.name || 'Kenari Air'}
                              </h2>
                              <p className="text-xs text-subtle mt-0.5">
                                Penerbangan {flight?.flight_number || 'KA 412'} • {flight?.airplane?.model || 'Boeing 737-800'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="px-2.5 py-0.5 rounded-full bg-tint text-brand-fg text-[10px] font-extrabold uppercase tracking-wider inline-block">
                              {activePax.seat_class === 'business' ? 'KELAS BISNIS' : 'KELAS EKONOMI'}
                            </span>
                            <span className="text-xs font-bold text-subtle block mt-1 tabular-nums">
                              {formatDate(firstSeg?.departure_time)}
                            </span>
                          </div>
                        </div>

                        {/* 2. ROUTE & TIMING SHOWCASE + DRIBBBLE CURVED FLIGHT ARC + LANDMARK WATERMARK */}
                        <div className="relative px-5 sm:px-7 py-6 overflow-hidden">
                          <LandmarkWatermark
                            type={destVisual.landmarkType}
                            className="absolute inset-x-3 bottom-0 h-28 w-[calc(100%-1.5rem)] text-brand-fg opacity-[0.045] dark:opacity-[0.07] pointer-events-none"
                          />

                          <div className="relative z-10 grid grid-cols-12 items-center gap-2">
                            {/* Origin */}
                            <div className="col-span-4 flex flex-col">
                              <span className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight leading-none">
                                {firstSeg?.origin?.code || 'CGK'}
                              </span>
                              <span className="text-sm sm:text-base font-extrabold tabular-nums text-brand-fg mt-1.5">
                                {formatTime(firstSeg?.departure_time)} WIB
                              </span>
                              <span className="text-xs font-bold text-ink truncate mt-0.5">
                                {firstSeg?.origin?.city || 'Jakarta'}
                              </span>
                              <span className="text-[10px] text-subtle font-medium truncate">
                                {firstSeg?.origin?.name || "Soekarno-Hatta Int'l (T3)"}
                              </span>
                            </div>

                            {/* Curved Track Indicator (Dribbble Arc) */}
                            <div className="col-span-4 flex flex-col items-center px-1">
                              <span className="px-2.5 py-0.5 rounded-full bg-tint/80 border border-brand-fg/20 text-[10px] font-bold text-brand-fg mb-1 tabular-nums">
                                {segments.length > 1 ? `${flightDurationStr} • Transit` : `${flightDurationStr} • Langsung`}
                              </span>
                              <div className="relative w-full max-w-[175px] h-9 flex items-center justify-center">
                                <svg viewBox="0 0 180 38" className="w-full h-full overflow-visible" aria-hidden="true">
                                  <path
                                    d="M 10 24 Q 90 -2 170 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                    className="text-brand-fg"
                                  />
                                  <circle cx="10" cy="24" r="3.5" className="fill-brand-fg" />
                                  <circle cx="170" cy="24" r="3.5" className="fill-signal" />
                                </svg>
                                <div className="absolute -top-0.5 w-7 h-7 rounded-full bg-tint border border-brand-fg/30 text-brand-fg flex items-center justify-center">
                                  <span className="material-symbols-outlined text-[15px] rotate-90">
                                    flight
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>{isDelayed ? 'Tertunda' : 'Non-Stop Flight'}</span>
                              </span>
                            </div>

                            {/* Destination */}
                            <div className="col-span-4 flex flex-col text-right items-end">
                              <span className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight leading-none">
                                {lastSeg?.destination?.code || 'DPS'}
                              </span>
                              <span className="text-sm sm:text-base font-extrabold tabular-nums text-brand-fg mt-1.5">
                                {formatTime(lastSeg?.arrival_time)}{' '}
                                {lastSeg?.destination?.code === 'DPS' ? 'WITA' : destVisual.timezoneLabel}
                              </span>
                              <span className="text-xs font-bold text-ink truncate mt-0.5">
                                {lastSeg?.destination?.city || 'Denpasar Bali'}
                              </span>
                              <span className="text-[10px] text-subtle font-medium truncate max-w-full">
                                {lastSeg?.destination?.name || "Ngurah Rai Int'l (T1)"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. TABULAR GRID OF PASSENGER DETAILS (6 Columns matching Figma) */}
                        <div className="px-5 sm:px-7 pb-5 pt-3.5 border-t border-line bg-panel/30 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 text-left">
                          {/* Col 1: Nama Penumpang */}
                          <div className="flex flex-col p-2 rounded-control bg-raised border border-line/60">
                            <span className="text-[9px] font-bold uppercase text-subtle tracking-wider">
                              Nama Penumpang
                            </span>
                            <span className="text-xs font-bold text-ink truncate mt-0.5">
                              {activePax.full_name}
                            </span>
                            <span className="text-[10px] text-subtle truncate">
                              Dewasa (ADT)
                            </span>
                          </div>

                          {/* Col 2: Kursi (Seat) */}
                          <div className="flex flex-col p-2 rounded-control bg-signal/[0.06] border border-signal/30">
                            <span className="text-[9px] font-bold uppercase text-subtle tracking-wider">
                              Kursi (Seat)
                            </span>
                            <span className="text-base font-black text-signal leading-tight mt-0.5 tabular-nums">
                              {activePax.seat_number || 'Check-in'}
                            </span>
                            <span className="text-[10px] text-subtle truncate">
                              {activePax.seat_number ? 'Jendela • Depan' : 'Saat check-in'}
                            </span>
                          </div>

                          {/* Col 3: Pintu Masuk (Gate) */}
                          <div className="flex flex-col p-2 rounded-control bg-raised border border-line/60">
                            <span className="text-[9px] font-bold uppercase text-subtle tracking-wider">
                              Pintu (Gate)
                            </span>
                            <span className="text-xs font-extrabold text-ink mt-0.5">
                              Menunggu RDS
                            </span>
                            <span className="text-[10px] text-subtle truncate">
                              Layar Terminal 3
                            </span>
                          </div>

                          {/* Col 4: Waktu Boarding */}
                          <div className="flex flex-col p-2 rounded-control bg-raised border border-line/60">
                            <span className="text-[9px] font-bold uppercase text-subtle tracking-wider">
                              Waktu Boarding
                            </span>
                            <span className="text-xs font-extrabold text-brand-fg mt-0.5 tabular-nums">
                              {boardingTimeStr} WIB
                            </span>
                            <span className="text-[10px] text-subtle truncate">
                              30m sblm terbang
                            </span>
                          </div>

                          {/* Col 5: Zona Antrean */}
                          <div className="flex flex-col p-2 rounded-control bg-raised border border-line/60">
                            <span className="text-[9px] font-bold uppercase text-subtle tracking-wider">
                              Zona Antrean
                            </span>
                            <span className="text-xs font-bold text-ink mt-0.5">
                              ZONA 2
                            </span>
                            <span className="text-[10px] text-subtle truncate">
                              Prioritas Reguler
                            </span>
                          </div>

                          {/* Col 6: Jatah Bagasi */}
                          <div className="flex flex-col p-2 rounded-control bg-raised border border-line/60">
                            <span className="text-[9px] font-bold uppercase text-subtle tracking-wider">
                              Jatah Bagasi
                            </span>
                            <span className="text-xs font-bold text-ink mt-0.5">
                              Kabin 7 kg
                            </span>
                            <span className="text-[10px] text-subtle truncate">
                              {activePax.baggage_option ? activePax.baggage_option.name : 'Bagasi 20 kg'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Perforation Divider with Half-Circle Cutouts */}
                      <div className="relative hidden md:flex flex-col items-center justify-between w-6 bg-raised">
                        <div className="w-6 h-6 -mt-3.5 bg-[#1E60B5] dark:bg-[#154687] rounded-full z-20"></div>
                        <div className="w-0.5 h-full border-r-2 border-dashed border-line my-2"></div>
                        <div className="w-6 h-6 -mb-3.5 bg-[#1E60B5] dark:bg-[#154687] rounded-full z-20"></div>
                      </div>

                      {/* Mobile Dashed Line */}
                      <div className="md:hidden flex items-center justify-between h-6 w-full relative bg-raised">
                        <div className="w-5 h-5 -ml-2.5 bg-[#1E60B5] dark:bg-[#154687] rounded-full z-20"></div>
                        <div className="w-full h-0.5 border-b-2 border-dashed border-line"></div>
                        <div className="w-5 h-5 -mr-2.5 bg-[#1E60B5] dark:bg-[#154687] rounded-full z-20"></div>
                      </div>

                      {/* Right Stub: Boarding Gate Scanner & Stub */}
                      <div className="w-full md:w-[245px] bg-panel/75 p-5 sm:p-6 flex flex-col items-center justify-between text-center relative group">
                        <div className="w-full flex items-center justify-between pb-2.5 mb-2 border-b border-line text-left">
                          <div>
                            <span className="font-bold text-subtle uppercase text-[9px] tracking-widest block">
                              PASS STUB
                            </span>
                            <span className="font-extrabold text-ink text-xs">
                              {flight?.flight_number} • {(flight?.airline?.name || 'SkyBook').split(' ')[0]}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-tint text-brand-fg font-extrabold uppercase text-[9px]">
                            {activePax.seat_class === 'business' ? 'BUSINESS' : 'ECONOMY'}
                          </span>
                        </div>

                        {/* Vector QR Matrix Pattern */}
                        <div
                          onClick={() => setIsQrModalOpen(true)}
                          className="relative w-32 h-32 bg-white p-2 rounded-control border border-line flex items-center justify-center cursor-pointer group/qr transition-transform hover:scale-105 duration-200 shadow-2xs"
                          title="Klik untuk perbesar QR code"
                        >
                          <RealQrCode
                            value={activePax.boarding_pass_code || booking.booking_code}
                            size={116}
                            alt="E-Ticket QR Code"
                          />

                          {/* Tooltip Overlay */}
                          <div className="absolute inset-0 bg-black/75 rounded-control opacity-0 group-hover/qr:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-2">
                            <span className="material-symbols-outlined text-[20px]">zoom_in</span>
                            <span className="text-[10px] font-semibold">Perbesar QR</span>
                          </div>
                        </div>

                        <div className="mt-2.5 flex flex-col gap-0.5 w-full">
                          <span className="text-[9px] uppercase font-bold tracking-widest text-subtle">
                            BOARDING REFERENCE
                          </span>
                          <span className="text-xs font-mono font-extrabold tracking-wider text-ink">
                            {activePax.boarding_pass_code || `BP-${booking.booking_code}-${activePax.id}`}
                          </span>
                          <span className="text-[10px] text-subtle">
                            Kode PNR: <strong className="text-ink font-mono">{booking.booking_code}</strong>
                          </span>
                          <p className="text-[9px] text-subtle leading-tight mt-1">
                            Tingkatkan kecerahan layar ke tingkat maksimal saat pemindaian mesin gerbang.
                          </p>
                          {/* Mini 1D Barcode with numeric code */}
                          <div className="w-full pt-2 mt-1.5 border-t border-line flex flex-col items-center">
                            <div className="w-full h-5 flex items-stretch justify-center gap-[2px] opacity-80">
                              <span className="w-[2px] bg-ink" />
                              <span className="w-[1px] bg-ink" />
                              <span className="w-[3px] bg-ink" />
                              <span className="w-[1px] bg-ink" />
                              <span className="w-[2px] bg-ink" />
                              <span className="w-[4px] bg-ink" />
                              <span className="w-[1px] bg-ink" />
                              <span className="w-[2px] bg-ink" />
                              <span className="w-[3px] bg-ink" />
                              <span className="w-[1px] bg-ink" />
                              <span className="w-[2px] bg-ink" />
                              <span className="w-[1px] bg-ink" />
                              <span className="w-[3px] bg-ink" />
                              <span className="w-[2px] bg-ink" />
                            </div>
                            <span className="text-[9px] font-mono tracking-widest text-subtle mt-0.5">
                              {barcodeNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Multi-Passenger Accordion Rows ─── */}
              {booking.passengers.length > 1 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-subtle">
                    Penumpang Lainnya Dalam Reservasi Ini
                  </h3>

                  {booking.passengers.map((p, idx) => {
                    if (idx === activePassengerIndex) return null
                    const isExpanded = expandedPassengerIndex === idx

                    return (
                      <div
                        key={p.id}
                        className="bg-raised border border-line rounded-ticket overflow-hidden transition-all duration-200"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedPassengerIndex(isExpanded ? null : idx)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-tint/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-tint text-brand-fg flex items-center justify-center font-bold text-xs">
                              {idx + 1}
                            </div>
                            <div>
                              <span className="font-bold text-ink text-sm block">{p.full_name}</span>
                              <span className="text-xs text-subtle">
                                Kursi {p.seat_number || 'Belum dipilih'} •{' '}
                                {p.baggage_option ? p.baggage_option.name : 'Kabin 7 kg'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-brand-fg">
                              {isExpanded ? 'Tutup' : 'Lihat Tiket'}
                            </span>
                            <span className="material-symbols-outlined text-[18px] text-subtle">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 bg-panel border-t border-line text-xs space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-subtle">Identitas (NIK/Paspor):</span>
                              <span className="font-mono font-bold text-ink">{p.id_number}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-subtle">Kelas Penerbangan:</span>
                              <span className="capitalize font-semibold text-ink">{p.seat_class}</span>
                            </div>
                            <div className="pt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePassengerIndex(idx)
                                  setExpandedPassengerIndex(null)
                                }}
                                className="px-3.5 py-1.5 rounded-control bg-brand text-white font-semibold text-xs hover:bg-brand-hover shadow-2xs"
                              >
                                Tampilkan Sebagai Tiket Utama
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─── Flight Advisory & Airport Instructions Bento Box (Stitch B10) ─── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-raised border border-line rounded-ticket flex items-start gap-3 shadow-2xs">
                  <span className="material-symbols-outlined text-brand-fg text-[22px]">luggage</span>
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-ink">Drop Bagasi</span>
                    <span className="text-subtle mt-0.5">
                      Konter {flight?.airline?.name || 'Maskapai'}, terminal keberangkatan dibuka 2 jam sebelum terbang.
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-raised border border-line rounded-ticket flex items-start gap-3 shadow-2xs">
                  <span className="material-symbols-outlined text-brand-fg text-[22px]">airline_seat_recline_extra</span>
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-ink">Ganti Kursi</span>
                    <span className="text-subtle mt-0.5">
                      Perubahan kursi tersedia hingga proses check-in online ditutup (3 jam sebelum berangkat).
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-raised border border-line rounded-ticket flex items-start gap-3 shadow-2xs">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[22px]">
                    verified
                  </span>
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-ink">Jaminan Perlindungan</span>
                    <span className="text-subtle mt-0.5">
                      Asuransi perjalanan aktif melindungi keterlambatan dan kehilangan bagasi.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ════ RIGHT COLUMN: Refund Policy & Customer Support (4 cols) ════ */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Refund Timeline & Policy Tracker Card */}
              <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-[11px] font-bold text-subtle uppercase tracking-wider">
                    Jendela Pembatalan
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isFlightCancelled || isCoolingOff
                      ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                      : 'bg-tint text-brand-fg'
                  }`}>
                    {isFlightCancelled ? 'Refund Penuh (Auto)' : isCoolingOff ? 'Auto-Refund 24 Jam' : 'Fleksibel'}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-ink text-sm sm:text-base">
                    Batas Pengajuan Refund
                  </h3>
                  <p className="text-xs text-subtle mt-1 leading-relaxed">
                    {isFlightCancelled
                      ? 'Penerbangan dibatalkan oleh maskapai. Kamu berhak mengajukan refund penuh kapan saja.'
                      : isCoolingOff
                      ? 'Pesanan dibuat kurang dari 24 jam yang lalu. Pembatalan disetujui otomatis oleh sistem.'
                      : 'Refund mandiri dapat diajukan hingga 6 jam sebelum waktu keberangkatan resmi.'}
                  </p>
                </div>

                {/* Dynamic Timeline Visual */}
                {!isFlightCancelled && (
                  <div className="bg-panel border border-line p-3.5 rounded-control space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-brand-fg flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">schedule</span>
                        <span>
                          {hoursUntilDeparture > 0
                            ? `Sisa ${Math.max(0, Math.floor(hoursUntilDeparture - 6))} jam`
                            : 'Waktu habis'}
                        </span>
                      </span>
                      <span className="text-subtle text-[11px]">Batas: H-6 Jam</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-line h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-fg h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, ((hoursUntilDeparture - 6) / 48) * 100),
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Policy Breakdown */}
                <div className="space-y-2 text-xs text-subtle pt-1">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-brand-fg text-[16px] mt-0.5 shrink-0">
                      check_circle
                    </span>
                    <span>
                      {isFlightCancelled
                        ? '100% total biaya tiket dikembalikan tanpa potongan.'
                        : 'Biaya tiket dasar dapat dikembalikan dengan pemotongan pembatalan maskapai.'}
                    </span>
                  </div>
                  {!isFlightCancelled && (
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-subtle text-[16px] mt-0.5 shrink-0">
                        info
                      </span>
                      <span>Potongan administrasi resmi maskapai sebesar 20% + Rp 25.000 per pesanan.</span>
                    </div>
                  )}
                  {isCoolingOff && (
                    <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">
                        bolt
                      </span>
                      <span>Garansi Pembatalan 24 Jam Aktif: pengajuan refund disetujui otomatis oleh sistem.</span>
                    </div>
                  )}
                </div>

                {isRefundAllowed && !refundInfo && (
                  <button
                    type="button"
                    onClick={() => setIsRefundModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-control bg-panel border border-line hover:bg-tint text-ink font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
                    <span>Mulai Ajukan Refund</span>
                  </button>
                )}
              </div>

              {/* Need Help Support Card */}
              <div className="bg-raised border border-line rounded-ticket p-5 flex items-start gap-3.5 shadow-2xs">
                <div className="w-9 h-9 rounded-full bg-tint text-brand-fg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">support_agent</span>
                </div>
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-ink">Pusat Layanan SkyBook</h4>
                  <p className="text-subtle leading-relaxed">
                    Butuh bantuan darurat terkait jadwal atau kebutuhan khusus? Tim aviasi kami siaga 24/7.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Refund Modal Dialog (Stitch B10) ─── */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-raised border border-line rounded-ticket shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-line bg-panel">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-danger text-[22px]">currency_exchange</span>
                <h3 className="font-bold text-ink text-base">Ajukan Refund Penerbangan</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="w-8 h-8 rounded-full bg-raised hover:bg-tint flex items-center justify-center text-subtle hover:text-ink transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {refundError && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded-control text-danger text-xs font-medium">
                  {refundError}
                </div>
              )}

              {/* Auto-Approval Guarantee Alert */}
              {isAutoApproved && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-control flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[22px] shrink-0">
                    bolt
                  </span>
                  <div className="space-y-0.5 text-xs">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 block">
                      {isFlightCancelled
                        ? 'Pengembalian Dana Penuh 100% (Auto-Approved Instan)'
                        : 'Garansi Pembatalan 24 Jam (Auto-Approved Instan)'}
                    </span>
                    <p className="text-emerald-600/90 dark:text-emerald-400/90 text-[11px] leading-relaxed">
                      {isFlightCancelled
                        ? 'Penerbangan mengalami pembatalan maskapai. Pengajuan refund akan langsung disetujui otomatis oleh sistem tanpa menunggu persetujuan manual.'
                        : 'Pesanan Anda dibuat kurang dari 24 jam yang lalu. Pembatalan tiket akan langsung disetujui otomatis oleh sistem tanpa antre verifikasi manual admin.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Passenger Choice */}
              <div className="space-y-2">
                <label className="font-bold text-ink uppercase text-[11px] block">
                  Pilih Penumpang Yang Ingin Di-Refund
                </label>
                <div className="space-y-2">
                  {booking.passengers.map((p) => {
                    const isChecked = selectedPaxForRefund.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-control border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-tint/50 border-brand-fg/40'
                            : 'bg-panel border-line hover:bg-tint/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPaxForRefund((prev) => [...prev, p.id])
                              } else {
                                setSelectedPaxForRefund((prev) => prev.filter((id) => id !== p.id))
                              }
                            }}
                            className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-ink block">{p.full_name}</span>
                            <span className="text-subtle font-mono text-[11px]">
                              Kursi {p.seat_number || 'Otomatis'} • {p.id_number}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-brand-fg">
                          {isChecked ? 'Terpilih' : 'Tetap Terbang'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Step 2: Reason Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="reasonText" className="font-bold text-ink uppercase text-[11px]">
                    Alasan Pembatalan
                  </label>
                  <span className="text-[11px] text-subtle">
                    {refundReason.length} / 300 karakter
                  </span>
                </div>
                <textarea
                  id="reasonText"
                  rows={3}
                  maxLength={300}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Jelaskan alasan pembatalan tiket (minimal 10 karakter)..."
                  className="w-full p-3 rounded-control bg-panel border border-line text-ink placeholder:text-subtle text-xs focus:outline-none focus:ring-2 focus:ring-brand-fg/30 transition-all resize-none"
                />
              </div>

              {/* Step 3: Breakdown Computation */}
              <div className="p-4 rounded-control bg-panel border border-line space-y-2">
                <span className="font-bold text-ink uppercase text-[11px] block mb-1">
                  Rincian Estimasi Pengembalian Dana
                </span>
                <div className="flex justify-between text-subtle">
                  <span>Total Harga Tiket</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatRupiah(refundEstimation.base)}
                  </span>
                </div>
                {!isFlightCancelled && (
                  <>
                    <div className="flex justify-between text-subtle">
                      <span>Biaya Pembatalan Maskapai (20%)</span>
                      <span className="font-semibold text-danger tabular-nums">
                        - {formatRupiah(refundEstimation.cancelFee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-subtle">
                      <span>Biaya Administrasi Sistem</span>
                      <span className="font-semibold text-danger tabular-nums">
                        - {formatRupiah(refundEstimation.adminFee)}
                      </span>
                    </div>
                  </>
                )}

                <div className="h-px bg-line my-1.5" />

                <div className="flex justify-between items-baseline pt-1">
                  <div>
                    <span className="font-bold text-ink block">Estimasi Pengembalian</span>
                    <span className="text-[10px] text-subtle">Kredit ke sumber pembayaran asal</span>
                  </div>
                  <span className="text-base font-bold text-brand-fg tabular-nums">
                    {formatRupiah(refundEstimation.net)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-subtle leading-relaxed">
                Pengembalian dana akan diproses ke rekening atau e-wallet asal dalam waktu 3-5 hari kerja setelah disetujui pihak maskapai.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-panel border-t border-line flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="px-4 py-2 rounded-control font-semibold text-xs text-subtle hover:text-ink hover:bg-tint transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={refundSubmitting || selectedPaxForRefund.length === 0}
                onClick={handleSubmitRefund}
                className="px-5 py-2 rounded-control bg-danger text-white font-semibold text-xs hover:bg-danger/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {refundSubmitting && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>
                  {refundSubmitting
                    ? 'Mengirim...'
                    : isAutoApproved
                    ? 'Batalkan & Refund Instan'
                    : 'Kirim Pengajuan'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── High Contrast QR Zoom Modal (Stitch B10) ─── */}
      {isQrModalOpen && (
        <div
          onClick={() => setIsQrModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white p-6 rounded-ticket shadow-2xl text-center space-y-4 text-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pindai Boarding Pass
              </span>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="w-56 h-56 mx-auto p-4 bg-white border border-slate-200 rounded-control flex items-center justify-center shadow-sm">
              <RealQrCode
                value={activePax?.boarding_pass_code || booking.booking_code}
                size={200}
                border={2}
                alt="Enlarged E-Ticket QR Code"
              />
            </div>

            <div className="space-y-1">
              <span className="text-base font-mono font-bold tracking-widest text-slate-900 block">
                {booking.booking_code}
              </span>
              <p className="text-xs text-slate-500">
                Naikkan kecerahan layar saat memindai di gerbang masuk atau boarding.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Floating Toast Notification ─── */}
      {toastMessage && (
        <aside className="fixed bottom-6 right-6 z-40 max-w-md bg-raised text-ink border border-line p-4 rounded-ticket shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-tint flex items-center justify-center text-brand-fg shrink-0">
              <span className="material-symbols-outlined text-[18px]">info</span>
            </div>
            <p className="text-xs font-medium text-ink">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-subtle hover:text-ink p-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </aside>
      )}

      <Footer />
    </div>
  )
}
