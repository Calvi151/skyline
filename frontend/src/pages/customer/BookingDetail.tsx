import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import SeatMap from '../../components/booking/SeatMap'
import { useAuthStore } from '../../store/authStore'
import { useBookingStore, PassengerData } from '../../store/bookingStore'
import { api } from '../../lib/api'
import { AirlineLogo } from '../../components/common/AirlineLogo'
import { getPrimaryCity } from '../../lib/airports'

interface BaggageOption {
  id: number
  name: string
  weight_kg: number
  price: number | string
}

/**
 * Validasi Nomor Identitas Resmi (NIK KTP atau Nomor Paspor)
 * NIK: 16 digit angka
 * Paspor: 6-16 karakter alfanumerik
 */
export function validateIdentityNumber(val?: string | null): {
  valid: boolean
  type: 'nik' | 'passport' | 'empty' | 'invalid'
  message: string
} {
  const clean = (val || '').trim().replace(/\s+/g, '')
  if (!clean) {
    return { valid: false, type: 'empty', message: 'Nomor identitas wajib diisi' }
  }

  const isDigitsOnly = /^\d+$/.test(clean)
  if (isDigitsOnly) {
    if (clean.length === 16) {
      return { valid: true, type: 'nik', message: 'NIK KTP Valid (16 digit)' }
    }
    return {
      valid: false,
      type: 'nik',
      message: `NIK harus 16 digit angka (${clean.length}/16)`,
    }
  }

  // Paspor: 6-16 karakter alfanumerik
  const isPassport = /^[A-Za-z0-9]{6,16}$/.test(clean)
  if (isPassport) {
    return { valid: true, type: 'passport', message: 'Nomor Paspor Valid' }
  }

  return {
    valid: false,
    type: 'invalid',
    message: 'Format tidak valid (NIK 16 digit atau Paspor 6-16 karakter)',
  }
}

/**
 * Kalkulasi usia dan kategori penumpang penerbangan berdasarkan tanggal lahir
 */
export function calculatePassengerAge(birthDateStr?: string | null): {
  age: number | null
  category: 'Dewasa' | 'Anak-anak' | 'Bayi' | 'Lansia' | ''
  isValid: boolean
  error?: string
} {
  if (!birthDateStr) {
    return { age: null, category: '', isValid: false }
  }

  const birth = new Date(birthDateStr)
  if (isNaN(birth.getTime())) {
    return { age: null, category: '', isValid: false, error: 'Format tanggal tidak valid' }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const birthDay = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate())

  if (birthDay > today) {
    return { age: null, category: '', isValid: false, error: 'Tanggal lahir tidak boleh di masa depan' }
  }

  let age = today.getFullYear() - birthDay.getFullYear()
  const monthDiff = today.getMonth() - birthDay.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay.getDate())) {
    age--
  }

  if (age < 0 || age > 120) {
    return { age, category: '', isValid: false, error: 'Tanggal lahir tidak realistis' }
  }

  let category: 'Dewasa' | 'Anak-anak' | 'Bayi' | 'Lansia' = 'Dewasa'
  if (age < 2) {
    category = 'Bayi'
  } else if (age < 12) {
    category = 'Anak-anak'
  } else if (age >= 60) {
    category = 'Lansia'
  } else {
    category = 'Dewasa'
  }

  return { age, category, isValid: true }
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const returnFlightId = searchParams.get('returnFlightId')
  const isRoundtrip = Boolean(returnFlightId) || searchParams.get('trip') === 'roundtrip'
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
  const [returnFlight, setReturnFlight] = useState<any | null>(null)
  const [baggageOptions, setBaggageOptions] = useState<BaggageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Promo voucher & cashback state
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number; label: string } | null>(null)
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null)

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
          full_name: i === 0 && user?.name ? user.name : '',
          id_number: '',
          birth_date: '',
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
    } else if (passengers.length > 0 && !passengers[0].full_name && user?.name) {
      // Auto-fill passenger 1 if currently blank and user profile is loaded
      updatePassenger(0, { full_name: user.name })
    }
  }, [passengersCountParam, cabinClassParam, passengers.length, setPassengers, user?.name])

  // Load Flight detail & Baggage options (including return flight if round-trip)
  const loadFlightAndBaggage = async () => {
    if (!id) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const promises: Promise<any>[] = [
        api.get<any>(`/flights/${id}`),
        api.get<any>('/baggage-options').catch(() => ({ data: [] })),
      ]
      if (returnFlightId) {
        promises.push(api.get<any>(`/flights/${returnFlightId}`).catch(() => null))
      }

      const [flightRes, baggageRes, returnFlightRes] = await Promise.all(promises)

      const flightData = flightRes?.data?.data || flightRes?.data
      if (flightData && (flightData.id || flightData.flight_number)) {
        setFlight(flightData)
      } else {
        setErrorMsg('Data penerbangan tidak ditemukan.')
      }

      if (returnFlightRes) {
        const retData = returnFlightRes?.data?.data || returnFlightRes?.data
        if (retData && (retData.id || retData.flight_number)) {
          setReturnFlight(retData)
        }
      }

      const baggageData = baggageRes?.data?.data || baggageRes?.data
      if (Array.isArray(baggageData)) {
        setBaggageOptions(baggageData)
      }
    } catch (err: any) {
      console.error('Failed to load flight detail:', err)
      setErrorMsg(err?.response?.data?.message || err?.message || 'Gagal memuat jadwal penerbangan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFlightAndBaggage()
  }, [id, returnFlightId])

  // Promo Voucher Handlers
  const handleApplyPromo = (codeToApply?: string) => {
    const raw = (codeToApply || promoInput).trim().toUpperCase()
    if (!raw) {
      setPromoMessage({ text: 'Masukkan kode promo terlebih dahulu.', isError: true })
      return
    }

    if (raw === 'SKYBARENG') {
      if (passengers.length < 2) {
        setPromoMessage({ text: 'Kode SKYBARENG berlaku untuk pemesanan minimal 2 penumpang.', isError: true })
        return
      }
      setAppliedPromo({ code: 'SKYBARENG', discount: 100000, label: 'Kupon Rombongan SkyBareng (-Rp 100.000)' })
      setPromoMessage({ text: 'Kode SKYBARENG berhasil digunakan! Hemat Rp 100.000.', isError: false })
      setPromoInput('SKYBARENG')
    } else if (raw === 'PPHEMAT') {
      if (!isRoundtrip) {
        setPromoMessage({ text: 'Kode PPHEMAT khusus untuk rute Pulang-Pergi (PP).', isError: true })
        return
      }
      setAppliedPromo({ code: 'PPHEMAT', discount: 75000, label: 'Kupon Pulang-Pergi Hemat (-Rp 75.000)' })
      setPromoMessage({ text: 'Kode PPHEMAT berhasil digunakan! Hemat Rp 75.000.', isError: false })
      setPromoInput('PPHEMAT')
    } else if (raw === 'TERBANGHEMAT') {
      setAppliedPromo({ code: 'TERBANGHEMAT', discount: 50000, label: 'Kupon Terbang Hemat (-Rp 50.000)' })
      setPromoMessage({ text: 'Kode TERBANGHEMAT berhasil digunakan! Hemat Rp 50.000.', isError: false })
      setPromoInput('TERBANGHEMAT')
    } else {
      setPromoMessage({ text: 'Kode promo tidak valid atau sudah kedaluwarsa.', isError: true })
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setPromoMessage(null)
    setPromoInput('')
  }

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

  // Calculate pricing breakdown with Group Discount, Roundtrip bundle, and Promo Voucher
  const pricing = useMemo(() => {
    if (!flight) {
      return {
        outboundBase: 0,
        returnBase: 0,
        totalBaseFare: 0,
        roundtripDiscount: 0,
        groupDiscount: 0,
        groupPercent: 0,
        promoDiscount: 0,
        totalDiscount: 0,
        seatsFee: 0,
        baggageFee: 0,
        subtotal: 0,
        total: 0,
        cashback: 0,
      }
    }

    const outboundBasePerPax =
      cabinClassParam === 'business' && flight.price_business
        ? Number(flight.price_business)
        : Number(flight.price_economy || 0)
    const outboundBase = outboundBasePerPax * passengers.length

    let returnBaseRaw = 0
    let roundtripDiscount = 0
    if (returnFlight) {
      const returnBasePerPax =
        cabinClassParam === 'business' && returnFlight.price_business
          ? Number(returnFlight.price_business)
          : Number(returnFlight.price_economy || 0)
      returnBaseRaw = returnBasePerPax * passengers.length
      // Bundle PP Hemat 10% on return fare
      roundtripDiscount = Math.round(returnBaseRaw * 0.1)
    }

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

    // "Berangkat Bareng" Group discount tier:
    // 2 pax: 5%, 3-4 pax: 10%, 5+ pax: 15% off base fare
    const groupPercent =
      passengers.length >= 5 ? 15 : passengers.length >= 3 ? 10 : passengers.length === 2 ? 5 : 0
    const groupDiscount = Math.round(((outboundBase + returnBaseRaw) * groupPercent) / 100)

    // Promo voucher discount
    const promoDiscount = appliedPromo?.discount || 0

    const subtotal = outboundBase + returnBaseRaw + seatsFee + baggageFee
    const totalDiscount = roundtripDiscount + groupDiscount + promoDiscount
    const total = Math.max(0, subtotal - totalDiscount)
    const cashback = Math.round(total * 0.03) // 3% SkyPoints cashback

    return {
      outboundBase,
      returnBase: returnBaseRaw,
      totalBaseFare: outboundBase + returnBaseRaw,
      roundtripDiscount,
      groupDiscount,
      groupPercent,
      promoDiscount,
      totalDiscount,
      seatsFee,
      baggageFee,
      subtotal,
      total,
      cashback,
    }
  }, [flight, returnFlight, cabinClassParam, passengers, appliedPromo])

  // Validation: Check if Step 1 is complete
  const isPassengerComplete = (p: PassengerData) => {
    const isNameValid = p.full_name.trim().length >= 2
    const idValidation = validateIdentityNumber(p.id_number)
    const ageValidation = calculatePassengerAge(p.birth_date)
    const isGenderValid = Boolean(p.gender)

    return isNameValid && idValidation.valid && ageValidation.isValid && isGenderValid
  }

  const allPassengersComplete = useMemo(() => {
    if (!passengers || passengers.length === 0) return false
    return passengers.every(isPassengerComplete)
  }, [passengers])

  // Proceed from Step 1 to Step 2
  const handleProceedToSeats = (e: React.FormEvent) => {
    e.preventDefault()
    if (!allPassengersComplete) {
      setBookingError(
        'Mohon lengkapi seluruh data identitas (NIK 16 digit / Paspor) dan tanggal lahir penumpang terlebih dahulu.',
      )
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
    // 1. Guard kelengkapan data penumpang
    if (!allPassengersComplete) {
      setBookingError(
        'Data identitas (NIK / Paspor) atau tanggal lahir penumpang belum lengkap. Mohon periksa kembali di Langkah 1.',
      )
      setCurrentStep(1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setBookingSubmitting(true)
    setBookingError(null)

    // Verify email guard
    if (user && user.email_verified === false) {
      setBookingError(
        'Email Anda belum terverifikasi. Silakan cek email dan verifikasi akun sebelum memesan tiket.',
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
        promo_code: appliedPromo?.code || null,
        discount_amount: pricing.totalDiscount || 0,
      })

      const bookingData = res?.data?.data || res?.data
      if (bookingData?.id) {
        navigate(`/checkout/${bookingData.id}`)
      } else {
        setBookingError('Gagal memproses pemesanan tiket.')
      }
    } catch (err: any) {
      console.error('Booking failed:', err)
      const errCode = err?.response?.data?.code || err?.code
      const errMsg = err?.response?.data?.message || err?.message

      if (errCode === 'SEAT_NOT_AVAILABLE') {
        setBookingError(errMsg || 'Kursi yang dipilih baru saja dipesan. Silakan pilih kursi lain.')
        // Reload seat map
        loadFlightAndBaggage()
      } else if (errCode === 'FLIGHT_CANCELLED') {
        setBookingError('Penerbangan ini dibatalkan oleh maskapai.')
      } else {
        setBookingError(errMsg || 'Terjadi kesalahan saat memproses pesanan.')
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
  const retFirstSeg = returnFlight?.segments?.[0]
  const retLastSeg = returnFlight?.segments?.[returnFlight?.segments?.length - 1]

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
              {/* Flight Summary Strip: Outbound & Inbound (Stitch B5 & B6) */}
              <div className="space-y-3">
                {flight && (
                  <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs">
                    {returnFlight && (
                      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-line">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand text-white uppercase tracking-wider">
                          Penerbangan Pergi
                        </span>
                        <span className="text-xs text-subtle font-medium">
                          {getPrimaryCity(firstSeg?.origin?.code)} → {getPrimaryCity(lastSeg?.destination?.code)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <AirlineLogo
                          code={flight.airline?.code}
                          name={flight.airline?.name}
                          logo={flight.airline?.logo}
                          size="md"
                        />
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
                            {getPrimaryCity(firstSeg?.origin?.code)} ({firstSeg?.origin?.code || 'CGK'})
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
                            {getPrimaryCity(lastSeg?.destination?.code)} ({lastSeg?.destination?.code || 'DPS'})
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

                {/* Inbound Flight Summary (if Round-Trip) */}
                {returnFlight && (
                  <div className="bg-raised border border-line rounded-ticket p-5 shadow-xs">
                    <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-line">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white uppercase tracking-wider">
                        Penerbangan Pulang
                      </span>
                      <span className="text-xs text-subtle font-medium">
                        {getPrimaryCity(retFirstSeg?.origin?.code)} → {getPrimaryCity(retLastSeg?.destination?.code)}
                      </span>
                      <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Hemat 10% Bundle PP
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <AirlineLogo
                          code={returnFlight.airline?.code}
                          name={returnFlight.airline?.name}
                          logo={returnFlight.airline?.logo}
                          size="md"
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink text-sm">
                              {returnFlight.airline?.name || 'SkyBook Air'}
                            </span>
                            <span className="text-subtle text-xs">•</span>
                            <span className="text-xs text-subtle font-mono font-semibold">
                              {returnFlight.flight_number}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-tint text-brand-fg">
                              {cabinClassParam === 'business' ? 'Bisnis' : 'Ekonomi'}
                            </span>
                          </div>
                          <span className="text-xs text-subtle mt-0.5">
                            {returnFlight.airplane?.model || 'Boeing 737'}
                          </span>
                        </div>
                      </div>

                      {/* Route and Time */}
                      <div className="flex items-center gap-4 text-xs justify-between sm:justify-start">
                        <div className="text-right">
                          <div className="font-bold text-sm tabular-nums text-ink">
                            {formatTime(retFirstSeg?.departure_time)}
                          </div>
                          <div className="text-subtle font-semibold">
                            {getPrimaryCity(retFirstSeg?.origin?.code)} ({retFirstSeg?.origin?.code || 'DPS'})
                          </div>
                        </div>

                        <div className="flex flex-col items-center px-1">
                          <span className="text-[10px] text-subtle mb-0.5">
                            {returnFlight.flight_type === 'transit' ? 'Transit' : 'Langsung'}
                          </span>
                          <div className="w-16 h-0.5 bg-line relative flex items-center justify-center">
                            <span className="material-symbols-outlined text-[12px] text-amber-600 dark:text-amber-400 absolute">
                              east
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="font-bold text-sm tabular-nums text-ink">
                            {formatTime(retLastSeg?.arrival_time)}
                          </div>
                          <div className="text-subtle font-semibold">
                            {getPrimaryCity(retLastSeg?.destination?.code)} ({retLastSeg?.destination?.code || 'CGK'})
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
                                Penumpang {idx + 1}
                                {(() => {
                                  const ageInfo = calculatePassengerAge(p.birth_date)
                                  if (ageInfo.isValid && ageInfo.age !== null) {
                                    return ` • ${ageInfo.category} (${ageInfo.age} thn)`
                                  }
                                  return ''
                                })()}
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
                              <span>{isComplete ? 'Data Lengkap' : 'Belum Lengkap'}</span>
                            </span>
                          </div>

                          {/* Card Body Inputs */}
                          <div className="p-5 sm:p-6 space-y-4">
                            {/* Full Name */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-subtle uppercase">
                                  Nama lengkap (sesuai KTP atau paspor)
                                </label>
                                {user?.name && p.full_name !== user.name && (
                                  <button
                                    type="button"
                                    onClick={() => updatePassenger(idx, { full_name: user.name })}
                                    className="text-[11px] text-brand-fg hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">account_circle</span>
                                    <span>Gunakan nama akun ({user.name})</span>
                                  </button>
                                )}
                              </div>
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

                            {/* Identity Document NIK / Passport */}
                            {(() => {
                              const idValidation = validateIdentityNumber(p.id_number)

                              return (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-subtle uppercase">
                                      Nomor identitas (NIK KTP / Paspor)
                                    </label>
                                    {p.id_number ? (
                                      <span
                                        className={`text-[11px] font-semibold tabular-nums flex items-center gap-1 ${
                                          idValidation.valid
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                        }`}
                                      >
                                        {idValidation.valid && (
                                          <span className="material-symbols-outlined text-[14px]">
                                            check_circle
                                          </span>
                                        )}
                                        <span>{idValidation.message}</span>
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-danger font-semibold">
                                        * Wajib diisi (16 digit NIK atau Paspor)
                                      </span>
                                    )}
                                  </div>
                                  <div className="relative flex items-center">
                                    <span className="material-symbols-outlined absolute left-3.5 text-subtle text-[20px] pointer-events-none">
                                      badge
                                    </span>
                                    <input
                                      type="text"
                                      required
                                      maxLength={16}
                                      value={p.id_number}
                                      onChange={(e) =>
                                        updatePassenger(idx, {
                                          id_number: e.target.value.replace(/\s+/g, '').toUpperCase(),
                                        })
                                      }
                                      placeholder="16 digit NIK KTP atau nomor paspor resmi"
                                      className={`w-full h-11 pl-11 pr-10 bg-panel border rounded-control text-ink text-sm tracking-wide focus:outline-none focus:ring-2 font-medium transition-all ${
                                        p.id_number
                                          ? idValidation.valid
                                            ? 'border-emerald-500/50 focus:ring-emerald-500/30'
                                            : 'border-amber-500/50 focus:ring-amber-500/30'
                                          : 'border-line focus:ring-brand-fg'
                                      }`}
                                    />
                                    {idValidation.valid && (
                                      <span className="material-symbols-outlined absolute right-3.5 text-emerald-500 text-[18px]">
                                        verified
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-subtle">
                                    WNI wajib menggunakan NIK KTP (16 digit angka). WNA dapat menggunakan nomor paspor resmi.
                                  </span>
                                </div>
                              )
                            })()}

                            {/* Birth Date & Gender */}
                            {(() => {
                              const ageInfo = calculatePassengerAge(p.birth_date)

                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs font-bold text-subtle uppercase">
                                        Tanggal lahir
                                      </label>
                                      {ageInfo.isValid && ageInfo.age !== null ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                                          Usia: {ageInfo.age} thn ({ageInfo.category})
                                        </span>
                                      ) : ageInfo.error ? (
                                        <span className="text-[11px] font-semibold text-danger">
                                          {ageInfo.error}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-danger font-semibold">
                                          * Wajib diisi
                                        </span>
                                      )}
                                    </div>
                                    <div className="relative flex items-center">
                                      <input
                                        type="date"
                                        required
                                        max={new Date().toISOString().split('T')[0]}
                                        value={p.birth_date}
                                        onChange={(e) =>
                                          updatePassenger(idx, { birth_date: e.target.value })
                                        }
                                        className={`w-full h-11 px-3 bg-panel border rounded-control text-ink text-sm focus:outline-none focus:ring-2 ${
                                          ageInfo.isValid
                                            ? 'border-emerald-500/50 focus:ring-emerald-500/30'
                                            : 'border-line focus:ring-brand-fg'
                                        }`}
                                      />
                                    </div>
                                    <span className="text-[11px] text-subtle">
                                      {ageInfo.isValid && ageInfo.age !== null
                                        ? `Usia terhitung: ${ageInfo.age} tahun per tanggal hari ini.`
                                        : 'Pilih tanggal lahir untuk kalkulasi usia otomatis.'}
                                    </span>
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
                              )
                            })()}
                          </div>
                        </div>
                      )
                    })}

                    <button
                      type="submit"
                      disabled={!allPassengersComplete}
                      className={`w-full h-12 rounded-control font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${
                        allPassengersComplete
                          ? 'bg-brand hover:bg-brand-hover text-white active:scale-98 cursor-pointer'
                          : 'bg-panel border border-line text-subtle cursor-not-allowed opacity-60'
                      }`}
                    >
                      {allPassengersComplete ? (
                        <>
                          <span>Lanjut pilih kursi & bagasi</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">lock</span>
                          <span>Lengkapi NIK / Paspor & Data Penumpang untuk Lanjut</span>
                        </>
                      )}
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
                    disabled={bookingSubmitting || !allPassengersComplete}
                    className={`w-full h-12 rounded-control font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                      allPassengersComplete && !bookingSubmitting
                        ? 'bg-brand hover:bg-brand-hover text-white active:scale-98 cursor-pointer'
                        : 'bg-panel border border-line text-subtle cursor-not-allowed opacity-60'
                    }`}
                  >
                    {bookingSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Mengunci kursi & membuat pesanan...</span>
                      </>
                    ) : !allPassengersComplete ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                        <span>Lengkapi Data Penumpang di Langkah 1</span>
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                    Ringkasan Harga
                  </span>
                  {isRoundtrip && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Pulang-Pergi (PP)
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-ink text-base mt-1">
                  {flight?.flight_number || 'KA 412'} {returnFlight ? `& ${returnFlight.flight_number}` : ''} • {cabinClassParam === 'business' ? 'Bisnis' : 'Ekonomi'}
                </h3>
              </div>

              {/* Passenger Itemized Count */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-subtle">
                    Tiket Pergi ({passengers.length} Penumpang)
                  </span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatRupiah(pricing.outboundBase)}
                  </span>
                </div>

                {returnFlight && (
                  <div className="flex items-center justify-between">
                    <span className="text-subtle">
                      Tiket Pulang ({passengers.length} Penumpang)
                    </span>
                    <span className="font-bold text-ink tabular-nums">
                      {formatRupiah(pricing.returnBase)}
                    </span>
                  </div>
                )}

                {/* Diskon Rombongan Berangkat Bareng */}
                {pricing.groupDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">group</span>
                      Diskon Rombongan ({pricing.groupPercent}%)
                    </span>
                    <span className="font-bold tabular-nums">
                      -{formatRupiah(pricing.groupDiscount)}
                    </span>
                  </div>
                )}

                {/* Diskon Pulang Pergi Bundle */}
                {pricing.roundtripDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                      Diskon Bundle PP (10%)
                    </span>
                    <span className="font-bold tabular-nums">
                      -{formatRupiah(pricing.roundtripDiscount)}
                    </span>
                  </div>
                )}

                {/* Kupon Promo Terpasang */}
                {appliedPromo && pricing.promoDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">sell</span>
                      {appliedPromo.label}
                    </span>
                    <span className="font-bold tabular-nums">
                      -{formatRupiah(pricing.promoDiscount)}
                    </span>
                  </div>
                )}

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

              {/* Promo Code Input Box */}
              <div className="pt-2 border-t border-line space-y-2">
                <label className="text-xs font-bold text-ink flex items-center justify-between">
                  <span>Punya Kupon Promo?</span>
                  {appliedPromo && (
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-[11px] text-danger hover:underline font-semibold cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </label>

                {appliedPromo ? (
                  <div className="p-2.5 rounded-control bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">
                        check_circle
                      </span>
                      <div>
                        <div className="font-bold text-emerald-800 dark:text-emerald-300">
                          {appliedPromo.code}
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          {appliedPromo.label}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-subtle hover:text-ink text-xs p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Kode promo (cth: SKYBARENG)"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-1.5 text-xs rounded-control bg-panel border border-line focus:border-brand focus:outline-none uppercase font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyPromo()}
                      className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                    >
                      Pakai
                    </button>
                  </div>
                )}

                {promoMessage && (
                  <p
                    className={`text-[11px] ${
                      promoMessage.isError
                        ? 'text-danger font-medium'
                        : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    }`}
                  >
                    {promoMessage.text}
                  </p>
                )}

                {/* Promo Voucher Quick Suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {passengers.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => handleApplyPromo('SKYBARENG')}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-tint text-brand-fg border border-brand/20 hover:bg-brand hover:text-white transition-colors cursor-pointer"
                    >
                      🏷️ SKYBARENG (-Rp 100rb)
                    </button>
                  )}
                  {isRoundtrip && (
                    <button
                      type="button"
                      onClick={() => handleApplyPromo('PPHEMAT')}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-tint text-brand-fg border border-brand/20 hover:bg-brand hover:text-white transition-colors cursor-pointer"
                    >
                      🏷️ PPHEMAT (-Rp 75rb)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleApplyPromo('TERBANGHEMAT')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-tint text-brand-fg border border-brand/20 hover:bg-brand hover:text-white transition-colors cursor-pointer"
                  >
                    🏷️ TERBANGHEMAT (-Rp 50rb)
                  </button>
                </div>
              </div>

              {/* Total Calculation & Cashback */}
              <div className="h-px bg-line" />

              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-subtle uppercase block">
                      Total Pembayaran
                    </span>
                    <span className="text-xl font-bold text-brand-fg tabular-nums">
                      {formatRupiah(pricing.total)}
                    </span>
                  </div>
                  <span className="text-[10px] text-subtle">Termasuk semua diskon</span>
                </div>

                {/* Cashback Box */}
                <div className="p-2.5 rounded-control bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎁</span>
                    <div>
                      <span className="font-bold text-amber-900 dark:text-amber-300 block">
                        Cashback +{formatRupiah(pricing.cashback)} SkyPoints
                      </span>
                      <span className="text-[10px] text-subtle">
                        3% dari total transaksi, dikreditkan otomatis
                      </span>
                    </div>
                  </div>
                </div>
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
