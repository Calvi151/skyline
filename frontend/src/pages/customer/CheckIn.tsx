import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface FlightSegment {
  id: number
  segment_order: number
  origin: { code: string; city: string; name: string } | null
  destination: { code: string; city: string; name: string } | null
  departure_time: string
  arrival_time: string
  transit_duration_minutes?: number | null
}

interface FlightData {
  id: number
  flight_number: string
  airline: { name: string; code?: string; logo?: string | null } | null
  airplane: { model?: string; registration_number?: string } | null
  status: string
  delay_minutes: number
  segments: FlightSegment[]
}

interface PassengerData {
  id: number
  full_name: string
  id_number: string
  birth_date: string
  gender: string
  seat_class: string
  seat_id?: number | null
  seat_number?: string | null
  is_checked_in?: boolean
  boarding_pass_code?: string | null
  checked_in_at?: string | null
}

interface SeatItem {
  id: number
  seat_number: string
  seat_class: string
  is_available: boolean
}

interface BookingCheckInDetail {
  booking_id: number
  booking_code: string
  status: string
  flight: FlightData
  passengers: PassengerData[]
  available_seats: SeatItem[]
}

interface UserBookingSummary {
  id: number
  booking_code: string
  status: string
  created_at: string | null
  passenger_count: number
  checked_in_count: number
  is_fully_checked_in: boolean
  flight: {
    id: number
    flight_number: string
    airline: { name: string; code?: string; logo?: string | null } | null
    airplane?: { model?: string } | null
    status: string
    delay_minutes: number
    departure_time: string | null
    arrival_time: string | null
    origin: { code: string; city: string; name: string } | null
    destination: { code: string; city: string; name: string } | null
  } | null
}

export default function CheckIn() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()

  const pnrQuery = searchParams.get('bookingCode') || searchParams.get('pnr') || searchParams.get('booking_code')
  const bookingIdQuery = searchParams.get('bookingId') || searchParams.get('booking_id')

  // Search input state
  const [searchPnr, setSearchPnr] = useState(pnrQuery || '')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // User's eligible bookings list
  const [userBookings, setUserBookings] = useState<UserBookingSummary[]>([])
  const [loadingUserBookings, setLoadingUserBookings] = useState(false)

  // Selected Booking Detail
  const [bookingDetail, setBookingDetail] = useState<BookingCheckInDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Passenger seat edits (passengerId -> seatId)
  const [selectedSeats, setSelectedSeats] = useState<Record<number, { seatId: number; seatNumber: string }>>({})
  const [editingPassengerId, setEditingPassengerId] = useState<number | null>(null)
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null)

  // Checkin submission state
  const [isAgreed, setIsAgreed] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [issuedBoardingPasses, setIssuedBoardingPasses] = useState<any[] | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Fetch eligible bookings if user is logged in
  useEffect(() => {
    if (!user) {
      setUserBookings([])
      return
    }

    const fetchEligible = async () => {
      setLoadingUserBookings(true)
      try {
        const res = await api.get('/checkin/eligible')
        const data = res.data?.data || []
        setUserBookings(data)

        // If no PNR was in URL, and user has exactly 1 booking, load it automatically
        if (!pnrQuery && !bookingIdQuery && data.length === 1) {
          loadBooking(data[0].booking_code)
        }
      } catch (err) {
        console.error('Failed to load eligible bookings:', err)
      } finally {
        setLoadingUserBookings(false)
      }
    }

    fetchEligible()
  }, [user])

  // Load booking by PNR or ID
  const loadBooking = async (code?: string, id?: string | number) => {
    const targetCode = code || searchPnr.trim().toUpperCase()
    const targetId = id || bookingIdQuery

    if (!targetCode && !targetId) {
      setSearchError('Silakan masukkan Kode Booking (PNR)')
      return
    }

    setLoadingDetail(true)
    setIsSearching(true)
    setSearchError(null)

    try {
      const res = await api.get('/checkin/lookup', {
        params: {
          booking_code: targetCode || undefined,
          booking_id: targetId || undefined,
        },
      })

      const data: BookingCheckInDetail = res.data?.data
      setBookingDetail(data)

      // Initialize selectedSeats from passenger current seats
      const initialSeats: Record<number, { seatId: number; seatNumber: string }> = {}
      data.passengers.forEach((p) => {
        if (p.seat_id && p.seat_number) {
          initialSeats[p.id] = { seatId: p.seat_id, seatNumber: p.seat_number }
        }
      })
      setSelectedSeats(initialSeats)

      // Check if all already checked in
      const allCheckedIn = data.passengers.length > 0 && data.passengers.every((p) => p.is_checked_in)
      if (allCheckedIn) {
        setIssuedBoardingPasses(
          data.passengers.map((p) => ({
            passenger_id: p.id,
            full_name: p.full_name,
            id_number: p.id_number,
            seat_number: p.seat_number || 'N/A',
            boarding_pass_code: p.boarding_pass_code,
            checked_in_at: p.checked_in_at,
            gate: '3A',
            boarding_time: '30 menit sebelum keberangkatan',
          })),
        )
      } else {
        setIssuedBoardingPasses(null)
      }

      // Update URL search params
      if (data.booking_code) {
        setSearchParams({ bookingCode: data.booking_code }, { replace: true })
      }
    } catch (err: any) {
      console.error('Failed to lookup booking:', err)
      setSearchError(err?.message || 'Kode booking tidak ditemukan atau penerbangan tidak valid.')
      setBookingDetail(null)
    } finally {
      setLoadingDetail(false)
      setIsSearching(false)
    }
  }

  // Initial load if query params present
  useEffect(() => {
    if (pnrQuery || bookingIdQuery) {
      loadBooking(pnrQuery || undefined, bookingIdQuery || undefined)
    }
  }, [pnrQuery, bookingIdQuery])

  // Select seat for passenger
  const handleSeatSelect = (passengerId: number, seat: SeatItem) => {
    setSelectedSeats((prev) => ({
      ...prev,
      [passengerId]: { seatId: seat.id, seatNumber: seat.seat_number },
    }))

    setToastMessage(`Kursi ${seat.seat_number} berhasil dipilih`)
    setTimeout(() => setToastMessage(null), 3000)
    setEditingPassengerId(null)
  }

  // Submit check-in
  const handleCompleteCheckIn = async () => {
    if (!bookingDetail || !isAgreed) return

    setIsSubmitting(true)
    try {
      const seatChanges = Object.entries(selectedSeats).map(([passId, seatInfo]) => ({
        passenger_id: Number(passId),
        seat_id: seatInfo.seatId,
      }))

      const res = await api.post('/checkin', {
        booking_id: bookingDetail.booking_id,
        seat_changes: seatChanges,
      })

      const data = res.data?.data
      setIssuedBoardingPasses(data.boarding_passes || [])
      setToastMessage('Check-in online berhasil diselesaikan!')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('Check-in failed:', err)
      setToastMessage(err?.message || 'Gagal menyelesaikan check-in. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format Indonesian date
  const formatIndoDate = (isoStr?: string | null) => {
    if (!isoStr) return '--'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return isoStr
    }
  }

  const formatTime = (isoStr?: string | null) => {
    if (!isoStr) return '--:--'
    try {
      const d = new Date(isoStr)
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')} WIB`
    } catch {
      return '--:--'
    }
  }

  const flight = bookingDetail?.flight
  const firstSeg = flight?.segments?.[0]
  const lastSeg = flight?.segments?.[flight?.segments?.length - 1]

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between antialiased">
      <Navbar />

      <main className="w-full pt-[76px] pb-16 flex-1">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-subtle hover:text-brand-fg text-xs md:text-sm font-medium transition-colors group"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
                arrow_back
              </span>
              <span>Kembali ke beranda</span>
            </Link>

            <div className="flex items-center gap-2 text-subtle text-[11px] uppercase tracking-wider font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem Check-in Terbuka</span>
            </div>
          </div>

          {/* ─── CASE 1: SUCCESS BOARDING PASS VIEW ─── */}
          {issuedBoardingPasses && issuedBoardingPasses.length > 0 && bookingDetail ? (
            <div className="bg-raised rounded-ticket border border-line p-6 md:p-10 shadow-lg max-w-3xl mx-auto my-4 text-center animate-fadeInUp">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-ink mb-2">Check-in Online Berhasil!</h1>
              <p className="text-subtle text-sm mb-6 max-w-lg mx-auto leading-relaxed">
                Boarding pass digital resmi telah terbit untuk seluruh penumpang penerbangan{' '}
                <strong className="text-ink">
                  {bookingDetail.flight.airline?.name || 'SkyBook'} {bookingDetail.flight.flight_number}
                </strong>
                . Tunjukkan boarding pass ini di gerbang keberangkatan.
              </p>

              {/* Cards Boarding Pass */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left">
                {issuedBoardingPasses.map((bp) => (
                  <div
                    key={bp.passenger_id}
                    className="bg-panel border border-line p-5 rounded-ticket relative shadow-sm hover:border-brand-fg/40 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-brand-fg block">
                          BOARDING PASS
                        </span>
                        <span className="text-xs font-semibold text-subtle">
                          {bookingDetail.flight.airline?.name || 'SkyBook'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold bg-tint text-brand-fg px-2.5 py-1 rounded">
                          Kursi {bp.seat_number}
                        </span>
                      </div>
                    </div>

                    <div className="text-base font-bold text-ink truncate">{bp.full_name}</div>
                    <div className="text-xs text-subtle font-mono">{bp.id_number}</div>

                    <div className="mt-4 pt-3 border-t border-dashed border-line grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-subtle block text-[10px] uppercase">Rute</span>
                        <span className="font-bold text-ink">
                          {firstSeg?.origin?.code || 'ORIGIN'} &rarr; {lastSeg?.destination?.code || 'DEST'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-subtle block text-[10px] uppercase">Jadwal</span>
                        <span className="font-bold text-ink tabular-nums">
                          {formatTime(firstSeg?.departure_time)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 bg-page/70 rounded p-2 flex items-center justify-between text-[11px] text-subtle font-mono">
                      <span>PNR: {bookingDetail.booking_code}</span>
                      <span className="text-ink font-semibold">{bp.boarding_pass_code}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto h-11 px-6 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Cetak / Simpan Boarding Pass</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingDetail(null)
                    setIssuedBoardingPasses(null)
                    setSearchParams({}, { replace: true })
                  }}
                  className="w-full sm:w-auto h-11 px-6 border border-line bg-panel hover:bg-tint text-ink rounded-control font-semibold text-sm flex items-center justify-center transition-colors"
                >
                  Check-in Tiket Lain
                </button>
              </div>
            </div>
          ) : bookingDetail ? (
            /* ─── CASE 2: CHECK-IN WORKSPACE WITH REAL BOOKING DATA ─── */
            <div>
              {/* Flight Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
                      Check-in online
                    </h1>
                    <span className="bg-panel border border-line text-ink px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                      {flight?.airline?.name} {flight?.flight_number}
                    </span>
                    <span className="text-xs font-mono bg-tint text-brand-fg font-bold px-2 py-0.5 rounded">
                      PNR: {bookingDetail.booking_code}
                    </span>
                  </div>
                  <p className="text-sm md:text-base text-subtle flex items-center gap-2">
                    <span className="font-bold text-ink">
                      {firstSeg?.origin?.city} ({firstSeg?.origin?.code})
                    </span>
                    <span className="material-symbols-outlined text-brand-fg text-[18px]">
                      arrow_forward
                    </span>
                    <span className="font-bold text-ink">
                      {lastSeg?.destination?.city} ({lastSeg?.destination?.code})
                    </span>
                  </p>
                </div>

                <div className="bg-raised border border-line px-4 py-2.5 rounded-ticket shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                      Jadwal Keberangkatan
                    </div>
                    <div className="text-sm font-bold text-ink tabular-nums">
                      {formatIndoDate(firstSeg?.departure_time)} • {formatTime(firstSeg?.departure_time)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Delay Warning if flight is delayed */}
              {flight && flight.delay_minutes > 0 && (
                <div className="mb-6 p-4 rounded-ticket bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-[24px]">warning</span>
                  <div>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      Penerbangan Mengalami Keterlambatan ({flight.delay_minutes} Menit)
                    </p>
                    <p className="text-xs text-subtle">
                      Waktu keberangkatan disesuaikan. Jam boarding mengikuti jadwal terbaru.
                    </p>
                  </div>
                </div>
              )}

              {/* Main Workspace (8 cols Left / 4 cols Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* Left Column (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  {/* Urgent Flight Timing Progress Card */}
                  <div className="bg-raised rounded-ticket border border-line p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-brand-fg">
                        <span className="material-symbols-outlined text-[20px]">schedule</span>
                        <span className="font-bold text-base">
                          Check-in Online Mandiri
                        </span>
                      </div>
                      <span className="text-xs text-subtle font-medium">Buka hingga 1 jam sebelum terbang</span>
                    </div>
                    <p className="text-xs md:text-sm text-subtle mb-3 leading-relaxed">
                      Pastikan data identitas penumpang sesuai kartu identitas resmi (KTP/Paspor). Konfirmasi nomor kursi sebelum melanjutkan.
                    </p>
                    <div className="w-full bg-page h-2 rounded-full overflow-hidden border border-line/40">
                      <div
                        className="bg-brand-fg h-full rounded-full transition-all duration-500"
                        style={{ width: '80%' }}
                      />
                    </div>
                  </div>

                  {/* Passenger Selection Area */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-ink">
                        Pilih Penumpang &amp; Konfigurasi Kursi
                      </h2>
                      <span className="text-xs text-subtle">
                        {bookingDetail.passengers.length} Penumpang terdaftar
                      </span>
                    </div>

                    {bookingDetail.passengers.map((passenger) => {
                      const isEditing = editingPassengerId === passenger.id
                      const currentSeat =
                        selectedSeats[passenger.id]?.seatNumber || passenger.seat_number || 'Belum dipilih'

                      return (
                        <div
                          key={passenger.id}
                          className={`bg-raised rounded-ticket border transition-all p-5 shadow-sm ${
                            isEditing ? 'border-brand-fg ring-1 ring-brand-fg/30' : 'border-line'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="pt-0.5">
                                <div className="w-5 h-5 rounded bg-brand text-white flex items-center justify-center shadow-sm">
                                  <span className="material-symbols-outlined text-[16px]">check</span>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-ink">
                                    {passenger.full_name}
                                  </span>
                                  <span className="bg-tint text-brand-fg text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                    {passenger.seat_class}
                                  </span>
                                  {passenger.is_checked_in && (
                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded">
                                      Sudah Check-in
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-subtle">
                                  <span className="font-mono">NIK/ID: {passenger.id_number}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto">
                              <div className="flex items-center gap-1.5 bg-panel border border-line px-3 py-1.5 rounded-control shadow-sm">
                                <span className="material-symbols-outlined text-brand-fg text-[18px]">
                                  airline_seat_recline_extra
                                </span>
                                <span className="font-bold text-ink tabular-nums text-sm">
                                  Kursi {currentSeat}
                                </span>
                              </div>

                              {!passenger.is_checked_in && (
                                <button
                                  type="button"
                                  onClick={() => setEditingPassengerId(isEditing ? null : passenger.id)}
                                  className="text-brand-fg hover:underline text-xs md:text-sm font-semibold transition-colors"
                                >
                                  {isEditing ? 'Tutup kursi' : 'Ganti kursi'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Seat Selector Grid */}
                          {isEditing && (
                            <div className="mt-4 pt-4 border-t border-line bg-panel p-4 rounded-control animate-fadeIn">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 mb-3 border-b border-line/60">
                                <div>
                                  <div className="text-sm font-bold text-ink">
                                    Pilih Kursi Penerbangan ({passenger.full_name})
                                  </div>
                                  <p className="text-xs text-subtle">
                                    Pilih kursi tersedia pada pesawat {flight?.airplane?.model || 'pesawat'}.
                                  </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-subtle">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3.5 h-3.5 rounded bg-brand" />
                                    <span>Terpilih</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3.5 h-3.5 rounded bg-panel border border-line" />
                                    <span>Tersedia</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3.5 h-3.5 rounded bg-page flex items-center justify-center text-[10px]">
                                      ×
                                    </div>
                                    <span>Terisi</span>
                                  </div>
                                </div>
                              </div>

                              {/* Seat Layout */}
                              <div className="relative max-w-md mx-auto py-2">
                                {hoveredSeat && (
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-ink text-panel text-[11px] font-semibold py-1 px-3 rounded-lg shadow-lg pointer-events-none z-20 whitespace-nowrap animate-fadeIn">
                                    Kursi {hoveredSeat} • Siap Dipilih
                                  </div>
                                )}

                                <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1">
                                  {bookingDetail.available_seats && bookingDetail.available_seats.length > 0 ? (
                                    bookingDetail.available_seats.map((seat) => {
                                      const isSelected = selectedSeats[passenger.id]?.seatId === seat.id
                                      const isOccupied =
                                        !seat.is_available &&
                                        !Object.values(selectedSeats).some((s) => s.seatId === seat.id)

                                      return (
                                        <button
                                          key={seat.id}
                                          type="button"
                                          disabled={isOccupied}
                                          onClick={() => handleSeatSelect(passenger.id, seat)}
                                          onMouseEnter={() => setHoveredSeat(seat.seat_number)}
                                          onMouseLeave={() => setHoveredSeat(null)}
                                          className={`h-9 rounded-control flex items-center justify-center text-xs font-bold transition-all relative select-none ${
                                            isSelected
                                              ? 'bg-brand text-white shadow-sm ring-2 ring-brand-fg/30'
                                              : isOccupied
                                              ? 'bg-page text-subtle/40 cursor-not-allowed'
                                              : 'bg-panel border border-line hover:border-brand-fg hover:bg-tint text-ink'
                                          }`}
                                        >
                                          {isSelected ? (
                                            <span className="material-symbols-outlined text-[16px]">
                                              check
                                            </span>
                                          ) : isOccupied ? (
                                            '×'
                                          ) : (
                                            seat.seat_number
                                          )}
                                        </button>
                                      )
                                    })
                                  ) : (
                                    <div className="col-span-6 text-center text-xs text-subtle py-4">
                                      Tidak ada data denah kursi tersedia untuk penerbangan ini.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Confirmation & Regulatory Declaration Panel */}
                  <div className="bg-raised rounded-ticket border border-line p-5 shadow-sm flex flex-col gap-4">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAgreed}
                        onChange={(e) => setIsAgreed(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-brand border-line focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs md:text-sm text-subtle leading-relaxed">
                        Saya menyatakan bahwa seluruh data penumpang sesuai dengan identitas resmi
                        (KTP/Paspor) yang sah dan saya menyetujui ketentuan keselamatan barang bawaan
                        berbahaya (<em>Dangerous Goods Regulation</em>).
                      </span>
                    </label>
                  </div>

                  {/* Primary Action Button */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={!isAgreed || isSubmitting}
                      onClick={handleCompleteCheckIn}
                      className="w-full h-12 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-base shadow-sm transition-all duration-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Menerbitkan boarding pass...</span>
                        </>
                      ) : (
                        <>
                          <span>Selesaikan check-in</span>
                          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </>
                      )}
                    </button>
                    <div className="flex items-center justify-center gap-1.5 text-subtle text-xs py-1">
                      <span className="material-symbols-outlined text-[16px]">verified_user</span>
                      <span>Enkripsi sertifikat boarding pass standar aviasi internasional</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Rules & Info (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-5 sticky top-[92px]">
                  {/* Info Rules Panel */}
                  <div className="bg-raised rounded-ticket border border-line p-5 shadow-sm">
                    <div className="flex items-center gap-2 pb-3 mb-3 border-b border-line text-ink">
                      <span className="material-symbols-outlined text-brand-fg text-[20px]">info</span>
                      <h3 className="font-bold text-base">Aturan Check-in Online</h3>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div>
                        <span className="font-bold text-subtle uppercase text-[10px] tracking-wider block">
                          Batas Waktu
                        </span>
                        <p className="text-ink mt-0.5 leading-relaxed">
                          Check-in mandiri dibuka hingga 1 jam sebelum jadwal terbang.
                        </p>
                      </div>

                      <div>
                        <span className="font-bold text-subtle uppercase text-[10px] tracking-wider block">
                          Boarding Pass
                        </span>
                        <p className="text-ink mt-0.5 leading-relaxed">
                          Langsung terbit seketika setelah check-in berhasil dan dapat diunduh / dicetak.
                        </p>
                      </div>

                      <div>
                        <span className="font-bold text-subtle uppercase text-[10px] tracking-wider block">
                          Pemeriksaan Gerbang
                        </span>
                        <p className="text-ink mt-0.5 leading-relaxed">
                          Tunjukkan boarding pass digital dan kartu identitas fisik di terminal keberangkatan.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Aircraft Type Card */}
                  <div className="bg-panel border border-line rounded-ticket p-4 flex items-center justify-between text-ink shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-brand-fg text-[24px]">flight</span>
                      <div>
                        <div className="text-sm font-bold">
                          {flight?.airplane?.model || 'Pesawat Komersial'}
                        </div>
                        <div className="text-xs text-subtle">
                          {flight?.airplane?.registration_number ? `Reg: ${flight.airplane.registration_number}` : 'Kabin Penumpang'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] uppercase bg-tint text-brand-fg px-2.5 py-0.5 rounded-full font-bold">
                      {flight?.status || 'Scheduled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ─── CASE 3: SELECT FROM USER BOOKINGS OR PNR SEARCH FORM ─── */
            <div className="max-w-2xl mx-auto flex flex-col gap-8 my-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-tint text-brand-fg flex items-center justify-center mx-auto mb-2">
                  <span className="material-symbols-outlined text-[32px]">flight_takeoff</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-ink">
                  Check-in Online Mandiri
                </h1>
                <p className="text-subtle text-sm max-w-md mx-auto">
                  {user
                    ? `Selamat datang, ${user.name}! Pilih tiket penerbangan aktif Anda atau masukkan kode booking.`
                    : 'Masukkan 6 digit Kode Booking (PNR) Anda untuk memulai check-in.'}
                </p>
              </div>

              {/* User Eligible Bookings List */}
              {user && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-ink flex items-center gap-2">
                      <span className="material-symbols-outlined text-brand-fg text-[20px]">
                        confirmation_number
                      </span>
                      <span>Pesanan Aktif di Akun Anda</span>
                    </h2>
                    <span className="text-xs text-subtle">
                      {loadingUserBookings ? 'Memuat...' : `${userBookings.length} Tiket ditemukan`}
                    </span>
                  </div>

                  {loadingUserBookings ? (
                    <div className="bg-raised border border-line rounded-ticket p-8 text-center flex flex-col items-center gap-3">
                      <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-subtle">Memeriksa jadwal penerbangan Anda...</span>
                    </div>
                  ) : userBookings.length > 0 ? (
                    <div className="space-y-3">
                      {userBookings.map((b) => (
                        <div
                          key={b.id}
                          className="bg-raised border border-line hover:border-brand-fg/50 rounded-ticket p-4 sm:p-5 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-ink">
                                {b.flight?.airline?.name || 'SkyBook'} {b.flight?.flight_number}
                              </span>
                              <span className="text-xs font-mono font-bold bg-tint text-brand-fg px-2 py-0.5 rounded">
                                PNR: {b.booking_code}
                              </span>
                              {b.is_fully_checked_in ? (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  Sudah Check-in
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  Siap Check-in
                                </span>
                              )}
                            </div>

                            <p className="text-xs sm:text-sm text-subtle flex items-center gap-1.5 font-medium">
                              <span>
                                {b.flight?.origin?.city} ({b.flight?.origin?.code})
                              </span>
                              <span className="material-symbols-outlined text-[16px] text-brand-fg">
                                arrow_forward
                              </span>
                              <span>
                                {b.flight?.destination?.city} ({b.flight?.destination?.code})
                              </span>
                            </p>

                            <div className="text-xs text-subtle">
                              Jadwal: {formatIndoDate(b.flight?.departure_time)} •{' '}
                              {formatTime(b.flight?.departure_time)} • {b.passenger_count} Penumpang
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => loadBooking(b.booking_code)}
                            className="h-10 px-4 bg-brand hover:bg-brand-hover text-white rounded-control text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm shrink-0 transition-all active:scale-98"
                          >
                            <span>{b.is_fully_checked_in ? 'Lihat Boarding Pass' : 'Pilih & Check-in'}</span>
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-raised border border-line rounded-ticket p-6 text-center space-y-3">
                      <p className="text-sm text-subtle">
                        Belum ada tiket penerbangan aktif atas nama <strong>{user.name}</strong>.
                      </p>
                      <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold shadow-sm transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                        <span>Cari &amp; Pesan Tiket Sekarang</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Manual PNR Lookup Box */}
              <div className="bg-raised border border-line rounded-ticket p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-fg text-[20px]">search</span>
                  <h3 className="font-bold text-sm text-ink">
                    Cari Berdasarkan Kode Booking (PNR)
                  </h3>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    loadBooking()
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label
                      htmlFor="pnr-input"
                      className="block text-xs font-semibold text-subtle uppercase tracking-wider mb-1"
                    >
                      Kode Booking (6 Karakter)
                    </label>
                    <input
                      id="pnr-input"
                      type="text"
                      maxLength={10}
                      value={searchPnr}
                      onChange={(e) => setSearchPnr(e.target.value.toUpperCase())}
                      placeholder="Contoh: 9JFCSZ"
                      className="w-full h-11 px-3.5 rounded-control border border-line bg-panel text-ink font-mono font-bold text-base tracking-widest placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-brand-fg uppercase"
                    />
                  </div>

                  {searchError && (
                    <div className="p-3 rounded-control bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <span>{searchError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSearching || !searchPnr.trim()}
                    className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-control text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 disabled:opacity-50"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Mencari pesanan...</span>
                      </>
                    ) : (
                      <>
                        <span>Cari &amp; Buka Check-in</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Operational Toast Notification */}
        {toastMessage && (
          <aside
            aria-label="Notifikasi sistem"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-raised border border-line text-ink px-4 py-3 rounded-ticket shadow-2xl animate-fadeIn"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[16px]">check</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-ink">{toastMessage}</span>
              <span className="text-[10px] text-subtle">Sinkronisasi data langsung</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-subtle hover:text-ink ml-2 p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </main>

      <Footer />
    </div>
  )
}
