import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import RealQrCode from '../../components/common/RealQrCode'
import LandmarkWatermark from '../../components/common/LandmarkWatermark'
import { AirlineLogo } from '../../components/common/AirlineLogo'
import { getDestinationVisual, formatFlightDuration } from '../../lib/destinationMedia'

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
  const { bookingId: routeBookingId } = useParams<{ bookingId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()

  const pnrQuery = searchParams.get('bookingCode') || searchParams.get('pnr') || searchParams.get('booking_code')
  const bookingIdQuery = routeBookingId || searchParams.get('bookingId') || searchParams.get('booking_id')

  // Search input state
  const [searchPnr, setSearchPnr] = useState(pnrQuery || '')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Eligible bookings for logged in user
  const [userBookings, setUserBookings] = useState<UserBookingSummary[]>([])
  const [loadingUserBookings, setLoadingUserBookings] = useState(false)

  // Selected Booking Detail
  const [bookingDetail, setBookingDetail] = useState<BookingCheckInDetail | null>(null)

  // Passenger seat selections (passengerId -> { seatId, seatNumber })
  const [selectedSeats, setSelectedSeats] = useState<Record<number, { seatId: number; seatNumber: string }>>({})

  // Checked passengers for checkin submit
  const [checkedPassengerIds, setCheckedPassengerIds] = useState<number[]>([])

  // Passenger whose seat map is currently expanded
  const [activeEditingPaxId, setActiveEditingPaxId] = useState<number | null>(null)

  // Active passenger tab in Boarding Pass view
  const [activeBoardingPassIndex, setActiveBoardingPassIndex] = useState(0)

  // Safety declaration checkbox
  const [isAgreed, setIsAgreed] = useState(true)

  // Submitting check-in
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [issuedBoardingPasses, setIssuedBoardingPasses] = useState<any[] | null>(null)

  // Modal dialog states
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

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

        // If no PNR or bookingId in URL and exactly 1 booking exists, auto-load
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

  // Load booking details by PNR or ID
  const loadBooking = async (code?: string, id?: string | number) => {
    const targetCode = code || searchPnr.trim().toUpperCase()
    const targetId = id || bookingIdQuery

    if (!targetCode && !targetId) {
      setSearchError('Silakan masukkan Kode Booking (PNR) 6 karakter.')
      return
    }

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
      if (!data) {
        setSearchError('Data pesanan tidak ditemukan.')
        setBookingDetail(null)
        return
      }

      setBookingDetail(data)

      // Initialize selected seats
      const initialSeats: Record<number, { seatId: number; seatNumber: string }> = {}
      data.passengers.forEach((p) => {
        if (p.seat_id && p.seat_number) {
          initialSeats[p.id] = { seatId: p.seat_id, seatNumber: p.seat_number }
        }
      })
      setSelectedSeats(initialSeats)

      // Default select all passengers who are not yet checked in
      const pendingPax = data.passengers.filter((p) => !p.is_checked_in).map((p) => p.id)
      setCheckedPassengerIds(pendingPax.length > 0 ? pendingPax : data.passengers.map((p) => p.id))

      // Check if all passengers are already checked in
      const allCheckedIn = data.passengers.length > 0 && data.passengers.every((p) => p.is_checked_in)
      if (allCheckedIn) {
        setIssuedBoardingPasses(
          data.passengers.map((p) => ({
            passenger_id: p.id,
            full_name: p.full_name,
            id_number: p.id_number,
            seat_number: p.seat_number || 'N/A',
            boarding_pass_code: p.boarding_pass_code || `BP-${data.booking_code}-${p.id}`,
            checked_in_at: p.checked_in_at || new Date().toISOString(),
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
      const msg = err?.response?.data?.message || err?.message || 'Kode booking tidak ditemukan.'
      setSearchError(msg)
      setBookingDetail(null)
    } finally {
      setIsSearching(false)
    }
  }

  // Initial load if route param or query params are present
  useEffect(() => {
    if (bookingIdQuery || pnrQuery) {
      loadBooking(pnrQuery || undefined, bookingIdQuery || undefined)
    }
  }, [bookingIdQuery, pnrQuery])

  // Flight timing calculations
  const flight = bookingDetail?.flight
  const firstSeg = flight?.segments?.[0]
  const lastSeg = flight?.segments?.[flight?.segments?.length - 1]

  const isFlightCancelled = flight?.status === 'cancelled'
  const isDelayed = flight?.status === 'delayed' && (flight.delay_minutes || 0) > 0

  const departureDate = firstSeg?.departure_time ? new Date(firstSeg.departure_time) : null
  const now = new Date()

  // Hours until departure
  const hoursUntilDeparture = departureDate
    ? (departureDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    : 0

  // Check-in status window:
  // Open between H-24 and H-1
  const isTooEarlyForCheckIn = hoursUntilDeparture > 24
  const isTooLateForCheckIn = hoursUntilDeparture < 1
  const isCheckInWindowOpen = !isFlightCancelled && !isTooEarlyForCheckIn && !isTooLateForCheckIn

  // Calculate Check-in countdown (until closing H-1)
  const timeUntilCheckInCloses = useMemo(() => {
    if (!departureDate) return { hours: 0, minutes: 0 }
    // Closes 1 hour before departure
    const closeTime = new Date(departureDate.getTime() - 60 * 60 * 1000)
    const diffMs = Math.max(0, closeTime.getTime() - now.getTime())
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return { hours, minutes }
  }, [departureDate])

  // Progress percentage for 24h window (from 24h down to 1h = 23h duration)
  const checkInWindowProgress = useMemo(() => {
    if (hoursUntilDeparture > 24) return 0
    if (hoursUntilDeparture <= 1) return 100
    // Remaining hours in the 23-hour active window
    const elapsed = 24 - hoursUntilDeparture
    return Math.min(100, Math.max(0, Math.round((elapsed / 23) * 100)))
  }, [hoursUntilDeparture])

  // Format time (HH.MM WIB/WITA)
  const formatTime = (isoStr?: string | null) => {
    if (!isoStr) return '--:--'
    try {
      const d = new Date(isoStr)
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return '--:--'
    }
  }

  // Format full Indonesian date
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

  // Calculate estimated boarding time (departureTime + delayMinutes - 30 minutes)
  const boardingTimeDisplay = useMemo(() => {
    if (!departureDate) return { timeStr: '07.10 WIB', relativeStr: '' }
    const delay = flight?.delay_minutes || 0
    const adjustedDep = new Date(departureDate.getTime() + delay * 60 * 1000)
    const bTime = new Date(adjustedDep.getTime() - 30 * 60 * 1000)
    const diffToBoarding = bTime.getTime() - now.getTime()
    const bHours = Math.floor(diffToBoarding / (1000 * 60 * 60))
    const bMins = Math.floor((diffToBoarding % (1000 * 60 * 60)) / (1000 * 60))

    const timeStr = `${String(bTime.getHours()).padStart(2, '0')}.${String(bTime.getMinutes()).padStart(2, '0')} WIB`
    const relativeStr = diffToBoarding > 0 ? `(${bHours}j ${bMins}m lagi)` : '(Pintu dibuka)'
    return { timeStr, relativeStr }
  }, [departureDate, flight?.delay_minutes])

  // Toggle passenger selection
  const handleTogglePassenger = (passengerId: number) => {
    setCheckedPassengerIds((prev) =>
      prev.includes(passengerId) ? prev.filter((id) => id !== passengerId) : [...prev, passengerId],
    )
  }

  // Seat change select
  const handleSelectSeat = (passengerId: number, seat: SeatItem) => {
    setSelectedSeats((prev) => ({
      ...prev,
      [passengerId]: { seatId: seat.id, seatNumber: seat.seat_number },
    }))
    showToast(`Kursi ${seat.seat_number} berhasil dipilih`)
    setActiveEditingPaxId(null)
  }

  // Submit complete check-in
  const handleCompleteCheckIn = async () => {
    if (!bookingDetail || !isAgreed || checkedPassengerIds.length === 0) return

    setIsSubmitting(true)
    try {
      const seatChanges = checkedPassengerIds
        .map((pId) => {
          const seat = selectedSeats[pId]
          return seat ? { passenger_id: pId, seat_id: seat.seatId } : null
        })
        .filter(Boolean) as Array<{ passenger_id: number; seat_id: number }>

      const res = await api.post('/checkin', {
        booking_id: bookingDetail.booking_id,
        seat_changes: seatChanges,
      })

      const data = res.data?.data
      if (data?.boarding_passes) {
        setIssuedBoardingPasses(data.boarding_passes)
        showToast('Check-in online berhasil diselesaikan!')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        // Fallback reload
        loadBooking(bookingDetail.booking_code)
      }
    } catch (err: any) {
      console.error('Check-in submission failed:', err)
      const msg = err?.response?.data?.message || err?.message || 'Gagal menyelesaikan check-in. Silakan coba lagi.'
      showToast(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Download Boarding Pass PDF
  const handleDownloadBoardingPassPDF = async (passengerId?: number) => {
    if (!bookingDetail) return
    setDownloadingPdf(true)
    showToast('Menyiapkan Boarding Pass PDF...')

    try {
      const targetPaxId = passengerId || bookingDetail.passengers[activeBoardingPassIndex]?.id
      const queryParam = targetPaxId ? `?passenger_id=${targetPaxId}` : ''
      const res = await api.get(`/check-in/${bookingDetail.booking_id}/boarding-pass${queryParam}`, {
        responseType: 'blob',
      })

      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `boardingpass-${bookingDetail.booking_code}-${targetPaxId || 'all'}.pdf`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      showToast('Boarding Pass PDF berhasil diunduh.')
    } catch (err: any) {
      console.error('Failed to download boarding pass PDF:', err)
      showToast('Gagal mengunduh dokumen PDF. Silakan coba kembali.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Generate simulated seat matrix rows (e.g. rows 12 to 16, cols A B C | D E F)
  const seatMatrix = useMemo(() => {
    if (!bookingDetail) return []
    const availableSet = new Set(
      bookingDetail.available_seats?.filter((s) => s.is_available).map((s) => s.seat_number) || [],
    )
    const currentlyPickedSeats = new Set(Object.values(selectedSeats).map((s) => s.seatNumber))

    const rows = [12, 13, 14, 15, 16]
    const colsLeft = ['A', 'B', 'C']
    const colsRight = ['D', 'E', 'F']

    return rows.map((r) => {
      const left = colsLeft.map((c) => {
        const sNum = `${r}${c}`
        const matchedItem = bookingDetail.available_seats?.find((s) => s.seat_number === sNum)
        const isAvail = availableSet.has(sNum) && !currentlyPickedSeats.has(sNum)
        return {
          seatNumber: sNum,
          id: matchedItem?.id || r * 10 + c.charCodeAt(0),
          isAvailable: isAvail,
        }
      })
      const right = colsRight.map((c) => {
        const sNum = `${r}${c}`
        const matchedItem = bookingDetail.available_seats?.find((s) => s.seat_number === sNum)
        const isAvail = availableSet.has(sNum) && !currentlyPickedSeats.has(sNum)
        return {
          seatNumber: sNum,
          id: matchedItem?.id || r * 10 + c.charCodeAt(0),
          isAvailable: isAvail,
        }
      })
      return { rowNum: r, left, right }
    })
  }, [bookingDetail, selectedSeats])

  // Active passenger for Boarding Pass view
  const activePassenger = bookingDetail?.passengers[activeBoardingPassIndex] || bookingDetail?.passengers[0]
  const activeBoardingPass =
    issuedBoardingPasses?.find((bp) => bp.passenger_id === activePassenger?.id) || issuedBoardingPasses?.[0]

  // Visual kota tujuan (gambar panorama + siluet landmark + durasi)
  const destVisual = useMemo(
    () => getDestinationVisual(lastSeg?.destination?.code, lastSeg?.destination?.city),
    [lastSeg?.destination?.code, lastSeg?.destination?.city],
  )
  const flightDurationStr = useMemo(
    () => formatFlightDuration(firstSeg?.departure_time, lastSeg?.arrival_time),
    [firstSeg?.departure_time, lastSeg?.arrival_time],
  )

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between antialiased selection:bg-brand selection:text-white">
      <div className="print:hidden">
        <Navbar />
      </div>

      <main className="w-full pt-[72px] print:pt-0 pb-16 print:pb-0 flex-1 bg-page print:bg-white">
        <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-6 md:py-8">

          {/* ─────────────────────────────────────────────────────────────
              CASE 1: NO BOOKING LOADED -> SEARCH & ELIGIBLE BOOKINGS PORTAL
             ───────────────────────────────────────────────────────────── */}
          {!bookingDetail && (
            <div className="flex flex-col gap-8 max-w-4xl mx-auto py-4">
              {/* Header Title */}
              <div className="text-center max-w-xl mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tint text-brand-fg text-xs font-semibold uppercase tracking-wider mb-3">
                  <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
                  <span>Self Check-in Service</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-ink tracking-tight mb-2">
                  Check-in Online Mandiri
                </h1>
                <p className="text-sm text-subtle leading-relaxed">
                  Hindari antrean di bandara. Pilih kursi terbaik dan dapatkan boarding pass resmi secara instan mulai 24 jam sebelum keberangkatan.
                </p>
              </div>

              {/* Search Form Card */}
              <div className="bg-raised border border-line rounded-ticket p-6 md:p-8 shadow-sm">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    loadBooking()
                  }}
                  className="flex flex-col sm:flex-row gap-3 items-stretch"
                >
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-subtle text-[22px]">
                      confirmation_number
                    </span>
                    <input
                      type="text"
                      value={searchPnr}
                      onChange={(e) => setSearchPnr(e.target.value.toUpperCase())}
                      placeholder="Masukkan Kode Booking / PNR (cth: K7QM4X)"
                      maxLength={10}
                      className="w-full h-12 pl-12 pr-4 bg-panel border border-line focus:border-brand-fg focus:ring-2 focus:ring-brand-fg/20 rounded-control font-mono font-bold text-ink placeholder:font-sans placeholder:font-normal placeholder:text-subtle text-base uppercase transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchPnr.trim()}
                    className="h-12 px-7 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-control font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Mencari...</span>
                      </>
                    ) : (
                      <>
                        <span>Cari Pesanan</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>

                {searchError && (
                  <div className="mt-4 p-3.5 bg-danger/10 border border-danger/20 rounded-control flex items-start gap-2.5 text-danger text-sm">
                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                    <span>{searchError}</span>
                  </div>
                )}
              </div>

              {/* Logged-In User Eligible Bookings */}
              {user && (
                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-ink flex items-center gap-2">
                      <span className="material-symbols-outlined text-brand-fg text-[20px]">airline_seat_recline_normal</span>
                      <span>Pemesanan Anda yang Siap Check-in</span>
                    </h2>
                    <span className="text-xs text-subtle">
                      {userBookings.length} penerbangan ditemukan
                    </span>
                  </div>

                  {loadingUserBookings ? (
                    <div className="p-8 text-center text-subtle text-sm bg-panel border border-line rounded-ticket flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      <span>Memeriksa pesanan Anda...</span>
                    </div>
                  ) : userBookings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userBookings.map((b) => (
                        <div
                          key={b.id}
                          className="bg-panel border border-line hover:border-brand-fg/50 rounded-ticket p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-sm"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono font-bold text-brand-fg text-sm tracking-wider">
                                {b.booking_code}
                              </span>
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-tint text-brand-fg font-medium">
                                {b.passenger_count} Penumpang
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-ink font-bold text-base mb-1">
                              <span>{b.flight?.origin?.code || 'ORIG'}</span>
                              <span className="material-symbols-outlined text-[16px] text-subtle">arrow_forward</span>
                              <span>{b.flight?.destination?.code || 'DEST'}</span>
                            </div>

                            <div className="text-xs text-subtle flex items-center gap-1.5">
                              <AirlineLogo
                                code={b.flight?.airline?.code}
                                name={b.flight?.airline?.name}
                                logo={b.flight?.airline?.logo}
                                size="xs"
                              />
                              <span>{b.flight?.airline?.name || 'SkyBook'} {b.flight?.flight_number}</span>
                              <span>•</span>
                              <span className="tabular-nums">{formatIndoDate(b.flight?.departure_time)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => loadBooking(b.booking_code, b.id)}
                            className="w-full h-10 bg-brand/10 hover:bg-brand text-brand-fg hover:text-white rounded-control text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <span>{b.is_fully_checked_in ? 'Buka Boarding Pass' : 'Lanjutkan Check-in'}</span>
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-subtle text-sm bg-panel border border-line rounded-ticket">
                      Belum ada penerbangan aktif yang memenuhi syarat check-in. Check-in online dibuka 24 jam sebelum jadwal keberangkatan.
                    </div>
                  )}
                </div>
              )}

              {/* Informational Guidance Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="p-5 rounded-ticket bg-panel border border-line">
                  <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                  </div>
                  <h3 className="text-sm font-bold text-ink mb-1">Kapan Check-in Dibuka?</h3>
                  <p className="text-xs text-subtle leading-relaxed">
                    Check-in online mandiri dibuka H-24 jam dan ditutup tepat 60 menit sebelum waktu keberangkatan.
                  </p>
                </div>

                <div className="p-5 rounded-ticket bg-panel border border-line">
                  <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <h3 className="text-sm font-bold text-ink mb-1">Dokumen Wajib</h3>
                  <p className="text-xs text-subtle leading-relaxed">
                    Siapkan e-KTP fisik, SIM, atau Paspor yang masih berlaku dan sesuai dengan nama pada tiket saat pemeriksaan bandara.
                  </p>
                </div>

                <div className="p-5 rounded-ticket bg-panel border border-line">
                  <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[20px]">luggage</span>
                  </div>
                  <h3 className="text-sm font-bold text-ink mb-1">Bagasi Tercatat</h3>
                  <p className="text-xs text-subtle leading-relaxed">
                    Penumpang dengan bagasi tercatat dapat langsung menuju counter drop bagasi khusus maskapai maksimal 50 menit sebelum terbang.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              CASE 2: SUCCESS BOARDING PASS VIEW (FIGMA + DRIBBBLE + DESTINATION ART)
             ───────────────────────────────────────────────────────────── */}
          {bookingDetail && issuedBoardingPasses && issuedBoardingPasses.length > 0 && (
            <div className="flex flex-col gap-7 animate-fadeIn">
              {/* Top Utility & Action Header (Hidden when printing) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIssuedBoardingPasses(null)
                      setBookingDetail(null)
                      setSearchParams({}, { replace: true })
                    }}
                    className="inline-flex items-center gap-1.5 text-xs md:text-sm text-subtle hover:text-ink transition-colors font-medium group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
                      arrow_back
                    </span>
                    <span>Kembali ke pesanan saya</span>
                  </button>
                  <span className="w-1 h-1 rounded-full bg-line" />
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-[16px] fill-current">check_circle</span>
                    <span>Check-in Berhasil</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-control bg-raised border border-line text-ink hover:bg-tint transition-colors text-xs font-semibold shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px] text-subtle">share</span>
                    <span>Kirim ke WhatsApp/Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-control bg-raised border border-line text-ink hover:bg-tint transition-colors text-xs font-semibold shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px] text-subtle">print</span>
                    <span>Cetak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadBoardingPassPDF()}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-1.5 px-4 h-10 rounded-control bg-brand hover:bg-brand-hover text-white transition-all text-xs font-semibold shadow-sm active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>Simpan boarding pass (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Print-Only Official Document Header */}
              <div className="hidden print:flex items-center justify-between border-b border-slate-200 pb-3 mb-1">
                <div>
                  <span className="text-base font-extrabold text-[#1D5BD6] tracking-tight">SkyBook Airlines</span>
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">
                    Official Boarding Pass • Kartu Masuk Pesawat Resmi
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Kode Reservasi (PNR)</span>
                  <span className="text-sm font-mono font-extrabold text-slate-900">{bookingDetail.booking_code}</span>
                </div>
              </div>

              {/* Live Status & Passenger Selectors (Hidden when printing) */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-1 border-b border-line print:hidden">
                {/* Passenger Switcher Tabs */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                  {bookingDetail.passengers.map((p, idx) => {
                    const isActive = idx === activeBoardingPassIndex
                    const pSeat = selectedSeats[p.id]?.seatNumber || p.seat_number || '14A'
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveBoardingPassIndex(idx)}
                        className={`flex items-center gap-2 pb-2.5 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
                          isActive
                            ? 'border-brand-fg text-ink'
                            : 'border-transparent text-subtle hover:text-ink'
                        }`}
                      >
                        <span>{p.full_name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            isActive
                              ? 'bg-brand/10 text-brand-fg'
                              : 'bg-panel text-subtle'
                          }`}
                        >
                          {pSeat}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Live Flight Status Bar */}
                <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-control bg-raised border border-line text-xs font-medium self-start lg:self-auto shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="font-semibold text-ink tabular-nums">
                      Boarding {boardingTimeDisplay.timeStr}
                    </span>
                    <span className="text-subtle">{boardingTimeDisplay.relativeStr}</span>
                  </div>
                  <div className="h-3 w-px bg-line" />
                  <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>Siap boarding</span>
                  </div>
                </div>
              </div>

              {/* ─── MAIN BOARDING PASS OUTER BLUE FRAME (FIGMA + DRIBBBLE HYBRID) ─── */}
              <div className="relative w-full p-2.5 md:p-3.5 rounded-[22px] bg-[#2468B8] dark:bg-[#194E94] shadow-[0_20px_48px_rgba(11,37,69,0.14)] print:shadow-none print-page-break-avoid">
                <div className="relative w-full bg-raised rounded-[16px] overflow-hidden flex flex-col xl:flex-row print:flex-row">
                  {/* ══════ LEFT SECTION: Main Flight, Destination Panorama & Passenger Grid ══════ */}
                  <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
                    {/* 1. DESTINATION CITY PANORAMA BANNER (Web UI & Print) */}
                    <div className="relative h-28 md:h-32 w-full overflow-hidden border-b border-line">
                      {/* Destination City Background Image */}
                      <img
                        src={destVisual.imageUrl}
                        alt={`Destinasi ${lastSeg?.destination?.city || destVisual.city}`}
                        className="absolute inset-0 w-full h-full object-cover object-center scale-[1.02]"
                      />
                      {/* Atmospheric Editorial Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0B2545]/90 via-[#0B2545]/70 to-[#0B2545]/45" />
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/45 to-transparent" />

                      {/* Airline Strip & Destination Info inside Banner */}
                      <div className="relative z-10 h-full px-6 md:px-8 py-4 flex items-center justify-between gap-4 text-white">
                        {/* Left: Airline Identity & Aircraft */}
                        <div className="flex items-center gap-3.5">
                          <AirlineLogo
                            code={flight?.airline?.code}
                            name={flight?.airline?.name}
                            logo={flight?.airline?.logo}
                            size="md"
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg md:text-xl text-white tracking-tight">
                                {flight?.airline?.name || 'Kenari Air'}
                              </span>
                              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-semibold tracking-wide text-sky-100">
                                <span className="material-symbols-outlined text-[12px]">location_on</span>
                                <span>{lastSeg?.destination?.city || destVisual.city}</span>
                              </span>
                            </div>
                            <span className="text-xs text-sky-100/90 mt-0.5">
                              Penerbangan {flight?.flight_number || 'KA 412'} • {flight?.airplane?.model || 'Boeing 737-800'}
                            </span>
                            <span className="text-[10px] text-sky-200/80 hidden sm:block mt-0.5">
                              {destVisual.landmarkName} • {destVisual.tagline}
                            </span>
                          </div>
                        </div>

                        {/* Right: Cabin Class Badge & Departure Date */}
                        <div className="text-right shrink-0 flex flex-col items-end">
                          <span className="px-3 py-1 rounded-full bg-white text-[#1D5BD6] text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider shadow-xs">
                            {activePassenger?.seat_class === 'business' ? 'KELAS BISNIS' : 'KELAS EKONOMI'}
                          </span>
                          <p className="text-xs font-semibold text-white mt-1.5 tabular-nums drop-shadow-2xs">
                            {formatIndoDate(firstSeg?.departure_time)}
                          </p>
                          <span className="text-[10px] text-sky-100/85 font-mono">
                            PNR: {bookingDetail.booking_code}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. ROUTE & TIMING SHOWCASE + DRIBBBLE CURVED FLIGHT ARC + LANDMARK WATERMARK */}
                    <div className="relative px-6 md:px-8 py-7 md:py-8 overflow-hidden">
                      {/* Subtle Destination Landmark Silhouette Watermark */}
                      <LandmarkWatermark
                        type={destVisual.landmarkType}
                        className="absolute inset-x-4 bottom-0 h-28 w-[calc(100%-2rem)] text-brand-fg opacity-[0.055] dark:opacity-[0.08]"
                      />

                      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        {/* Origin Column */}
                        <div className="md:col-span-4 flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-1">
                            Keberangkatan • Origin
                          </span>
                          <span className="text-4xl md:text-5xl font-extrabold text-ink leading-none tracking-tight">
                            {firstSeg?.origin?.code || 'CGK'}
                          </span>
                          <div className="mt-2 inline-flex items-center gap-1.5">
                            <span className="text-base md:text-lg font-extrabold text-brand-fg tabular-nums">
                              {formatTime(firstSeg?.departure_time)} WIB
                            </span>
                          </div>
                          <span className="text-sm font-bold text-ink mt-1">
                            {firstSeg?.origin?.city || 'Jakarta'}
                          </span>
                          <span className="text-xs text-subtle truncate">
                            {firstSeg?.origin?.name || "Soekarno-Hatta Int'l (T3)"}
                          </span>
                        </div>

                        {/* Center: Dribbble-Inspired Curved Flight Trajectory & Duration Pill */}
                        <div className="md:col-span-4 flex flex-col items-center justify-center px-1">
                          <span className="px-3 py-0.5 rounded-full bg-tint/80 border border-brand-fg/20 text-[11px] text-brand-fg font-bold mb-1.5 tabular-nums">
                            {firstSeg?.transit_duration_minutes
                              ? `${flightDurationStr} • Transit`
                              : `${flightDurationStr} • Langsung`}
                          </span>

                          {/* Curved Dashed Trajectory SVG with Plane Badge */}
                          <div className="relative w-full max-w-[230px] h-11 flex items-center justify-center">
                            <svg
                              viewBox="0 0 220 44"
                              className="w-full h-full overflow-visible"
                              aria-hidden="true"
                            >
                              {/* Soft Shadow Arc */}
                              <path
                                d="M 12 32 Q 110 4 208 32"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-line/70"
                              />
                              {/* Dashed Flight Arc */}
                              <path
                                d="M 12 28 Q 110 -4 208 28"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                                className="text-brand-fg"
                              />
                              {/* Origin Node */}
                              <circle cx="12" cy="28" r="4" className="fill-brand-fg" />
                              <circle cx="12" cy="28" r="7" className="fill-brand-fg/20" />
                              {/* Destination Node */}
                              <circle cx="208" cy="28" r="4" className="fill-signal" />
                              <circle cx="208" cy="28" r="7" className="fill-signal/20" />
                            </svg>

                            {/* Airplane Icon Badge at Curve Apex */}
                            <div className="absolute -top-0.5 w-8 h-8 rounded-full bg-tint border border-brand-fg/30 text-brand-fg flex items-center justify-center shadow-2xs">
                              <span className="material-symbols-outlined text-[18px] rotate-90">
                                flight
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold text-subtle uppercase tracking-[0.16em] mt-0.5">
                            {firstSeg?.transit_duration_minutes ? 'TRANSIT FLIGHT' : 'NON-STOP FLIGHT'}
                          </span>
                        </div>

                        {/* Destination Column */}
                        <div className="md:col-span-4 flex flex-col md:text-right md:items-end">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-1">
                            Tujuan • Destination
                          </span>
                          <span className="text-4xl md:text-5xl font-extrabold text-ink leading-none tracking-tight">
                            {lastSeg?.destination?.code || 'DPS'}
                          </span>
                          <div className="mt-2 inline-flex items-center gap-1.5">
                            <span className="text-base md:text-lg font-extrabold text-brand-fg tabular-nums">
                              {formatTime(lastSeg?.arrival_time)}{' '}
                              {lastSeg?.destination?.code === 'DPS' ? 'WITA' : destVisual.timezoneLabel}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-ink mt-1">
                            {lastSeg?.destination?.city || 'Denpasar Bali'}
                          </span>
                          <span className="text-xs text-subtle truncate max-w-full">
                            {lastSeg?.destination?.name || "Ngurah Rai Int'l (T1)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. TABULAR GRID OF 6 PASSENGER FLIGHT PARAMETERS (3 Columns x 2 Rows Spacious Grid) */}
                    <div className="px-6 md:px-8 pb-6 md:pb-7 pt-5 border-t border-line bg-panel/45">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-left items-stretch">
                        {/* Col 1: Passenger Name */}
                        <div className="flex flex-col justify-between p-3 rounded-control bg-raised/70 border border-line/70 min-h-[68px]">
                          <span className="text-[10px] uppercase font-bold text-subtle tracking-wider leading-tight">
                            Nama Penumpang
                          </span>
                          <div className="mt-1">
                            <span className="text-sm font-bold text-ink block leading-snug break-words">
                              {activePassenger?.full_name || 'Rina Wulandari'}
                            </span>
                            <span className="text-[11px] text-subtle block mt-0.5">Dewasa (ADT)</span>
                          </div>
                        </div>

                        {/* Col 2: Kursi (Seat) - Highlighted Orange/Coral */}
                        <div className="flex flex-col justify-between p-3 rounded-control bg-signal/[0.07] border border-signal/35 min-h-[68px]">
                          <span className="text-[10px] uppercase font-bold text-subtle tracking-wider leading-tight">
                            Kursi (Seat)
                          </span>
                          <div className="mt-0.5">
                            <span className="text-2xl font-black text-signal leading-none block tabular-nums">
                              {(activePassenger?.id
                                ? selectedSeats[activePassenger.id]?.seatNumber
                                : undefined) ||
                                activePassenger?.seat_number ||
                                '14A'}
                            </span>
                            <span className="text-[11px] text-subtle block mt-1 leading-tight">
                              Jendela • Depan Sayap
                            </span>
                          </div>
                        </div>

                        {/* Col 3: Pintu Masuk (Gate) */}
                        <div className="flex flex-col justify-between p-3 rounded-control bg-raised/70 border border-line/70 min-h-[68px]">
                          <span className="text-[10px] uppercase font-bold text-subtle tracking-wider leading-tight">
                            Pintu Masuk (Gate)
                          </span>
                          <div className="mt-1">
                            <span className="text-sm font-extrabold text-brand-fg block">
                              {activeBoardingPass?.gate
                                ? `Gate ${activeBoardingPass.gate.replace(/^Gate\s*/i, '')}`
                                : 'Menunggu FIDS'}
                            </span>
                            <span className="text-[11px] text-subtle block mt-0.5">Layar Terminal 3</span>
                          </div>
                        </div>

                        {/* Col 4: Waktu Boarding */}
                        <div className="flex flex-col justify-between p-3 rounded-control bg-raised/70 border border-line/70 min-h-[68px]">
                          <span className="text-[10px] uppercase font-bold text-subtle tracking-wider leading-tight">
                            Waktu Boarding
                          </span>
                          <div className="mt-1">
                            <span className="text-sm font-extrabold text-ink block tabular-nums">
                              {boardingTimeDisplay.timeStr}
                            </span>
                            <span className="text-[11px] font-semibold text-danger block mt-0.5">
                              30m sblm terbang
                            </span>
                          </div>
                        </div>

                        {/* Col 5: Zona Antrean */}
                        <div className="flex flex-col justify-between p-3 rounded-control bg-raised/70 border border-line/70 min-h-[68px]">
                          <span className="text-[10px] uppercase font-bold text-subtle tracking-wider leading-tight">
                            Zona Antrean
                          </span>
                          <div className="mt-1">
                            <span className="text-sm font-extrabold text-ink block">ZONA 2</span>
                            <span className="text-[11px] text-subtle block mt-0.5">Prioritas Reguler</span>
                          </div>
                        </div>

                        {/* Col 6: Jatah Bagasi */}
                        <div className="flex flex-col justify-between p-3 rounded-control bg-raised/70 border border-line/70 min-h-[68px]">
                          <span className="text-[10px] uppercase font-bold text-subtle tracking-wider leading-tight">
                            Jatah Bagasi
                          </span>
                          <div className="mt-1">
                            <span className="text-sm font-extrabold text-ink block">Kabin 7 kg</span>
                            <span className="text-[11px] text-subtle block mt-0.5">Bagasi 20 kg</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ══════ PERFORATION LINE & HALF-CIRCLE NOTCHES (Matches Outer Blue Frame) ══════ */}
                  <div className="hidden xl:flex print:flex relative flex-col items-center justify-between w-7 shrink-0 bg-raised select-none">
                    {/* Top Circular Notch in Blue Frame */}
                    <div className="w-7 h-7 rounded-full bg-[#2468B8] dark:bg-[#194E94] -mt-4 z-20" />
                    {/* Vertical Dashed Perforation Line */}
                    <div className="h-full border-r-2 border-dashed border-line my-1" />
                    {/* Bottom Circular Notch in Blue Frame */}
                    <div className="w-7 h-7 rounded-full bg-[#2468B8] dark:bg-[#194E94] -mb-4 z-20" />
                  </div>

                  {/* Mobile / Tablet Horizontal Perforation Divider */}
                  <div className="xl:hidden print:hidden relative flex items-center justify-between h-6 w-full bg-raised">
                    <div className="w-6 h-6 rounded-full bg-[#2468B8] dark:bg-[#194E94] -ml-3 z-20" />
                    <div className="w-full border-b-2 border-dashed border-line mx-2" />
                    <div className="w-6 h-6 rounded-full bg-[#2468B8] dark:bg-[#194E94] -mr-3 z-20" />
                  </div>

                  {/* ══════ RIGHT STUB: Gate Scan & Validation Section (Figma Stub) ══════ */}
                  <div className="xl:w-[330px] print:w-[270px] bg-panel/75 p-6 md:p-7 flex flex-col justify-between items-center text-center relative">
                    {/* Stub Header */}
                    <div className="w-full flex items-center justify-between pb-3 border-b border-line text-left">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-subtle block">
                          PASS STUB
                        </span>
                        <span className="text-xs font-extrabold text-ink">
                          {flight?.flight_number || 'KA 412'} •{' '}
                          {(flight?.airline?.name || 'Kenari').split(' ')[0]}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded bg-tint text-brand-fg text-[10px] font-extrabold uppercase tracking-wider">
                        {activePassenger?.seat_class === 'business' ? 'BUSINESS' : 'ECONOMY'}
                      </span>
                    </div>

                    {/* High-Contrast Gate Machine QR Code with Click-to-Zoom */}
                    <div
                      onClick={() => setIsQrModalOpen(true)}
                      className="my-4 p-3.5 bg-white rounded-control shadow-2xs border border-line flex flex-col items-center cursor-pointer group/qr transition-transform hover:scale-105 duration-200"
                      title="Klik untuk memperbesar QR code boarding pass"
                    >
                      <div className="w-36 h-36 flex items-center justify-center p-1 bg-white rounded border border-slate-100">
                        <RealQrCode
                          value={
                            activeBoardingPass?.boarding_pass_code ||
                            (bookingDetail
                              ? `BP-${bookingDetail.booking_code}-${activePassenger?.id}`
                              : '')
                          }
                          size={138}
                          alt="Boarding Pass QR Code"
                        />
                      </div>
                      <div className="mt-1.5 text-[10px] font-semibold text-slate-600 flex items-center gap-1 print:hidden">
                        <span className="material-symbols-outlined text-[13px]">zoom_in</span>
                        <span>Perbesar QR Gerbang</span>
                      </div>
                    </div>

                    {/* Boarding Reference & PNR */}
                    <div className="w-full flex flex-col items-center">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-subtle">
                        BOARDING REFERENCE
                      </span>
                      <span className="text-base font-mono font-extrabold text-ink tracking-wider mt-0.5">
                        {activeBoardingPass?.boarding_pass_code ||
                          `BP-${bookingDetail.booking_code}-${activePassenger?.id}`}
                      </span>
                      <span className="text-xs text-subtle mt-0.5">
                        Kode PNR:{' '}
                        <strong className="text-ink font-mono">{bookingDetail.booking_code}</strong>
                      </span>
                      <p className="text-[11px] text-subtle mt-2 max-w-[230px] leading-relaxed">
                        Tingkatkan kecerahan layar ke tingkat maksimal saat pemindaian mesin gerbang.
                      </p>
                    </div>

                    {/* Authentic Physical 1D Barcode Simulation */}
                    <div className="w-full pt-3 mt-3 border-t border-line flex flex-col items-center">
                      <div className="w-full h-7 flex items-stretch justify-center gap-[2px] opacity-85">
                        <span className="w-[3px] bg-ink" />
                        <span className="w-[1px] bg-ink" />
                        <span className="w-[2px] bg-ink" />
                        <span className="w-[4px] bg-ink" />
                        <span className="w-[1px] bg-ink" />
                        <span className="w-[3px] bg-ink" />
                        <span className="w-[2px] bg-ink" />
                        <span className="w-[1px] bg-ink" />
                        <span className="w-[4px] bg-ink" />
                        <span className="w-[2px] bg-ink" />
                        <span className="w-[1px] bg-ink" />
                        <span className="w-[3px] bg-ink" />
                        <span className="w-[2px] bg-ink" />
                        <span className="w-[1px] bg-ink" />
                        <span className="w-[3px] bg-ink" />
                        <span className="w-[4px] bg-ink" />
                        <span className="w-[1px] bg-ink" />
                        <span className="w-[2px] bg-ink" />
                        <span className="w-[3px] bg-ink" />
                      </div>
                      <span className="text-[10px] font-mono text-subtle tracking-widest mt-1 tabular-nums">
                        412093{bookingDetail.booking_id}
                        {activePassenger?.id || 1}0471
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Essential Travel Reminders Matrix (3 Cards below ticket) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print-page-break-avoid">
                <div className="p-5 rounded-ticket bg-raised border border-line shadow-2xs flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-control bg-tint flex-shrink-0 flex items-center justify-center text-brand-fg">
                    <span className="material-symbols-outlined text-[22px]">apartment</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-ink">Terminal 3 Domestik</span>
                    <p className="text-xs text-subtle mt-1 leading-relaxed">
                      Masuk melalui Pintu Keberangkatan 2. Lanjutkan pemeriksaan keamanan Security Check Point 2 (SCP2).
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-ticket bg-raised border border-line shadow-2xs flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-control bg-tint flex-shrink-0 flex items-center justify-center text-signal">
                    <span className="material-symbols-outlined text-[22px]">timer</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-ink">Batas Masuk Gerbang</span>
                    <p className="text-xs text-subtle mt-1 leading-relaxed">
                      Gerbang keberangkatan ditutup tepat 15 menit sebelum takeoff pada pukul{' '}
                      <strong className="text-ink font-mono tabular-nums">
                        {formatTime(firstSeg?.departure_time)} WIB
                      </strong>.
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-ticket bg-raised border border-line shadow-2xs flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-control bg-tint flex-shrink-0 flex items-center justify-center text-brand-fg">
                    <span className="material-symbols-outlined text-[22px]">badge</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-ink">Ketentuan Identitas</span>
                    <p className="text-xs text-subtle mt-1 leading-relaxed">
                      Wajib menunjukkan fisik asli e-KTP, SIM, atau Paspor yang valid dan cocok dengan nama tiket.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Secondary Actions (Hidden when printing) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-line print:hidden">
                <div className="flex items-center gap-2 text-subtle text-xs">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>Dokumen resmi diterbitkan langsung oleh {flight?.airline?.name || 'maskapai'} via SkyBook Network.</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Link
                    to="/bookings"
                    className="w-full sm:w-auto text-center px-5 h-11 rounded-control bg-raised border border-line text-ink hover:bg-tint transition-colors text-xs font-semibold flex items-center justify-center"
                  >
                    Kembali ke pesanan
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDownloadBoardingPassPDF()}
                    disabled={downloadingPdf}
                    className="w-full sm:w-auto px-5 h-11 rounded-control bg-brand hover:bg-brand-hover text-white transition-all text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>Simpan boarding pass (PDF)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              CASE 3: ACTIVE CHECK-IN FLOW (STITCH B11)
             ───────────────────────────────────────────────────────────── */}
          {bookingDetail && (!issuedBoardingPasses || issuedBoardingPasses.length === 0) && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Top Navigation & Flight Metadata Badge */}
              <div className="flex flex-col gap-2 mb-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingDetail(null)
                      setSearchParams({}, { replace: true })
                    }}
                    className="inline-flex items-center gap-1.5 text-subtle hover:text-ink transition-colors text-xs md:text-sm font-medium group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
                      arrow_back
                    </span>
                    <span>Kembali ke pilihan pesanan</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-subtle text-[11px] font-semibold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sistem Check-in Terbuka</span>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h1 className="text-2xl md:text-3xl font-bold text-ink">Check-in online</h1>
                      <span className="bg-panel border border-line text-ink px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
                        {flight?.airline?.name || 'SkyBook'} {flight?.flight_number}
                      </span>
                      {isDelayed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-danger/10 text-danger text-xs font-semibold">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          <span>Tertunda {flight?.delay_minutes} menit</span>
                        </span>
                      )}
                      {isFlightCancelled && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-danger/10 text-danger text-xs font-bold">
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          <span>Penerbangan Dibatalkan</span>
                        </span>
                      )}
                    </div>
                    <p className="text-subtle text-sm flex items-center gap-2">
                      <span className="font-semibold text-ink">{firstSeg?.origin?.city || 'Jakarta'} ({firstSeg?.origin?.code || 'CGK'})</span>
                      <span className="material-symbols-outlined text-brand-fg text-[16px]">arrow_forward</span>
                      <span className="font-semibold text-ink">{lastSeg?.destination?.city || 'Denpasar'} ({lastSeg?.destination?.code || 'DPS'})</span>
                    </p>
                  </div>

                  <div className="bg-raised border border-line px-4 py-2.5 rounded-control shadow-2xs flex items-center gap-3">
                    <div className="w-8 h-8 rounded-control bg-tint flex items-center justify-center text-brand-fg">
                      <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                    </div>
                    <div>
                      <div className="text-[10px] text-subtle uppercase font-bold tracking-wider">Jadwal Keberangkatan</div>
                      <div className="text-xs font-semibold text-ink tabular-nums">
                        {formatIndoDate(firstSeg?.departure_time)} • {formatTime(firstSeg?.departure_time)} WIB
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CANCELLED FLIGHT ADVISORY (Revisi data real) */}
              {isFlightCancelled && (
                <div className="p-5 rounded-ticket bg-danger/10 border border-danger/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 text-danger">
                    <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">cancel</span>
                    <div>
                      <h3 className="text-sm font-bold">Penerbangan Ini Telah Dibatalkan</h3>
                      <p className="text-xs text-danger/90 mt-0.5 leading-relaxed">
                        Penerbangan dibatalkan oleh pihak maskapai. Check-in online tidak dapat diproses. Anda berhak mendapatkan pengembalian dana 100% penuh.
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/bookings/${bookingDetail.booking_id}`}
                    className="px-5 h-10 bg-danger hover:bg-danger/90 text-white rounded-control text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <span>Ajukan Refund Penuh</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              )}

              {/* TIMING NOT IN WINDOW ADVISORY */}
              {isTooEarlyForCheckIn && !isFlightCancelled && (
                <div className="p-5 rounded-ticket bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-800 dark:text-amber-400">
                  <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">hourglass_top</span>
                  <div>
                    <h3 className="text-sm font-bold">Check-in Belum Dibuka</h3>
                    <p className="text-xs leading-relaxed mt-0.5">
                      Check-in online mandiri akan dibuka tepat 24 jam sebelum keberangkatan. Mohon kembali saat jendela check-in telah dibuka.
                    </p>
                  </div>
                </div>
              )}

              {isTooLateForCheckIn && !isFlightCancelled && (
                <div className="p-5 rounded-ticket bg-danger/10 border border-danger/20 flex items-start gap-3 text-danger">
                  <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">schedule</span>
                  <div>
                    <h3 className="text-sm font-bold">Check-in Online Mandiri Telah Ditutup</h3>
                    <p className="text-xs leading-relaxed mt-0.5">
                      Check-in online ditutup 60 menit sebelum keberangkatan sesuai regulasi penerbangan. Silakan lakukan check-in langsung di counter maskapai di bandara.
                    </p>
                  </div>
                </div>
              )}

              {/* ─── Main Workspace (8 cols Left / 4 cols Right Disciplined Grid) ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                  {/* Urgent Flight Timing Progress Card */}
                  <div className="bg-raised border border-line rounded-ticket p-5 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-brand-fg">
                        <span className="material-symbols-outlined text-[20px]">schedule</span>
                        <span className="font-bold text-sm">
                          Check-in ditutup dalam{' '}
                          <span className="font-mono tabular-nums">
                            {timeUntilCheckInCloses.hours}j {timeUntilCheckInCloses.minutes}m
                          </span>
                        </span>
                      </div>
                      <span className="text-xs text-subtle font-mono tabular-nums">
                        Batas {firstSeg?.departure_time ? formatTime(new Date(new Date(firstSeg.departure_time).getTime() - 60 * 60 * 1000).toISOString()) : '06.40'} WIB
                      </span>
                    </div>
                    <p className="text-xs text-subtle mb-3 leading-relaxed">
                      Check-in online mandiri ditutup tepat 60 menit sebelum keberangkatan sesuai regulasi penerbangan sipil.
                    </p>
                    {/* Azure Progress Bar */}
                    <div className="w-full bg-panel h-1.5 rounded-full overflow-hidden border border-line/40">
                      <div
                        className="bg-brand-fg h-full rounded-full transition-all duration-500"
                        style={{ width: `${checkInWindowProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Passenger Selection Area */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-ink">
                        Pilih Penumpang &amp; Konfigurasi Kursi
                      </h2>
                      <span className="text-xs text-subtle">
                        {checkedPassengerIds.length} dari {bookingDetail.passengers.length} Penumpang terpilih
                      </span>
                    </div>

                    {/* Passenger Items */}
                    {bookingDetail.passengers.map((p) => {
                      const isChecked = checkedPassengerIds.includes(p.id)
                      const isEditing = activeEditingPaxId === p.id
                      const seatInfo = selectedSeats[p.id]
                      const seatDisplay = seatInfo?.seatNumber || p.seat_number || 'Belum dipilih'

                      return (
                        <div
                          key={p.id}
                          className={`rounded-ticket border transition-all duration-200 p-4 md:p-5 ${
                            isChecked
                              ? 'bg-tint/40 border-brand-fg/30'
                              : 'bg-panel border-line opacity-75'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                              {/* Selection Checkbox */}
                              <label className="pt-0.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={p.is_checked_in || isFlightCancelled}
                                  onChange={() => handleTogglePassenger(p.id)}
                                  className="w-5 h-5 rounded-sm border-line text-brand-fg focus:ring-brand-fg/20 cursor-pointer disabled:opacity-40"
                                />
                              </label>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-ink">{p.full_name}</span>
                                  <span className="bg-panel border border-line text-subtle text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                    {p.seat_class === 'business' ? 'Bisnis' : 'Dewasa'}
                                  </span>
                                  {p.is_checked_in && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      <span className="material-symbols-outlined text-[14px]">check</span>
                                      <span>Sudah Check-in</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-subtle font-mono">
                                  <span>{p.id_number}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 font-sans">
                                    <span className="material-symbols-outlined text-[14px]">luggage</span>
                                    Kabin 7 kg + Bagasi 20 kg
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto">
                              <div className="flex items-center gap-1.5 bg-raised border border-line px-3 py-1.5 rounded-control shadow-2xs">
                                <span className="material-symbols-outlined text-brand-fg text-[18px]">
                                  airline_seat_recline_extra
                                </span>
                                <span className="font-mono font-bold text-xs text-ink">{seatDisplay}</span>
                                <span className="text-[11px] text-subtle">(Jendela)</span>
                              </div>

                              {!p.is_checked_in && !isFlightCancelled && (
                                <button
                                  type="button"
                                  onClick={() => setActiveEditingPaxId(isEditing ? null : p.id)}
                                  className="text-brand-fg font-semibold text-xs hover:underline transition-all"
                                >
                                  {isEditing ? 'Tutup kursi' : 'Ganti kursi'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ─── Inline Compact Seat Map Module ─── */}
                          {isEditing && (
                            <div className="mt-4 pt-4 border-t border-line bg-raised rounded-control p-4 shadow-2xs animate-fadeIn">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 mb-3 border-b border-line">
                                <div>
                                  <div className="text-xs font-bold text-ink">Pilih Kursi Penerbangan</div>
                                  <p className="text-[11px] text-subtle">
                                    Klik kursi untuk mengganti posisi penumpang {p.full_name}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-subtle">
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-xs bg-signal" />
                                    <span className="text-[11px]">Terpilih</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-xs bg-raised border border-line" />
                                    <span className="text-[11px]">Tersedia</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-xs bg-line flex items-center justify-center text-[8px] text-subtle">×</div>
                                    <span className="text-[11px]">Terisi</span>
                                  </div>
                                </div>
                              </div>

                              {/* Matrix Layout */}
                              <div className="max-w-md mx-auto py-2">
                                {/* Column Labels Header */}
                                <div className="grid grid-cols-7 gap-1.5 text-center font-mono font-bold text-xs text-subtle mb-2">
                                  <div>A</div>
                                  <div>B</div>
                                  <div>C</div>
                                  <div className="text-[9px] uppercase tracking-wider text-subtle/80 flex items-center justify-center">
                                    Lorong
                                  </div>
                                  <div>D</div>
                                  <div>E</div>
                                  <div>F</div>
                                </div>

                                {/* Seat Rows */}
                                <div className="flex flex-col gap-1.5">
                                  {seatMatrix.map((row) => (
                                    <div key={row.rowNum} className="grid grid-cols-7 gap-1.5 items-center">
                                      {/* Left 3 seats: A, B, C */}
                                      {row.left.map((st) => {
                                        const isCurrent = seatInfo?.seatNumber === st.seatNumber
                                        if (isCurrent) {
                                          return (
                                            <div
                                              key={st.seatNumber}
                                              className="h-9 rounded-control bg-signal text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs ring-2 ring-signal/30"
                                            >
                                              <span className="material-symbols-outlined text-[16px]">check</span>
                                            </div>
                                          )
                                        }
                                        if (!st.isAvailable) {
                                          return (
                                            <div
                                              key={st.seatNumber}
                                              className="h-9 rounded-control bg-panel border border-line text-subtle/50 flex items-center justify-center font-mono text-xs cursor-not-allowed"
                                            >
                                              ×
                                            </div>
                                          )
                                        }
                                        return (
                                          <button
                                            key={st.seatNumber}
                                            type="button"
                                            onClick={() => handleSelectSeat(p.id, { id: st.id, seat_number: st.seatNumber, seat_class: p.seat_class, is_available: true })}
                                            className="h-9 rounded-control bg-raised hover:bg-tint border border-line hover:border-brand-fg text-ink font-mono font-semibold text-xs flex items-center justify-center transition-colors"
                                          >
                                            {st.seatNumber}
                                          </button>
                                        )
                                      })}

                                      {/* Aisle Row Number */}
                                      <div className="text-center font-mono text-xs text-subtle font-bold">
                                        {row.rowNum}
                                      </div>

                                      {/* Right 3 seats: D, E, F */}
                                      {row.right.map((st) => {
                                        const isCurrent = seatInfo?.seatNumber === st.seatNumber
                                        if (isCurrent) {
                                          return (
                                            <div
                                              key={st.seatNumber}
                                              className="h-9 rounded-control bg-signal text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs ring-2 ring-signal/30"
                                            >
                                              <span className="material-symbols-outlined text-[16px]">check</span>
                                            </div>
                                          )
                                        }
                                        if (!st.isAvailable) {
                                          return (
                                            <div
                                              key={st.seatNumber}
                                              className="h-9 rounded-control bg-panel border border-line text-subtle/50 flex items-center justify-center font-mono text-xs cursor-not-allowed"
                                            >
                                              ×
                                            </div>
                                          )
                                        }
                                        return (
                                          <button
                                            key={st.seatNumber}
                                            type="button"
                                            onClick={() => handleSelectSeat(p.id, { id: st.id, seat_number: st.seatNumber, seat_class: p.seat_class, is_available: true })}
                                            className="h-9 rounded-control bg-raised hover:bg-tint border border-line hover:border-brand-fg text-ink font-mono font-semibold text-xs flex items-center justify-center transition-colors"
                                          >
                                            {st.seatNumber}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-2 text-center text-[10px] text-subtle">
                                Standard Economy • Jarak Antar Kursi 30" (76 cm) • Recline 3"
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Confirmation & Regulatory Declaration Panel */}
                  <div className="bg-raised border border-line rounded-ticket p-5 shadow-2xs flex flex-col gap-4">
                    <div className="flex items-center gap-2.5 bg-panel p-3 rounded-control text-ink text-xs">
                      <span className="material-symbols-outlined text-brand-fg text-[20px] shrink-0">
                        airline_seat_recline_normal
                      </span>
                      <span>
                        Kursi terverifikasi untuk <strong>{checkedPassengerIds.length} penumpang</strong>:{' '}
                        {checkedPassengerIds
                          .map((id) => selectedSeats[id]?.seatNumber || 'Kursi Otomatis')
                          .join(', ')}
                      </span>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAgreed}
                        onChange={(e) => setIsAgreed(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded-xs border-line text-brand-fg focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs text-subtle leading-relaxed">
                        Saya menyatakan bahwa seluruh data penumpang sesuai dengan identitas resmi (KTP/Paspor) yang sah dan saya menyetujui ketentuan keselamatan barang bawaan berbahaya (<em>Dangerous Goods Regulation</em>).
                      </span>
                    </label>
                  </div>

                  {/* Primary Action Button */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting || !isAgreed || checkedPassengerIds.length === 0 || !isCheckInWindowOpen}
                      onClick={handleCompleteCheckIn}
                      className="w-full h-12 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-control font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Menerbitkan Boarding Pass...</span>
                        </>
                      ) : (
                        <>
                          <span>Selesaikan check-in</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </>
                      )}
                    </button>
                    <div className="flex items-center justify-center gap-1.5 text-subtle text-xs py-1">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">verified_user</span>
                      <span>Enkripsi sertifikat boarding pass IATA standar aviasi internasional</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Sticky Rules & Flight Requirements (4 cols / ~360px) */}
                <div className="lg:col-span-4 flex flex-col gap-5 sticky top-[92px]">
                  {/* Info Rules Panel */}
                  <div className="bg-raised border border-line rounded-ticket p-5 shadow-2xs">
                    <div className="flex items-center gap-2 pb-3 mb-3 border-b border-line text-ink">
                      <span className="material-symbols-outlined text-brand-fg text-[20px]">info</span>
                      <h3 className="font-bold text-sm">Aturan Check-in Online</h3>
                    </div>
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-subtle">Batas Waktu</span>
                        <p className="text-ink leading-relaxed">
                          Check-in dibuka hingga 1 jam sebelum jadwal terbang (
                          <strong className="font-mono tabular-nums">
                            {formatIndoDate(firstSeg?.departure_time)}, {firstSeg?.departure_time ? formatTime(new Date(new Date(firstSeg.departure_time).getTime() - 60 * 60 * 1000).toISOString()) : '06.40'} WIB
                          </strong>).
                        </p>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-subtle">Boarding Pass</span>
                        <p className="text-ink leading-relaxed">
                          Langsung terbit seketika setelah check-in berhasil dan dapat diunduh dalam format PDF atau dicetak langsung.
                        </p>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-subtle">Pemeriksaan Gerbang</span>
                        <p className="text-ink leading-relaxed">
                          Tunjukkan boarding pass digital dan kartu identitas fisik di gerbang keberangkatan Terminal 3 Domestik.
                        </p>
                      </div>

                      <div className="flex flex-col gap-0.5 bg-panel p-2.5 rounded-control">
                        <span className="text-[10px] uppercase font-bold text-brand-fg">Bagasi Tercatat</span>
                        <p className="text-ink leading-relaxed mt-0.5">
                          Bagi penumpang dengan bagasi tercatat, silakan lapor di counter drop bagasi sebelum{' '}
                          <strong className="font-mono tabular-nums">
                            {firstSeg?.departure_time ? formatTime(new Date(new Date(firstSeg.departure_time).getTime() - 50 * 60 * 1000).toISOString()) : '06.50'} WIB
                          </strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Prohibited Items & Dangerous Goods Regulation */}
                  <div className="bg-raised border border-line rounded-ticket p-5 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2 text-danger">
                      <span className="material-symbols-outlined text-[20px]">warning</span>
                      <h4 className="font-bold text-xs text-ink">Ketentuan Bagasi Aman</h4>
                    </div>
                    <p className="text-xs text-subtle mb-3 leading-relaxed">
                      Dilarang membawa barang berbahaya dalam kabin maupun tercatat sesuai standar keselamatan penerbangan ICAO:
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-panel p-2 rounded-control flex flex-col items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-subtle text-[20px]">battery_alert</span>
                        <span className="text-[10px] font-semibold text-ink leading-tight">Powerbank &gt;20k mAh</span>
                      </div>
                      <div className="bg-panel p-2 rounded-control flex flex-col items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-subtle text-[20px]">propane_tank</span>
                        <span className="text-[10px] font-semibold text-ink leading-tight">Gas Kompresi</span>
                      </div>
                      <div className="bg-panel p-2 rounded-control flex flex-col items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-subtle text-[20px]">water_drop</span>
                        <span className="text-[10px] font-semibold text-ink leading-tight">Cairan &gt;100 ml</span>
                      </div>
                    </div>
                  </div>

                  {/* Flight Detail Summary Card */}
                  <div className="bg-panel border border-line rounded-ticket p-4 flex items-center justify-between text-ink">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-brand-fg text-[24px]">flight</span>
                      <div>
                        <div className="text-xs font-bold">{flight?.airplane?.model || 'Boeing 737-800NG'}</div>
                        <div className="text-[11px] text-subtle">Konfigurasi Kabin 3-3</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-raised border border-line text-brand-fg">
                      {isDelayed ? 'Tertunda' : 'On Time'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ─── MODAL 1: HIGH RESOLUTION QR ZOOM DIALOG ─── */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="bg-white text-slate-900 rounded-ticket max-w-sm w-full p-6 text-center shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
              Validasi Pemindai Gerbang
            </span>
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Boarding Pass QR Code
            </h3>

            <div className="p-4 bg-white rounded-control border border-slate-200 inline-block mb-4 shadow-sm">
              <RealQrCode
                value={activeBoardingPass?.boarding_pass_code || (bookingDetail ? `BP-${bookingDetail.booking_code}-${activePassenger?.id}` : '')}
                size={224}
                border={2}
                alt="Enlarged Boarding Pass QR Code"
              />
            </div>

            <div className="text-xs font-mono font-bold text-slate-800">
              {activeBoardingPass?.boarding_pass_code || `BP-${bookingDetail?.booking_code}-${activePassenger?.id}`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {activePassenger?.full_name} • Kursi {(activePassenger?.id ? selectedSeats[activePassenger.id]?.seatNumber : undefined) || activePassenger?.seat_number || '14A'}
            </div>
            <p className="text-[11px] text-slate-500 mt-3 border-t border-slate-100 pt-3">
              Tingkatkan kecerahan layar smartphone Anda ke tingkat 100% untuk pembacaan optimal sensor barcode bandara.
            </p>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SHARE MODAL ─── */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="bg-raised border border-line text-ink rounded-ticket max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 text-subtle hover:text-ink transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-control bg-tint text-brand-fg flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">share</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Bagikan Boarding Pass</h3>
                <p className="text-xs text-subtle">Kirim ke ponsel atau perangkat lain</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 my-4">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  showToast('Tautan boarding pass disalin ke clipboard!')
                  setIsShareModalOpen(false)
                }}
                className="w-full h-11 px-4 rounded-control bg-panel border border-line hover:border-brand-fg text-ink text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-subtle">content_copy</span>
                  <span>Salin Tautan Boarding Pass</span>
                </div>
                <span className="text-[11px] text-brand-fg font-bold">Salin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const text = `Boarding Pass SkyBook untuk penerbangan ${flight?.flight_number} (${firstSeg?.origin?.code} ke ${lastSeg?.destination?.code}). Kode PNR: ${bookingDetail?.booking_code}`
                  window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + window.location.href)}`, '_blank')
                  setIsShareModalOpen(false)
                }}
                className="w-full h-11 px-4 rounded-control bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#128C7E] dark:text-[#25D366] text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                <span>Kirim via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast('Boarding pass telah dikirimkan ke alamat email terdaftar Anda.')
                  setIsShareModalOpen(false)
                }}
                className="w-full h-11 px-4 rounded-control bg-panel border border-line hover:border-brand-fg text-ink text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-subtle">mail</span>
                <span>Kirim Ulang ke Email Terdaftar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FLOATING OPERATIONAL TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <aside
          aria-label="Notifikasi sistem"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-ink text-page px-4 py-3 rounded-control shadow-xl transition-all animate-bounce"
        >
          <div className="w-6 h-6 rounded-full bg-page text-ink flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[16px]">check</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-page">{toastMessage}</span>
          </div>
          <button
            aria-label="Tutup notifikasi"
            onClick={() => setToastMessage(null)}
            className="text-subtle hover:text-page ml-2"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </aside>
      )}

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
