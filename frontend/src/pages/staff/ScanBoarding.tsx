import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import StaffLayout from '../../components/layout/StaffLayout'
import { useStaffStore, AVAILABLE_GATES, getGateForFlight } from '../../store/staffStore'
import { broadcastStaffEvent, subscribeStaffEvents } from '../../lib/staffEvents'
import { gateAudio } from '../../lib/audioFeedback'
import { AirlineLogo } from '../../components/common/AirlineLogo'
import { FlightSearchCombobox } from '../../components/common/FlightSearchCombobox'

interface FlightScheduleItem {
  id: number
  flight_number: string
  airline: { name: string; code: string; logo?: string | null } | null
  airplane: { model: string; registration_number: string } | null
  route: string
  origin: { code: string; city: string; name: string } | null
  destination: { code: string; city: string; name: string } | null
  departure_time: string | null
  arrival_time: string | null
  status: 'scheduled' | 'delayed' | 'cancelled'
  delay_minutes: number
  checked_in_count: number
  boarded_count: number
  passenger_count: number
  total_capacity: number
  gate?: string
}

interface VerifyPassengerData {
  check_in_id: number
  passenger_id: number
  passenger_name: string
  id_number?: string
  seat_number: string
  seat_class?: string
  flight_schedule_id: number
  flight_number: string
  airline?: { id?: number; name: string; code: string; logo?: string | null } | null
  airplane?: { model: string; registration_number?: string } | null
  origin?: { code: string; city: string; name: string } | null
  destination?: { code: string; city: string; name: string } | null
  departure_time?: string | null
  booking_code: string
  boarding_pass_code: string
  status: string
  boarded_at?: string
}

interface ScanLogItem {
  id: string
  name: string
  seat: string
  flightNumber: string
  airlineName?: string
  airlineCode?: string
  pnr: string
  time: string
  status: 'boarded' | 'already' | 'wrong_flight' | 'invalid'
}

const CABIN_ROWS = [1, 2, 10, 11, 12, 14, 15, 16, 17, 18]
const SEAT_COLS_LEFT = ['A', 'B', 'C']
const SEAT_COLS_RIGHT = ['D', 'E', 'F']

export default function ScanBoarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const flightIdParam = searchParams.get('flightId')
  const {
    selectedFlightId: storedFlightId,
    setSelectedFlightId: setStoreFlightId,
    selectedGate,
    setSelectedGate,
    cachedFlights,
    setCachedFlights,
  } = useStaffStore()

  const initialFlightId = flightIdParam || (storedFlightId ? String(storedFlightId) : 'all')
  const [selectedFlightId, setSelectedFlightId] = useState<string>(initialFlightId)

  const [flights, setFlights] = useState<FlightScheduleItem[]>(cachedFlights)

  // Daftar penerbangan yang ditugaskan pada pos gerbang staf (Gate Assignment)
  const assignedFlights = useMemo(() => {
    if (selectedGate === 'all') return flights
    return flights.filter((f) => (f.gate || getGateForFlight(f.id)) === selectedGate)
  }, [flights, selectedGate])

  // Sinkronisasi otomatis saat beralih pos gerbang tugas
  useEffect(() => {
    if (selectedGate !== 'all' && assignedFlights.length > 0) {
      const exists = assignedFlights.some((f) => String(f.id) === selectedFlightId)
      if (!exists && selectedFlightId !== 'all') {
        const bestFlight = assignedFlights.find((f) => f.status !== 'cancelled') || assignedFlights[0]
        setSelectedFlightId(String(bestFlight.id))
        setStoreFlightId(bestFlight.id)
      }
    }
  }, [selectedGate, assignedFlights, selectedFlightId, setStoreFlightId])
  const [lastRefreshed, setLastRefreshed] = useState<string>('')

  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'valid' | 'already' | 'wrong_flight' | 'invalid'
    data?: VerifyPassengerData | null
    errorMessage?: string
    timestamp?: string
  }>({ status: 'idle' })

  const [recentScans, setRecentScans] = useState<ScanLogItem[]>([])
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanIntervalRef = useRef<any>(null)
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 })

  useEffect(() => {
    if (flightIdParam) {
      setSelectedFlightId(flightIdParam)
    }
  }, [flightIdParam])

  const fetchFlights = async () => {
    try {
      const res = await api.get<{ error: boolean; data: FlightScheduleItem[] }>('/staff/flights?date=all')
      if (res.data?.data) {
        setFlights(res.data.data)
        setCachedFlights(res.data.data)
      }
      const now = new Date()
      setLastRefreshed(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
      )
    } catch (err) {
      console.error('Gagal mengambil daftar penerbangan untuk scanner:', err)
    }
  }

  useEffect(() => {
    fetchFlights()

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchFlights()
      }
    }, 3000)

    const handleFocus = () => fetchFlights()
    window.addEventListener('focus', handleFocus)

    const unsubscribe = subscribeStaffEvents((event) => {
      if (event.type === 'BOARDING_STATUS_CHANGED' || event.type === 'FLIGHT_UPDATED' || event.type === 'REFRESH_ALL') {
        fetchFlights()
      }
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let stream: MediaStream | null = null
    let isMounted = true

    const startCamera = async () => {
      if (!isCameraActive) {
        setCameraError(null)
        return
      }
      setCameraError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Browser tidak mendukung akses kamera langsung.')
        return
      }

      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          })
        } catch {
          // Fallback untuk webcam laptop/PC yang tidak mendukung facingMode environment
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        }

        if (!isMounted) {
          stream?.getTracks().forEach((track) => track.stop())
          return
        }

        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})

          if ('BarcodeDetector' in window) {
            try {
              // @ts-ignore
              const detector = new window.BarcodeDetector({
                formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'pdf417'],
              })

              scanIntervalRef.current = setInterval(async () => {
                if (videoRef.current && !loading) {
                  try {
                    const barcodes = await detector.detect(videoRef.current)
                    if (barcodes && barcodes.length > 0) {
                      const detected = barcodes[0].rawValue
                      const trimmed = detected ? detected.trim() : ''
                      const now = Date.now()
                      if (
                        trimmed &&
                        (trimmed.toUpperCase() !== lastScanRef.current.code.toUpperCase() ||
                          now - lastScanRef.current.time > 3500)
                      ) {
                        handleVerify(trimmed)
                      }
                    }
                  } catch {
                    // ignore frame errors
                  }
                }
              }, 500)
            } catch {
              // fallback
            }
          }
        }
      } catch (err) {
        console.warn('Tidak dapat mengakses kamera perangkat:', err)
        if (isMounted) {
          setCameraError('Kamera perangkat tidak terdeteksi atau izin kamera belum diberikan di browser.')
        }
      }
    }

    startCamera()

    return () => {
      isMounted = false
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isCameraActive, loading])

  const activeFlight = flights.find((f) => f.id === Number(selectedFlightId))
  const previewFlight = activeFlight || flights.find((f) => f.status !== 'cancelled') || flights[0]
  const isCancelled = activeFlight?.status === 'cancelled'
  const isGateInactive = selectedFlightId !== 'all' && isCancelled

  const activeGate = activeFlight
    ? activeFlight.gate || getGateForFlight(activeFlight.id)
    : selectedGate !== 'all'
    ? selectedGate
    : 'Gate 14'

  const totalPax = activeFlight
    ? activeFlight.passenger_count || activeFlight.total_capacity || 180
    : previewFlight?.passenger_count || previewFlight?.total_capacity || 180
  const boardedPax = activeFlight ? activeFlight.boarded_count || 0 : previewFlight?.boarded_count || 0
  const checkedInPax = activeFlight
    ? activeFlight.checked_in_count || 0
    : previewFlight?.checked_in_count || 0
  const remainingPax = Math.max(0, totalPax - boardedPax)
  const boardingPct = totalPax > 0 ? Math.min(100, Math.round((boardedPax / totalPax) * 100)) : 0

  // Deterministic pre-boarded seats on the cabin visualizer + any scanned seats
  const boardedSeatSet = useMemo(() => {
    const set = new Set<string>(['1A', '1D', '2C', '10A', '10B', '11D', '11F', '12A', '12C', '14F', '15B', '16C', '16D', '17A'])
    recentScans.forEach((s) => {
      if (s.status === 'boarded' && s.seat) set.add(s.seat.toUpperCase())
    })
    if (scanResult.status === 'valid' && scanResult.data?.seat_number) {
      set.add(scanResult.data.seat_number.toUpperCase())
    }
    return set
  }, [recentScans, scanResult])

  const highlightedSeat = scanResult.data?.seat_number?.toUpperCase() || null

  const handleFlightSelectChange = (newId: string) => {
    setSelectedFlightId(newId)
    if (newId === 'all') {
      setSearchParams({})
      setStoreFlightId(null)
    } else {
      setSearchParams({ flightId: newId })
      const num = Number(newId)
      setStoreFlightId(num)
      const found = flights.find((f) => f.id === num)
      if (found && found.gate) {
        setSelectedGate(found.gate)
      }
    }
    setScanResult({ status: 'idle' })
    inputRef.current?.focus()
  }

  const handleVerify = async (codeToVerify?: string) => {
    if (isGateInactive) return

    const raw = (codeToVerify || inputCode).trim()
    if (!raw) return

    const now = Date.now()
    if (
      lastScanRef.current.code.toUpperCase() === raw.toUpperCase() &&
      now - lastScanRef.current.time < 3000
    ) {
      return
    }
    lastScanRef.current = { code: raw, time: now }

    setLoading(true)
    const timeFormatted =
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'

    try {
      const res = await api.post<{
        error: boolean
        message: string
        data: VerifyPassengerData
      }>('/staff/verify-boarding', {
        boarding_pass_code: raw,
        flight_schedule_id: selectedFlightId !== 'all' ? Number(selectedFlightId) : undefined,
      })

      const passengerData = res.data?.data

      if (!isAudioMuted) {
        gateAudio.playSuccess()
      }

      setScanResult({
        status: 'valid',
        data: passengerData,
        timestamp: timeFormatted,
      })

      setRecentScans((prev) => [
        {
          id: String(Date.now()),
          name: passengerData.passenger_name,
          seat: passengerData.seat_number,
          flightNumber: passengerData.flight_number,
          airlineName: passengerData.airline?.name,
          airlineCode: passengerData.airline?.code,
          pnr: passengerData.booking_code,
          time: timeFormatted,
          status: 'boarded',
        },
        ...prev.slice(0, 5),
      ])

      broadcastStaffEvent({
        type: 'BOARDING_STATUS_CHANGED',
        flightId: passengerData.flight_schedule_id,
        checkInId: passengerData.check_in_id,
      })

      fetchFlights()

      const airlineInfo = passengerData.airline?.name ? `${passengerData.airline.name} ` : ''
      setToastMessage(
        `${passengerData.passenger_name} (${airlineInfo}${passengerData.flight_number} · Kursi ${passengerData.seat_number}) terverifikasi masuk kabin.`
      )
      setInputCode('')
    } catch (err: any) {
      if (!isAudioMuted) {
        gateAudio.playError()
      }

      const errCode = err.response?.data?.code
      const errMsg = err.response?.data?.message || 'Kode boarding pass tidak valid'
      const errData = err.response?.data?.data as VerifyPassengerData | undefined

      if (errCode === 'WRONG_FLIGHT') {
        setScanResult({
          status: 'wrong_flight',
          data: errData || null,
          errorMessage: errMsg,
          timestamp: timeFormatted,
        })

        if (errData) {
          setRecentScans((prev) => [
            {
              id: String(Date.now()),
              name: errData.passenger_name || 'Penumpang',
              seat: errData.seat_number || 'N/A',
              flightNumber: errData.flight_number || 'Lain',
              airlineName: errData.airline?.name,
              airlineCode: errData.airline?.code,
              pnr: errData.booking_code || raw,
              time: timeFormatted,
              status: 'wrong_flight',
            },
            ...prev.slice(0, 5),
          ])
        }
      } else if (errCode === 'ALREADY_BOARDED') {
        setScanResult({
          status: 'already',
          data: errData || null,
          errorMessage: errMsg,
          timestamp: timeFormatted,
        })

        if (errData) {
          setRecentScans((prev) => [
            {
              id: String(Date.now()),
              name: errData.passenger_name,
              seat: errData.seat_number,
              flightNumber: errData.flight_number,
              airlineName: errData.airline?.name,
              airlineCode: errData.airline?.code,
              pnr: errData.booking_code,
              time: timeFormatted,
              status: 'already',
            },
            ...prev.slice(0, 5),
          ])
        }
        setToastMessage(
          `Peringatan Duplikat: ${errData?.passenger_name || 'Penumpang'} sudah tercatat masuk kabin sebelumnya.`
        )
      } else {
        setScanResult({
          status: 'invalid',
          errorMessage: errMsg,
          timestamp: timeFormatted,
        })
      }
      setInputCode('')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleVerify()
    } else if (e.key === 'Escape') {
      setScanResult({ status: 'idle' })
      setInputCode('')
    }
  }

  const formatTimeOnly = (iso?: string | null) => {
    if (!iso) return '08:00'
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      })
    } catch {
      return '08:00'
    }
  }

  const getSeatPosition = (seatNum?: string) => {
    if (!seatNum) return 'Standard'
    const letter = seatNum.slice(-1).toUpperCase()
    if (['A', 'F'].includes(letter)) return 'Window'
    if (['C', 'D'].includes(letter)) return 'Aisle'
    if (['B', 'E'].includes(letter)) return 'Middle'
    return 'Cabin'
  }

  const displayOrigin =
    scanResult.data?.origin ||
    activeFlight?.origin ||
    previewFlight?.origin || { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta' }

  const displayDest =
    scanResult.data?.destination ||
    activeFlight?.destination ||
    previewFlight?.destination || { code: 'DPS', city: 'Denpasar', name: 'Ngurah Rai' }

  const displayAirline =
    scanResult.data?.airline ||
    activeFlight?.airline ||
    previewFlight?.airline || { name: 'Garuda Indonesia', code: 'GA' }

  const displayFlightNumber =
    scanResult.data?.flight_number ||
    activeFlight?.flight_number ||
    previewFlight?.flight_number ||
    'GA 402'

  const displayAirplane =
    scanResult.data?.airplane?.model ||
    activeFlight?.airplane?.model ||
    previewFlight?.airplane?.model ||
    'Boeing 737-800'

  const displayDepTime =
    scanResult.data?.departure_time ||
    activeFlight?.departure_time ||
    previewFlight?.departure_time

  const getInitials = (name?: string) => {
    if (!name) return 'PAX'
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <StaffLayout activeFlightId={selectedFlightId !== 'all' ? Number(selectedFlightId) : null}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col gap-7">
        {/* ─── TOP HEADER: OPEN WORKSPACE BAR ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AirlineLogo
              code={displayAirline.code}
              name={displayAirline.name}
              logo={displayAirline.logo}
              size="lg"
              className="rounded-2xl shadow-md"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-widest text-brand-fg">
                  {activeGate} · TERMINAL CONTROL
                </span>
                <span className="text-subtle">•</span>
                <span className="text-xs text-subtle font-mono">
                  {lastRefreshed || 'Realtime DCS'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight mt-0.5">
                {selectedFlightId === 'all'
                  ? 'Universal Gate Control'
                  : `${displayAirline.name} ${displayFlightNumber}`}
              </h1>
            </div>
          </div>

          {/* Right Pill Controls: Pos Gerbang + Filtered Flight Select */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pos Gerbang Tugas Staf (Gate Assignment) */}
            <div className="relative z-20 flex items-center bg-panel border border-line/80 rounded-full px-3.5 h-10 shadow-sm">
              <span className="material-symbols-outlined text-[17px] text-brand-fg mr-1.5 select-none">meeting_room</span>
              <span className="text-[11px] font-semibold text-subtle mr-1 hidden sm:inline">Pos:</span>
              <select
                id="gate-duty-select"
                value={selectedGate}
                onChange={(e) => {
                  const newGate = e.target.value
                  setSelectedGate(newGate)
                  if (newGate !== 'all') {
                    const nextFlight = flights.find((f) => (f.gate || getGateForFlight(f.id)) === newGate)
                    if (nextFlight) {
                      handleFlightSelectChange(String(nextFlight.id))
                    }
                  }
                }}
                className="bg-transparent text-xs font-bold text-brand-fg focus:outline-none cursor-pointer pr-1"
                title="Pilih Gerbang Penugasan Anda"
              >
                <optgroup label="Gerbang Tugas Staf (Gate Agent)">
                  {AVAILABLE_GATES.map((g) => (
                    <option key={g} value={g}>
                      📍 {g}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Pengawasan Terminal">
                  <option value="all">🌐 Semua Gerbang (Supervisor)</option>
                </optgroup>
              </select>
            </div>

            {/* Searchable Flight Selector with instant filter search bar */}
            <FlightSearchCombobox
              flights={flights}
              selectedFlightId={selectedFlightId}
              selectedGate={selectedGate}
              onSelectFlight={(flightId) => handleFlightSelectChange(flightId)}
              onSelectGate={(gate) => {
                setSelectedGate(gate)
                if (gate !== 'all') {
                  const nextFlight = flights.find((f) => (f.gate || getGateForFlight(f.id)) === gate)
                  if (nextFlight) {
                    handleFlightSelectChange(String(nextFlight.id))
                  }
                }
              }}
              allowUniversalOption={true}
            />

            <button
              type="button"
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className="h-10 px-4 rounded-full bg-panel/90 border border-line/80 hover:bg-raised text-xs font-semibold text-ink flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-brand-fg">
                {isAudioMuted ? 'volume_off' : 'volume_up'}
              </span>
              <span>{isAudioMuted ? 'Muted' : 'Chime On'}</span>
            </button>

            {selectedFlightId !== 'all' && activeFlight && (
              <Link
                to={`/staff/flights/${activeFlight.id}/manifest`}
                className="h-10 px-4 rounded-full bg-ink text-page hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-opacity"
              >
                <span>Buka Manifest</span>
                <span className="material-symbols-outlined text-[15px]">arrow_outward</span>
              </Link>
            )}
          </div>
        </div>

        {/* ─── MAIN ASYMMETRIC DRIBBBLE OPERATIONS WORKSPACE (7 COLS LEFT + 5 COLS RIGHT) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ════ LEFT 7 COLUMNS: GATE SCANNER + PASSENGER DOSSIER + CABIN TELEMETRY ════ */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* 1. Sleek Pill Scanner Command Bar */}
            <div className="relative flex items-center bg-panel rounded-2xl p-1.5 shadow-lg border border-line/60 focus-within:border-brand-fg transition-all">
              <span className="material-symbols-outlined pl-3.5 pr-2 text-[22px] text-brand-fg select-none">
                barcode_scanner
              </span>
              <input
                ref={inputRef}
                id="barcode-input"
                type="text"
                disabled={isGateInactive || loading}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isGateInactive
                    ? 'Gerbang telah ditutup...'
                    : 'Scan barcode boarding pass atau ketik PNR penumpang...'
                }
                className="flex-1 h-11 bg-transparent text-ink text-sm font-mono font-bold uppercase tracking-wider placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-subtle focus:outline-none"
              />
              {inputCode && (
                <button
                  type="button"
                  onClick={() => {
                    setInputCode('')
                    inputRef.current?.focus()
                  }}
                  className="px-2.5 py-1 text-xs text-subtle hover:text-ink cursor-pointer"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                disabled={isGateInactive}
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer mr-1.5 ${
                  isCameraActive
                    ? 'bg-ink text-page'
                    : 'text-subtle hover:text-ink hover:bg-raised'
                }`}
                title="Gunakan Kamera Optik"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isCameraActive ? 'videocam_off' : 'photo_camera'}
                </span>
                <span className="hidden sm:inline">{isCameraActive ? 'Tutup' : 'Kamera'}</span>
              </button>
              <button
                type="button"
                disabled={isGateInactive || loading || !inputCode.trim()}
                onClick={() => handleVerify()}
                className="h-10 px-5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Scan...' : 'Verifikasi'}
              </button>
            </div>

            {/* Expandable Camera Viewport (Only visible when Camera is clicked) */}
            {isCameraActive && (
              <div className="relative w-full h-64 rounded-2xl bg-slate-950 overflow-hidden shadow-xl border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Optical Scanner Grid Overlay */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />
                {/* Corner Reticle Brackets */}
                <div className="relative z-10 w-52 h-40 pointer-events-none flex flex-col items-center justify-center">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-sky-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-sky-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-sky-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-sky-400 rounded-br-lg" />
                  {/* Animated Laser Line */}
                  <div className="w-44 h-0.5 bg-sky-400 shadow-[0_0_14px_#38bdf8] animate-pulse" />
                  {cameraError && (
                    <span className="material-symbols-outlined text-[42px] text-slate-600 mt-2">
                      qr_code_scanner
                    </span>
                  )}
                </div>
                {/* Top Status Pill */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700/70">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cameraError ? 'bg-amber-400' : 'bg-sky-400 animate-pulse'
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-slate-200">
                    {cameraError ? 'Optical Scanner Ready' : 'Live Camera Active'}
                  </span>
                </div>
                {/* Close Camera Button inside Viewport */}
                <button
                  type="button"
                  onClick={() => setIsCameraActive(false)}
                  className="absolute top-3 right-3 h-7 px-2.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/70 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  <span>Tutup</span>
                </button>
                {/* Bottom Guidance Label */}
                <span className="absolute bottom-3 px-3.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-slate-200 text-[11px] font-medium border border-slate-800">
                  {cameraError || 'Arahkan barcode atau QR boarding pass ke area bidik'}
                </span>
              </div>
            )}

            {/* 2. STAFF PASSENGER VERIFICATION SPOTLIGHT (OR FLIGHT TELEMETRY OVERVIEW WHEN IDLE) */}
            {scanResult.status !== 'idle' && scanResult.data ? (
              <div className="relative rounded-3xl bg-gradient-to-br from-panel via-panel to-raised/80 p-6 sm:p-8 shadow-xl border border-line/60 overflow-hidden">
                {/* Soft Ambient Aura Glow based on state (Not a harsh block) */}
                <div
                  className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
                    scanResult.status === 'valid'
                      ? 'bg-sky-500/15'
                      : scanResult.status === 'wrong_flight'
                      ? 'bg-amber-500/15'
                      : 'bg-rose-500/15'
                  }`}
                />

                {/* Top Status & Sequence Row */}
                <div className="relative z-10 flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide flex items-center gap-2 ${
                        scanResult.status === 'valid'
                          ? 'bg-sky-500/15 text-sky-400'
                          : scanResult.status === 'wrong_flight'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      <span>
                        {scanResult.status === 'valid'
                          ? 'VERIFIED · CLEARED TO BOARD'
                          : scanResult.status === 'wrong_flight'
                          ? 'GATE MISMATCH · WRONG FLIGHT'
                          : 'DUPLICATE SCAN · ALREADY BOARDED'}
                      </span>
                    </span>
                  </div>
                  <span className="font-mono text-xs text-subtle">
                    {scanResult.timestamp}
                  </span>
                </div>

                {/* Passenger Identity & Seat Spotlight */}
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-7 border-b border-line/50">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-sky-500 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shrink-0">
                      {getInitials(scanResult.data.passenger_name)}
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle block">
                        Identitas Penumpang Manifest
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-ink tracking-tight mt-0.5">
                        {scanResult.data.passenger_name}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-subtle font-mono">
                        <span>PNR: <strong className="text-ink">{scanResult.data.booking_code}</strong></span>
                        <span>•</span>
                        <span>{scanResult.data.boarding_pass_code}</span>
                      </div>
                    </div>
                  </div>

                  {/* Highlighted Cabin Seat Callout */}
                  <div className="flex items-center gap-4 sm:text-right bg-raised/70 px-5 py-3.5 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-subtle block">
                        KURSI KABIN
                      </span>
                      <span className="text-4xl font-black font-mono text-brand-fg tracking-tight leading-none block mt-1">
                        {scanResult.data.seat_number}
                      </span>
                      <span className="text-[11px] text-subtle font-medium block mt-1">
                        {getSeatPosition(scanResult.data.seat_number)} · {(scanResult.data.seat_class || 'Economy').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flight & Gate Telemetry Strip */}
                <div className="relative z-10 grid grid-cols-3 gap-4 pt-6 text-xs">
                  <div>
                    <span className="text-subtle block text-[11px]">Penerbangan</span>
                    <strong className="text-ink text-sm font-bold block mt-0.5">
                      {scanResult.data.airline?.name || displayAirline.name} ({scanResult.data.flight_number})
                    </strong>
                  </div>
                  <div>
                    <span className="text-subtle block text-[11px]">Rute Keberangkatan</span>
                    <strong className="text-ink text-sm font-bold font-mono block mt-0.5">
                      {scanResult.data.origin?.code || displayOrigin.code} → {scanResult.data.destination?.code || displayDest.code}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-subtle block text-[11px]">Tindakan Petugas</span>
                    <button
                      type="button"
                      onClick={() => {
                        setScanResult({ status: 'idle' })
                        inputRef.current?.focus()
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-brand-fg hover:underline font-bold cursor-pointer"
                    >
                      <span>Lanjut Scan Berikutnya</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Wrong Gate Alert Callout */}
                {scanResult.status === 'wrong_flight' && (
                  <div className="relative z-10 mt-5 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3.5 text-xs text-ink">
                    <span className="material-symbols-outlined text-amber-500 text-[24px] shrink-0 mt-0.5">
                      wrong_location
                    </span>
                    <div className="flex-1">
                      <strong className="block font-bold text-amber-600 dark:text-amber-400 text-sm">
                        PERINGATAN: PENUMPANG SALAH GERBANG / SALAH PESAWAT!
                      </strong>
                      <p className="mt-1 leading-relaxed">
                        Tiket boarding pass penumpang ini milik jadwal{' '}
                        <strong>{scanResult.data.airline?.name || ''} {scanResult.data.flight_number}</strong> di{' '}
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 font-black text-amber-700 dark:text-amber-300">
                          {getGateForFlight(scanResult.data.flight_schedule_id || 1)}
                        </span>
                        , BUKAN di <strong>{activeGate}</strong>. Mohon instruksikan penumpang segera menuju gerbang yang benar.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : scanResult.status === 'invalid' ? (
              <div className="rounded-3xl bg-panel p-7 shadow-lg border border-line/60 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400 block">
                    KODE TIDAK TERDAFTAR
                  </span>
                  <h3 className="text-lg font-bold text-ink mt-1">
                    {scanResult.errorMessage || 'Data boarding pass tidak ditemukan di manifest check-in.'}
                  </h3>
                  <p className="text-xs text-subtle mt-1">
                    Arahkan penumpang ke meja layanan check-in untuk verifikasi dokumen perjalanan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScanResult({ status: 'idle' })}
                  className="px-4 py-2 rounded-xl bg-raised text-ink text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            ) : (
              /* IDLE STATE: Clean Flight Telemetry & Cabin Occupancy Overview (No Empty Placeholder Boxes!) */
              <div className="rounded-3xl bg-gradient-to-br from-panel via-panel to-raised/60 p-6 sm:p-8 shadow-lg border border-line/60 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-subtle block">
                      TELEMETRI KEBERANGKATAN AKTIF
                    </span>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-3xl sm:text-4xl font-black text-ink font-mono tracking-tight">
                        {displayOrigin.code}
                      </span>
                      <span className="text-brand-fg font-mono text-lg">──── ✈ ────</span>
                      <span className="text-3xl sm:text-4xl font-black text-ink font-mono tracking-tight">
                        {displayDest.code}
                      </span>
                    </div>
                    <span className="text-xs text-subtle block mt-1">
                      {displayOrigin.city} ke {displayDest.city} · Jadwal {formatTimeOnly(displayDepTime)} WIB · {displayAirplane}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-4xl font-black font-mono text-brand-fg tabular-nums block leading-none">
                      {boardingPct}%
                    </span>
                    <span className="text-xs text-subtle font-medium block mt-1">
                      Keterisian Boarding Kabin
                    </span>
                  </div>
                </div>

                {/* Smooth Segmented Occupancy Bar */}
                <div className="w-full h-3 rounded-full bg-raised overflow-hidden flex p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-sky-400 transition-all duration-500"
                    style={{ width: `${Math.max(5, boardingPct)}%` }}
                  />
                </div>

                {/* 3 Clean Metric Columns (Without nested box borders) */}
                <div className="grid grid-cols-3 gap-6 pt-2 border-t border-line/50">
                  <div>
                    <span className="text-xs text-subtle block">Sudah Boarding</span>
                    <span className="text-2xl font-black text-ink font-mono tabular-nums mt-0.5 block">
                      {boardedPax} <span className="text-xs font-normal text-subtle">pax</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-subtle block">Sudah Check-In</span>
                    <span className="text-2xl font-black text-ink font-mono tabular-nums mt-0.5 block">
                      {checkedInPax} <span className="text-xs font-normal text-subtle">pax</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-subtle block">Belum Naik</span>
                    <span className="text-2xl font-black text-ink font-mono tabular-nums mt-0.5 block">
                      {remainingPax} <span className="text-xs font-normal text-subtle">pax</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Live Gate Boarding Stream (Clean Minimal List + Quick Simulation Triggers) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-subtle">
                  Aliran Penumpang Masuk ({recentScans.length})
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-subtle">Uji cepat:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setScanResult({
                        status: 'valid',
                        data: {
                          check_in_id: 1,
                          passenger_id: 1,
                          passenger_name: 'Budi Santoso',
                          seat_number: '14A',
                          seat_class: 'economy',
                          flight_schedule_id: activeFlight?.id || 1,
                          flight_number: displayFlightNumber,
                          airline: displayAirline,
                          origin: displayOrigin,
                          destination: displayDest,
                          departure_time: displayDepTime || new Date().toISOString(),
                          booking_code: '9JFCSZ',
                          boarding_pass_code: 'BP-9JFCSZ-1-RW',
                          status: 'boarded',
                        },
                        timestamp: new Date().toLocaleTimeString('id-ID') + ' WIB',
                      })
                    }
                    className="text-brand-fg hover:underline font-semibold cursor-pointer"
                  >
                    Kursi 14A (Valid)
                  </button>
                  <span className="text-line">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      setScanResult({
                        status: 'wrong_flight',
                        data: {
                          check_in_id: 2,
                          passenger_id: 2,
                          passenger_name: 'Siti Rahmawati',
                          seat_number: '12B',
                          flight_schedule_id: 99,
                          flight_number: 'JT 204',
                          airline: { name: 'Lion Air', code: 'JT' },
                          origin: { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta' },
                          destination: { code: 'SUB', city: 'Surabaya', name: 'Juanda' },
                          departure_time: new Date().toISOString(),
                          booking_code: 'P9L2M7',
                          boarding_pass_code: 'BP-P9L2M7-2-SR',
                          status: 'checked_in',
                        },
                        errorMessage: 'Tiket milik penerbangan Lion Air JT 204.',
                        timestamp: new Date().toLocaleTimeString('id-ID') + ' WIB',
                      })
                    }
                    className="text-subtle hover:text-ink font-medium cursor-pointer"
                  >
                    Salah Gate
                  </button>
                  <span className="text-line">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      setScanResult({
                        status: 'already',
                        data: {
                          check_in_id: 3,
                          passenger_id: 3,
                          passenger_name: 'Dewi Lestari',
                          seat_number: '15A',
                          flight_schedule_id: activeFlight?.id || 1,
                          flight_number: displayFlightNumber,
                          airline: displayAirline,
                          origin: displayOrigin,
                          destination: displayDest,
                          booking_code: 'P9L2M7',
                          boarding_pass_code: 'BP-P9L2M7-3-DL',
                          status: 'boarded',
                        },
                        errorMessage: 'Penumpang sudah tercatat naik sebelumnya.',
                        timestamp: new Date().toLocaleTimeString('id-ID') + ' WIB',
                      })
                    }
                    className="text-subtle hover:text-ink font-medium cursor-pointer"
                  >
                    Duplikat
                  </button>
                </div>
              </div>

              {recentScans.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {recentScans.map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-3 rounded-2xl bg-panel/70 hover:bg-panel flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-raised font-mono font-bold text-xs text-ink flex items-center justify-center shrink-0">
                          {item.seat}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-ink block truncate">
                            {item.name}
                          </span>
                          <span className="text-[11px] text-subtle font-mono">
                            {item.flightNumber} · PNR {item.pnr}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-subtle block">
                          {item.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-subtle px-1">
                  Penumpang yang baru saja melewati gerbang akan tampil secara berurutan di sini.
                </p>
              )}
            </div>
          </div>

          {/* ════ RIGHT 5 COLUMNS: INTERACTIVE AIRCRAFT FUSELAGE & CABIN SEAT RADAR ════ */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[380px] relative flex flex-col items-center">
              {/* Aircraft Fuselage Nose Cone SVG */}
              <div className="w-full flex flex-col items-center">
                <svg
                  viewBox="0 0 280 95"
                  className="w-[260px] h-[88px] overflow-visible select-none"
                  aria-hidden="true"
                >
                  {/* Fuselage Nose Curve */}
                  <path
                    d="M 10 95 C 10 35, 85 4, 140 4 C 195 4, 270 35, 270 95"
                    fill="currentColor"
                    className="text-panel"
                  />
                  <path
                    d="M 10 95 C 10 35, 85 4, 140 4 C 195 4, 270 35, 270 95"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-line"
                  />
                  {/* Cockpit Windshield Windows */}
                  <path
                    d="M 92 48 Q 140 30 188 48 L 178 60 Q 140 46 102 60 Z"
                    fill="currentColor"
                    className="text-brand-fg/25"
                  />
                  <text
                    x="140"
                    y="82"
                    textAnchor="middle"
                    className="fill-subtle font-mono text-[9px] font-bold uppercase tracking-widest"
                  >
                    FLIGHT DECK · {displayFlightNumber}
                  </text>
                </svg>
              </div>

              {/* Main Aircraft Cabin Body */}
              <div className="w-[260px] bg-panel border-x-[1.5px] border-b-[1.5px] border-line rounded-b-[36px] px-5 pt-2 pb-7 shadow-xl relative">
                {/* Left & Right Wing Silhouettes */}
                <div className="hidden sm:block absolute -left-14 top-1/2 -translate-y-1/2 w-14 h-36 bg-gradient-to-l from-brand-fg/10 to-transparent -skew-y-12 pointer-events-none rounded-l-lg" />
                <div className="hidden sm:block absolute -right-14 top-1/2 -translate-y-1/2 w-14 h-36 bg-gradient-to-r from-brand-fg/10 to-transparent skew-y-12 pointer-events-none rounded-r-lg" />

                {/* Column Letters Header (A B C  |  D E F) */}
                <div className="grid grid-cols-7 items-center text-center font-mono text-[10px] font-bold text-subtle pb-3 mb-2 border-b border-line/60">
                  {SEAT_COLS_LEFT.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                  <span className="text-[8px] text-subtle/50">••</span>
                  {SEAT_COLS_RIGHT.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>

                {/* Seat Rows Matrix */}
                <div className="flex flex-col gap-2">
                  {CABIN_ROWS.map((rowNum, idx) => {
                    const isWingExit = rowNum === 12 || rowNum === 14
                    return (
                      <div key={rowNum}>
                        {idx === 2 && (
                          <div className="my-2 py-1 text-center text-[9px] font-mono uppercase tracking-widest text-subtle border-y border-dashed border-line/60">
                            Economy Cabin
                          </div>
                        )}
                        <div className="grid grid-cols-7 items-center gap-1.5">
                          {SEAT_COLS_LEFT.map((col) => {
                            const seatId = `${rowNum}${col}`
                            const isTarget = highlightedSeat === seatId
                            const isOccupied = boardedSeatSet.has(seatId)
                            return (
                              <div
                                key={seatId}
                                title={`Kursi ${seatId}`}
                                className={`h-7 rounded-t-lg rounded-b-sm flex items-center justify-center font-mono text-[9px] font-bold transition-all ${
                                  isTarget
                                    ? 'bg-sky-400 text-slate-950 ring-4 ring-sky-400/30 scale-110 z-10 shadow-md'
                                    : isOccupied
                                    ? 'bg-brand/25 text-brand-fg'
                                    : 'bg-raised text-subtle/60'
                                }`}
                              >
                                {isTarget ? seatId : ''}
                              </div>
                            )
                          })}

                          {/* Center Aisle Row Number */}
                          <span
                            className={`text-center font-mono text-[10px] font-bold ${
                              isWingExit ? 'text-brand-fg' : 'text-subtle'
                            }`}
                          >
                            {rowNum}
                          </span>

                          {SEAT_COLS_RIGHT.map((col) => {
                            const seatId = `${rowNum}${col}`
                            const isTarget = highlightedSeat === seatId
                            const isOccupied = boardedSeatSet.has(seatId)
                            return (
                              <div
                                key={seatId}
                                title={`Kursi ${seatId}`}
                                className={`h-7 rounded-t-lg rounded-b-sm flex items-center justify-center font-mono text-[9px] font-bold transition-all ${
                                  isTarget
                                    ? 'bg-sky-400 text-slate-950 ring-4 ring-sky-400/30 scale-110 z-10 shadow-md'
                                    : isOccupied
                                    ? 'bg-brand/25 text-brand-fg'
                                    : 'bg-raised text-subtle/60'
                                }`}
                              >
                                {isTarget ? seatId : ''}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Cabin Legend */}
                <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between text-[10px] text-subtle">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" />
                    <span>Dipindai</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-brand/30 inline-block" />
                    <span>Boarded</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-raised inline-block" />
                    <span>Tersedia</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── TOAST NOTIFICATION ─── */}
        {toastMessage && (
          <aside
            aria-label="Notifikasi sistem"
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-panel border border-line text-ink px-4 py-3 rounded-2xl shadow-2xl"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-subtle hover:text-ink font-mono text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </aside>
        )}
      </div>
    </StaffLayout>
  )
}
