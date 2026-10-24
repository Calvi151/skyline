import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import SeatMap from '../../components/booking/SeatMap'
import { useAuthStore } from '../../store/authStore'
import { useBookingStore, PassengerData } from '../../store/bookingStore'
import { api } from '../../lib/api'

interface BaggageOption {
  id: number
  name: string
  weight_kg: number
  price: number | string
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const passengersCountParam = Math.max(1, Number(searchParams.get('passengers') || 1))
  const cabinClassParam = (searchParams.get('class') || 'economy') as 'economy' | 'business'

  // Booking store
  const {
    currentStep,
    setCurrentStep,
    passengers,
    setPassengers,
    updatePassenger,
    activePassengerIndex,
    setActivePassengerIndex,
  } = useBookingStore()

  // Local state
  const [flight, setFlight] = useState<any | null>(null)
  const [baggageOptions, setBaggageOptions] = useState<BaggageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Auth gate check
  useEffect(() => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    }
  }, [user, navigate])

  // Initialize passengers array if count changed
  useEffect(() => {
    if (passengers.length !== passengersCountParam) {
      const initial: PassengerData[] = []
      for (let i = 0; i < passengersCountParam; i++) {
        initial.push({
          full_name: '',
          id_number: '',
          birth_date: '1995-05-18',
          gender: 'male',
          seat_class: cabinClassParam,
          seat_id: null,
          seat_number: null,
          baggage_option_id: null,
          baggage_name: null,
          baggage_price: 0,
        })
      }
      setPassengers(initial)
    }
  }, [passengersCountParam, cabinClassParam, passengers.length, setPassengers])

  // Load Flight detail & Baggage options
  const loadFlightAndBaggage = async () => {
    if (!id) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const [flightRes, baggageRes] = await Promise.all([
        api.get<{ data: any }>(`/flights/${id}`),
        api.get<{ data: BaggageOption[] }>('/baggage-options').catch(() => ({ data: [] })),
      ])

      if (flightRes?.data) {
        setFlight(flightRes.data)
      } else {
        setErrorMsg('Data penerbangan tidak ditemukan.')
      }

      if (Array.isArray(baggageRes?.data)) {
        setBaggageOptions(baggageRes.data)
      }
    } catch (err: any) {
      console.error('Failed to load flight detail:', err)
      setErrorMsg(err?.message || 'Gagal memuat jadwal penerbangan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFlightAndBaggage()
  }, [id])

  // Selected seats map across passengers: { [passengerIndex]: { id, number, isEmergency } }
  const selectedSeatsByPassenger = useMemo(() => {
    const map: { [pIndex: number]: { id: number; number: string; isEmergency?: boolean } | null } = {}
    passengers.forEach((p, idx) => {
      if (p.seat_id && p.seat_number) {
        const rowNum = parseInt(p.seat_number, 10)
        map[idx] = {
          id: p.seat_id,
          number: p.seat_number,
          isEmergency: rowNum === 14 || rowNum === 15,
        }
      } else {
        map[idx] = null
      }
    })
    return map
  }, [passengers])

  // Calculate pricing breakdown
  const pricing = useMemo(() => {
    if (!flight) return { baseFare: 0, totalBaseFare: 0, seatsFee: 0, baggageFee: 0, total: 0 }

    const baseFarePerPax =
      cabinClassParam === 'business' && flight.price_business
        ? flight.price_business
        : flight.price_economy || 0

    const totalBaseFare = baseFarePerPax * passengers.length

    // Emergency exit seats fee (+Rp 90.000 each)
    let seatsFee = 0
    passengers.forEach((p) => {
      if (p.seat_number) {
        const rowNum = parseInt(p.seat_number, 10)
        if (rowNum === 14 || rowNum === 15) {
          seatsFee += 90000
        }
      }
    })

    // Baggage fee
    let baggageFee = 0
    passengers.forEach((p) => {
      if (p.baggage_price) {
        baggageFee += Number(p.baggage_price)
      }
    })

    return {
      baseFarePerPax,
      totalBaseFare,
      seatsFee,
      baggageFee,
      total: totalBaseFare + seatsFee + baggageFee,
    }
  }, [flight, cabinClassParam, passengers])

  // Validation: Check if Step 1 is complete
  const isPassengerComplete = (p: PassengerData) => {
    return (
      p.full_name.trim().length >= 2 &&
      p.id_number.trim().length >= 6 &&
      Boolean(p.birth_date) &&
      Boolean(p.gender)
    )
  }

  const allPassengersComplete = useMemo(() => {
    return passengers.every(isPassengerComplete)
  }, [passengers])

  // Proceed from Step 1 to Step 2
  const handleProceedToSeats = (e: React.FormEvent) => {
    e.preventDefault()
    if (!allPassengersComplete) {
      setBookingError('Mohon lengkapi data seluruh penumpang sebelum melanjutkan.')
      return
    }
    setBookingError(null)
    setCurrentStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Seat selection handler
  const handleSelectSeat = (seat: { id: number; number: string; isEmergency: boolean } | null) => {
    updatePassenger(activePassengerIndex, {
      seat_id: seat ? seat.id : null,
      seat_number: seat ? seat.number : null,
    })
  }

  // Baggage selection handler
  const handleSelectBaggage = (option: BaggageOption | null) => {
    updatePassenger(activePassengerIndex, {
      baggage_option_id: option ? option.id : null,
      baggage_name: option ? option.name : null,
      baggage_price: option ? Number(option.price) : 0,
    })
  }

  // Final submit booking (POST /api/bookings)
  const handleCreateBooking = async () => {
    setBookingSubmitting(true)
    setBookingError(null)

    // Verify email guard
    if (user && user.email_verified === false) {
      setBookingError(
        'Email Anda belum terverifikasi. Silakan cek email dan verifikasi akun sebelum memesan tiket.'
      )
      setBookingSubmitting(false)
      return
    }

    try {
      // Find fallback seat if passenger chose "Pilih kursi saat check-in"
      const payloadPassengers = passengers.map((p, idx) => {
        let seatId = p.seat_id
        if (!seatId && flight?.seats) {
          // Auto assign first available seat not chosen
          const chosenIds = passengers.map((x) => x.seat_id).filter(Boolean)
          const availSeat = flight.seats.find(
            (s: any) => s.is_available && !chosenIds.includes(s.id)
          )
          seatId = availSeat ? availSeat.id : flight.seats[idx]?.id || 1
        }

        return {
          full_name: p.full_name.trim(),
          id_number: p.id_number.trim(),
          birth_date: p.birth_date,
          gender: p.gender,
          seat_class: cabinClassParam,
          seat_id: seatId,
          baggage_option_id: p.baggage_option_id || null,
        }
      })

      const res: any = await api.post('/bookings', {
        flight_schedule_id: Number(id),
        passengers: payloadPassengers,
      })

      if (res?.data?.id) {
        navigate(`/checkout/${res.data.id}`)
      } else {
        setBookingError('Gagal memproses pemesanan tiket.')
      }
    } catch (err: any) {
      console.error('Booking failed:', err)
      if (err?.code === 'SEAT_NOT_AVAILABLE') {
        setBookingError(err.message || 'Kursi yang dipilih baru saja dipesan. Silakan pilih kursi lain.')
        // Reload seat map
        loadFlightAndBaggage()
      } else if (err?.code === 'FLIGHT_CANCELLED') {
        setBookingError('Penerbangan ini dibatalkan oleh maskapai.')
      } else {
        setBookingError(err?.message || 'Terjadi kesalahan saat memproses pesanan.')
      }
    } finally {
      setBookingSubmitting(false)
    }
  }

  const formatRupiah = (val?: number | null) =>
    val != null ? `Rp ${Number(val).toLocaleString('id-ID')}` : 'Rp 0'
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return '--:--'
    }
  }

  const firstSeg = flight?.segments?.[0]
  const lastSeg = flight?.segments?.[flight?.segments?.length - 1]

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between antialiased">
      <Navbar />

      <main className="w-full pt-[72px] flex-1 pb-20">
        {/* ─── Step Bar Indicator (Stitch B5 & B6) ─── */}
        <section className="bg-raised border-b border-line shadow-2xs py-4">
          <div className="max-w-content mx-auto px-4 md:px-6">
            <div className="flex items-center justify-center gap-3 sm:gap-6 text-xs font-semibold">
              {/* Step 1 */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === 1
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <div className="flex flex-col text-left">
                  <span className={currentStep === 1 ? 'font-bold text-ink' : 'text-subtle'}>
                    Data penumpang
                  </span>
                  <span className="text-[10px] text-subtle hidden sm:inline">
                    Identitas resmi
                  </span>
                </div>
              </button>

              <div className="w-8 sm:w-16 h-0.5 bg-line" />

              {/* Step 2 */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === 2
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-panel border border-line text-subtle'
                  }`}
                >
                  2
                </div>
                <div className="flex flex-col text-left">
                  <span className={currentStep === 2 ? 'font-bold text-ink' : 'text-subtle'}>
                    Kursi & bagasi
                  </span>
                  <span className="text-[10px] text-subtle hidden sm:inline">
                    Denah kabin & add-on
                  </span>
                </div>
              </div>

              <div className="w-8 sm:w-16 h-0.5 bg-line" />

              {/* Step 3 */}
              <div className="flex items-center gap-2 opacity-50">
                <div className="w-7 h-7 rounded-full bg-panel border border-line text-subtle flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-subtle">Bayar</span>
                  <span className="text-[10px] text-subtle hidden sm:inline">
                    Konfirmasi akhir
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Email Not Verified Warning Guard ─── */}
        {user && user.email_verified === false && (
          <div className="max-w-content mx-auto px-4 md:px-6 mt-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-ticket text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-amber-600 dark:text-amber-400 shrink-0">
                  mail_lock
                </span>
                <div>
                  <span className="font-bold block">Verifikasi Email Diperlukan</span>
                  <span>
                    Email Anda belum terverifikasi. Selesaikan verifikasi email untuk menyelesaikan
                    pembayaran tiket.
                  </span>
                </div>
              </div>
              <Link
                to="/check-email"
                className="shrink-0 px-3.5 py-1.5 rounded-control bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 shadow-2xs"
              >
                Cek Email
              </Link>
            </div>
          </div>
        )}

        {/* ─── Error Notification ─── */}
        {bookingError && (
          <div className="max-w-content mx-auto px-4 md:px-6 mt-4">
            <div className="p-4 bg-danger/10 border border-danger/30 rounded-ticket text-danger text-sm font-medium flex items-center gap-3">
              <span className="material-symbols-outlined text-[22px] shrink-0">error</span>
              <span>{bookingError}</span>
            </div>
          </div>
        )}

        {/* ─── Loading & Error State ─── */}
        {loading && (
          <div className="max-w-content mx-auto px-4 md:px-6 mt-12 text-center py-12">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-subtle text-sm">Memuat informasi penerbangan...</p>
          </div>
        )}
        {errorMsg && (
          <div className="max-w-content mx-auto px-4 md:px-6 mt-4">
            <div className="p-4 bg-danger/10 border border-danger/30 rounded-ticket text-danger text-sm font-medium flex items-center gap-3">
              <span className="material-symbols-outlined text-[22px] shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* ─── Two-Column Booking Canvas ─── */}
        {!loading && flight && (
        <div className="max-w-content mx-auto px-4 md:px-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ════ LEFT COLUMN: Main Form & Interactive Content (760px) ════ */}
            <div className="w-full lg:col-span-8 flex flex-col gap-6">
              {/* Flight Summary Strip (Stitch B5 & B6) */}
              {flight && (
                <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-control bg-tint text-brand-fg flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[22px]">flight</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-sm">
                            {flight.airline?.name || 'SkyBook Air'}
                          </span>
                          <span className="text-subtle text-xs">•</span>
                          <span className="text-xs text-subtle font-mono font-semibold">
                            {flight.flight_number}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-tint text-brand-fg">
                            {cabinClassParam === 'business' ? 'Bisnis' : 'Ekonomi'}
                          </span>
                        </div>
                        <span className="text-xs text-subtle mt-0.5">
                          {flight.airplane?.model || 'Boeing 737'}
                        </span>
                      </div>
                    </div>

                    {/* Route and Time */}
                    <div className="flex items-center gap-4 text-xs justify-between sm:justify-start">
                      <div className="text-right">
                        <div className="font-bold text-sm tabular-nums text-ink">
                          {formatTime(firstSeg?.departure_time)}
                        </div>
                        <div className="text-subtle font-semibold">
                          {firstSeg?.origin?.code || 'CGK'}
                        </div>
                      </div>

                      <div className="flex flex-col items-center px-1">
                        <span className="text-[10px] text-subtle mb-0.5">
                          {flight.flight_type === 'transit' ? 'Transit' : 'Langsung'}
                        </span>
                        <div className="w-16 h-0.5 bg-line relative flex items-center justify-center">
                          <span className="material-symbols-outlined text-[12px] text-brand-fg absolute">
                            east
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-sm tabular-nums text-ink">
                          {formatTime(lastSeg?.arrival_time)}
                        </div>
                        <div className="text-subtle font-semibold">
                          {lastSeg?.destination?.code || 'DPS'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Revisi data real: flight delay note */}
                  {flight.delay_minutes > 0 && (
                    <div className="mt-3 pt-3 border-t border-line text-xs font-semibold text-danger flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      <span>
                        Penerbangan tertunda {flight.delay_minutes} menit dari jadwal awal.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════ STEP 1: DATA PENUMPANG (B5) ════════════ */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <h1 className="text-2xl font-bold text-ink tracking-tight">Data penumpang</h1>
                    <p className="text-sm text-subtle mt-1">
                      Pastikan data sesuai dengan kartu identitas resmi (KTP atau paspor) untuk
                      kelancaran verifikasi di bandara.
                    </p>
                  </div>

                  {/* Passenger Cards */}
                  <form onSubmit={handleProceedToSeats} className="space-y-4">
                    {passengers.map((p, idx) => {
                      const isComplete = isPassengerComplete(p)

                      return (
                        <div
                          key={idx}
                          className="bg-raised border border-line rounded-ticket shadow-xs overflow-hidden"
                        >
                          {/* Card Header */}
                          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-line bg-page/50">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-tint text-brand-fg font-bold flex items-center justify-center text-xs">
                                {idx + 1}
                              </div>
                              <h2 className="font-bold text-ink text-sm sm:text-base">
                                Penumpang {idx + 1} (Dewasa)
                              </h2>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                isComplete
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-danger/10 text-danger'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {isComplete ? 'check_circle' : 'pending'}
                              </span>
                              <span>{isComplete ? 'Lengkap' : 'Belum lengkap'}</span>
                            </span>
                          </div>

                          {/* Card Body Inputs */}
                          <div className="p-5 sm:p-6 space-y-4">
                            {/* Full Name */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-subtle uppercase">
                                Nama lengkap (sesuai KTP atau paspor)
                              </label>
                              <div className="relative flex items-center">
                                <span className="material-symbols-outlined absolute left-3.5 text-subtle text-[20px] pointer-events-none">
                                  person
                                </span>
                                <input
                                  type="text"
                                  required
                                  value={p.full_name}
                                  onChange={(e) =>
                                    updatePassenger(idx, { full_name: e.target.value })
                                  }
                                  placeholder="Contoh: Rina Wulandari"
                                  className="w-full h-11 pl-11 pr-4 bg-panel border border-line rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg transition-all"
                                />
                              </div>
                              <span className="text-[11px] text-subtle">
                                Hindari tanda baca, gelar akademik, atau singkatan nama.
                              </span>
                            </div>

                            {/* Identity Document NIK */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-subtle uppercase">
                                  Nomor identitas (NIK / Paspor)
                                </label>
                                <span className="text-[11px] font-semibold text-subtle tabular-nums">
                                  {p.id_number.length} karakter
                                </span>
                              </div>
                              <div className="relative flex items-center">
                                <span className="material-symbols-outlined absolute left-3.5 text-subtle text-[20px] pointer-events-none">
                                  badge
                                </span>
                                <input
                                  type="text"
                                  required
                                  value={p.id_number}
                                  onChange={(e) =>
                                    updatePassenger(idx, { id_number: e.target.value.replace(/\s+/g, '') })
                                  }
                                  placeholder="16 digit NIK atau nomor paspor"
                                  className="w-full h-11 pl-11 pr-10 bg-panel border border-line rounded-control text-ink text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-brand-fg font-medium transition-all"
                                />
                                {p.id_number.length >= 16 && (
                                  <span className="material-symbols-outlined absolute right-3.5 text-emerald-500 text-[18px]">
                                    verified
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Birth Date & Gender */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-subtle uppercase">
                                  Tanggal lahir
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={p.birth_date}
                                  onChange={(e) =>
                                    updatePassenger(idx, { birth_date: e.target.value })
                                  }
                                  className="w-full h-11 px-3 bg-panel border border-line rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-subtle uppercase">
                                  Jenis kelamin
                                </label>
                                <div className="grid grid-cols-2 p-1 bg-panel border border-line rounded-control gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updatePassenger(idx, { gender: 'male' })}
                                    className={`py-2 text-xs font-bold rounded transition-all ${
                                      p.gender === 'male'
                                        ? 'bg-brand text-white shadow-2xs'
                                        : 'text-subtle hover:text-ink'
                                    }`}
                                  >
                                    Laki-laki
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updatePassenger(idx, { gender: 'female' })}
                                    className={`py-2 text-xs font-bold rounded transition-all ${
                                      p.gender === 'female'
                                        ? 'bg-brand text-white shadow-2xs'
                                        : 'text-subtle hover:text-ink'
                                    }`}
                                  >
                                    Perempuan
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <button
                      type="submit"
                      className="w-full h-12 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 active:scale-98"
                    >
                      <span>Lanjut pilih kursi & bagasi</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </form>
                </div>
              )}

              {/* ════════════ STEP 2: KURSI DAN BAGASI (B6) ════════════ */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-ink tracking-tight">
                        Pilihan kursi & bagasi
                      </h1>
                      <p className="text-sm text-subtle mt-1">
                        Tentukan kursi terbaik Anda dan tambahkan bagasi prabayar lebih hemat.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs text-brand-fg font-semibold hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      <span>Ubah data penumpang</span>
                    </button>
                  </div>

                  {/* Passenger Tabs Switcher */}
                  <div className="bg-raised border border-line rounded-ticket p-4 shadow-xs">
                    <span className="text-xs font-bold text-subtle uppercase tracking-wider block mb-3">
                      Pilih Penumpang untuk Konfigurasi Kursi
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {passengers.map((p, idx) => {
                        const isActive = idx === activePassengerIndex
                        const seatInfo = selectedSeatsByPassenger[idx]

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActivePassengerIndex(idx)}
                            className={`p-3 rounded-control text-left border transition-all flex items-center justify-between gap-2 ${
                              isActive
                                ? 'bg-tint border-brand-fg ring-2 ring-brand-fg/20 shadow-xs'
                                : 'bg-panel border-line hover:bg-tint/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isActive ? 'bg-brand text-white' : 'bg-line text-subtle'
                                }`}
                              >
                                {idx + 1}
                              </div>
                              <div className="flex flex-col truncate">
                                <span className="font-bold text-xs text-ink truncate">
                                  {p.full_name || `Penumpang ${idx + 1}`}
                                </span>
                                <span className="text-[10px] text-subtle">
                                  {p.gender === 'male' ? 'Laki-laki' : 'Perempuan'}
                                </span>
                              </div>
                            </div>

                            {/* Seat Pill */}
                            {seatInfo ? (
                              <span className="px-2.5 py-1 rounded-full bg-[#E8532F] text-white font-bold text-xs shadow-2xs shrink-0">
                                {seatInfo.number}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-line text-subtle shrink-0">
                                Belum dipilih
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Interactive SeatMap */}
                  <SeatMap
                    seats={flight?.seats || []}
                    passengerIndex={activePassengerIndex}
                    passengerName={passengers[activePassengerIndex]?.full_name || `Penumpang ${activePassengerIndex + 1}`}
                    selectedSeatsByPassenger={selectedSeatsByPassenger}
                    onSelectSeat={handleSelectSeat}
                  />

                  {/* Skip Seat Link */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => handleSelectSeat(null)}
                      className="text-xs text-subtle hover:text-brand-fg underline font-medium"
                    >
                      Pilih kursi nanti saat check-in online (gratis alokasi otomatis)
                    </button>
                  </div>

                  {/* Baggage Options Selection */}
                  <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div>
                        <h3 className="font-bold text-ink text-sm sm:text-base">
                          Bagasi Tercatat (Check-in Baggage)
                        </h3>
                        <p className="text-xs text-subtle">
                          Pilihan untuk{' '}
                          <strong>
                            {passengers[activePassengerIndex]?.full_name ||
                              `Penumpang ${activePassengerIndex + 1}`}
                          </strong>
                        </p>
                      </div>
                      <span className="text-xs font-bold text-brand-fg bg-tint px-2.5 py-1 rounded">
                        Kabin 7 kg Termasuk
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option: Tanpa Bagasi Tambahan */}
                      <label
                        className={`p-3.5 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                          !passengers[activePassengerIndex]?.baggage_option_id
                            ? 'bg-tint border-brand-fg ring-2 ring-brand-fg/20'
                            : 'bg-panel border-line hover:bg-tint/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name={`baggage-${activePassengerIndex}`}
                            checked={!passengers[activePassengerIndex]?.baggage_option_id}
                            onChange={() => handleSelectBaggage(null)}
                            className="w-4 h-4 text-brand accent-brand cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-xs text-ink block">
                              Hanya Bagasi Kabin (0 kg)
                            </span>
                            <span className="text-[11px] text-subtle">
                              Bawaan tas tangan / ransel 7 kg
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          Gratis
                        </span>
                      </label>

                      {/* Add-on options from API */}
                      {baggageOptions.map((opt) => {
                        const isSelected =
                          passengers[activePassengerIndex]?.baggage_option_id === opt.id

                        return (
                          <label
                            key={opt.id}
                            className={`p-3.5 rounded-control border cursor-pointer flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-tint border-brand-fg ring-2 ring-brand-fg/20'
                                : 'bg-panel border-line hover:bg-tint/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name={`baggage-${activePassengerIndex}`}
                                checked={isSelected}
                                onChange={() => handleSelectBaggage(opt)}
                                className="w-4 h-4 text-brand accent-brand cursor-pointer"
                              />
                              <div>
                                <span className="font-bold text-xs text-ink block">
                                  {opt.name}
                                </span>
                                <span className="text-[11px] text-subtle">
                                  Tambahan {opt.weight_kg} kg tercatat
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-ink tabular-nums">
                              {formatRupiah(Number(opt.price))}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Proceed to Payment CTA */}
                  <button
                    type="button"
                    onClick={handleCreateBooking}
                    disabled={bookingSubmitting}
                    className="w-full h-12 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
                  >
                    {bookingSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Mengunci kursi & membuat pesanan...</span>
                      </>
                    ) : (
                      <>
                        <span>Lanjut ke pembayaran</span>
                        <span className="material-symbols-outlined text-[18px]">payment</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ════ RIGHT COLUMN: Sticky Price Summary Card (360px) ════ */}
            <aside className="w-full lg:col-span-4 sticky top-[90px] bg-raised border border-line rounded-ticket p-5 shadow-sm space-y-4">
              <div className="border-b border-line pb-3">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider block">
                  Ringkasan Harga
                </span>
                <h3 className="font-bold text-ink text-base mt-0.5">
                  {flight?.flight_number || 'KA 412'} • {cabinClassParam === 'business' ? 'Bisnis' : 'Ekonomi'}
                </h3>
              </div>

              {/* Passenger Itemized Count */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-subtle">
                    Tarif Tiket ({passengers.length} Penumpang)
                  </span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatRupiah(pricing.totalBaseFare)}
                  </span>
                </div>

                {pricing.seatsFee > 0 && (
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                    <span>Kursi Pintu Darurat (Legroom)</span>
                    <span className="font-bold tabular-nums">
                      +{formatRupiah(pricing.seatsFee)}
                    </span>
                  </div>
                )}

                {pricing.baggageFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-subtle">Bagasi Tambahan</span>
                    <span className="font-bold text-ink tabular-nums">
                      +{formatRupiah(pricing.baggageFee)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-subtle">
                  <span>Pajak & Biaya Pelayanan (PPN)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Termasuk
                  </span>
                </div>
              </div>

              <div className="h-px bg-line" />

              {/* Total Calculation */}
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-bold text-subtle uppercase block">
                    Total Pembayaran
                  </span>
                  <span className="text-lg font-bold text-brand-fg tabular-nums">
                    {formatRupiah(pricing.total)}
                  </span>
                </div>
                <span className="text-[10px] text-subtle">Termasuk semua biaya</span>
              </div>

              {/* Guarantees Box */}
              <div className="p-3 bg-page/60 rounded-control border border-line text-[11px] text-subtle space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <span className="material-symbols-outlined text-[16px] text-emerald-500">
                    verified_user
                  </span>
                  <span>Transaksi Aman & Terenkripsi</span>
                </div>
                <p>
                  Kursi yang Anda pilih langsung dikunci selama 1 jam saat melanjutkan ke tahap
                  pembayaran.
                </p>
              </div>
            </aside>
          </div>
        </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
