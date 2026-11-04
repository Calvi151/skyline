import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import StaffLayout from '../../components/layout/StaffLayout'
import { useStaffStore } from '../../store/staffStore'
import { broadcastStaffEvent, subscribeStaffEvents } from '../../lib/staffEvents'
import { gateAudio } from '../../lib/audioFeedback'
import { AirlineLogo } from '../../components/common/AirlineLogo'

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

export default function ScanBoarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const flightIdParam = searchParams.get('flightId')
  const {
    selectedFlightId: storedFlightId,
    setSelectedFlightId: setStoreFlightId,
    setSelectedGate,
    cachedFlights,
    setCachedFlights,
  } = useStaffStore()

  // Prioritas ID penerbangan: dari query param -> dari staffStore -> 'all'
  const initialFlightId = flightIdParam || (storedFlightId ? String(storedFlightId) : 'all')
  const [selectedFlightId, setSelectedFlightId] = useState<string>(initialFlightId)

  // SWR: Inisialisasi dari cachedFlights untuk load instan 0ms
  const [flights, setFlights] = useState<FlightScheduleItem[]>(cachedFlights)
  const [loadingFlights, setLoadingFlights] = useState(cachedFlights.length === 0)
  const [lastRefreshed, setLastRefreshed] = useState<string>('')

  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isSimOpen, setIsSimOpen] = useState(false)
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'valid' | 'already' | 'wrong_flight' | 'invalid'
    data?: VerifyPassengerData | null
    errorMessage?: string
    timestamp?: string
  }>({ status: 'idle' })

  const [recentScans, setRecentScans] = useState<ScanLogItem[]>([])
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanIntervalRef = useRef<any>(null)
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 })

  // Sync selected flight with query parameter
  useEffect(() => {
    if (flightIdParam) {
      setSelectedFlightId(flightIdParam)
    }
  }, [flightIdParam])

  const fetchFlights = async (isBackground = false) => {
    if (!isBackground) setLoadingFlights(true)
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
    } finally {
      if (!isBackground) setLoadingFlights(false)
    }
  }

  // Real-time polling daftar penerbangan setiap 3 detik + refetch saat window focus & event broadcast
  useEffect(() => {
    fetchFlights(false)

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchFlights(true)
      }
    }, 3000)

    const handleFocus = () => fetchFlights(true)
    window.addEventListener('focus', handleFocus)

    const unsubscribe = subscribeStaffEvents((event) => {
      if (event.type === 'BOARDING_STATUS_CHANGED' || event.type === 'FLIGHT_UPDATED' || event.type === 'REFRESH_ALL') {
        fetchFlights(true)
      }
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      unsubscribe()
    }
  }, [])

  // Auto-focus barcode input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle camera stream & native barcode detection if available
  useEffect(() => {
    let stream: MediaStream | null = null

    if (isCameraActive) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s
          if (videoRef.current) {
            videoRef.current.srcObject = s
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
                      // ignore scan frame errors
                    }
                  }
                }, 500)
              } catch {
                // BarcodeDetector initialization fallback
              }
            }
          }
        })
        .catch((err) => {
          console.warn('Tidak dapat mengakses kamera perangkat:', err)
          setIsCameraActive(false)
        })
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isCameraActive, loading])

  // Categorize flights (departing vs completed)
  const isFlightCompleted = (f?: FlightScheduleItem | null) => {
    if (!f?.departure_time) return false
    const dep = new Date(f.departure_time).getTime()
    return Date.now() - dep > 3 * 3600 * 1000
  }

  // Active flight context
  const activeFlight = flights.find((f) => f.id === Number(selectedFlightId))
  const isCancelled = activeFlight?.status === 'cancelled'
  const isCompleted = isFlightCompleted(activeFlight)
  const isGateInactive = selectedFlightId !== 'all' && (isCancelled || isCompleted)

  // Derived Gate label
  const activeGate = activeFlight
    ? activeFlight.gate || `Gate ${((activeFlight.id - 1) % 6) + 1}`
    : 'GATE UNIVERSAL'

  // Boarding percentage
  const totalPax = activeFlight ? activeFlight.passenger_count || activeFlight.total_capacity || 1 : 0
  const boardedPax = activeFlight ? activeFlight.boarded_count || 0 : 0
  const remainingPax = Math.max(0, totalPax - boardedPax)
  const boardingPct = totalPax > 0 ? Math.min(100, Math.round((boardedPax / totalPax) * 100)) : 0

  // Handle flight selector change
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

  // Handle Verify Boarding
  const handleVerify = async (codeToVerify?: string) => {
    if (isGateInactive) return

    const raw = (codeToVerify || inputCode).trim()
    if (!raw) return

    // Debounce & Cegah Double Scan pada barcode/PNR yang sama dalam 3 detik
    const now = Date.now()
    if (
      lastScanRef.current.code.toUpperCase() === raw.toUpperCase() &&
      now - lastScanRef.current.time < 3000
    ) {
      return
    }
    lastScanRef.current = { code: raw, time: now }

    setLoading(true)
    const timeFormatted = new Date().toLocaleTimeString('id-ID', {
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

      // Mainkan suara sukses jika tidak dimute
      if (!isAudioMuted) {
        gateAudio.playSuccess()
      }

      setScanResult({
        status: 'valid',
        data: passengerData,
        timestamp: timeFormatted,
      })

      // Add to recent scans log
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

      // Broadcast update realtime ke seluruh tab staf
      broadcastStaffEvent({
        type: 'BOARDING_STATUS_CHANGED',
        flightId: passengerData.flight_schedule_id,
        checkInId: passengerData.check_in_id,
      })

      // Refresh data flights agar statistik penumpang naik terupdate seketika
      fetchFlights(true)

      const airlineInfo = passengerData.airline?.name ? `${passengerData.airline.name} ` : ''
      setToastMessage(
        `${passengerData.passenger_name} (${airlineInfo}${passengerData.flight_number} • Kursi ${passengerData.seat_number}) diverifikasi naik pesawat.`
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
        setToastMessage(`⚠️ DITOLAK: Barcode sudah digunakan! Penumpang ${errData?.passenger_name || ''} tercatat sudah masuk pesawat sebelumnya.`)
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

  // Handle Enter key for fast barcode scanners
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleVerify()
    } else if (e.key === 'Escape') {
      setScanResult({ status: 'idle' })
      setInputCode('')
    }
  }

  // Format Indonesian date/time helpers
  const formatTimeStr = (iso?: string | null) => {
    if (!iso) return '--.-- WIB'
    try {
      const d = new Date(iso)
      return (
        d.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Jakarta',
        }) + ' WIB'
      )
    } catch {
      return '--.-- WIB'
    }
  }

  // Helper to determine seat type (Window, Aisle, Middle)
  const getSeatPosition = (seatNum?: string) => {
    if (!seatNum) return 'Kabin Standar'
    const letter = seatNum.slice(-1).toUpperCase()
    if (['A', 'F'].includes(letter)) return 'Jendela (Window)'
    if (['C', 'D'].includes(letter)) return 'Lorong (Aisle)'
    if (['B', 'E'].includes(letter)) return 'Tengah (Middle)'
    return 'Kabin Terverifikasi'
  }

  return (
    <StaffLayout activeFlightId={selectedFlightId !== 'all' ? Number(selectedFlightId) : null}>
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5">
        {/* ─── 1. MISSION-CRITICAL DCS OPERATIONS COMMAND BAR ─── */}
        <div className="bg-panel border border-line rounded-ticket shadow-sm overflow-hidden">
          {/* Top row: Gate ID, Mode Selector, Audio & Sync indicator */}
          <div className="bg-raised/80 border-b border-line px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Gate Callout Tag */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded bg-brand text-white font-mono font-black text-xs tracking-wider uppercase shadow-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">meeting_room</span>
                  <span>{activeGate}</span>
                </span>
                <span className="text-subtle font-medium hidden sm:inline">|</span>
                <span className="font-bold text-ink hidden sm:inline">DCS Gate Terminal Console</span>
              </div>

              {/* Mode Selector Dropdown */}
              <div className="flex items-center gap-2">
                <label htmlFor="flight-select" className="text-subtle font-semibold hidden md:inline">
                  Mode Operasi:
                </label>
                <div className="relative">
                  <select
                    id="flight-select"
                    disabled={loadingFlights}
                    value={selectedFlightId}
                    onChange={(e) => handleFlightSelectChange(e.target.value)}
                    className="h-8 pl-3 pr-8 rounded-control bg-panel border border-line text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-fg cursor-pointer disabled:opacity-60 shadow-2xs appearance-none"
                  >
                    <option value="all">🌐 Auto-Detect Universal (Semua Maskapai)</option>
                    {flights.map((f) => {
                      const isDone = isFlightCompleted(f)
                      const isCanc = f.status === 'cancelled'
                      const inactive = isDone || isCanc
                      const gateLabel = f.gate || `Gate ${((f.id - 1) % 6) + 1}`
                      return (
                        <option key={f.id} value={String(f.id)} disabled={inactive}>
                          {gateLabel} • {f.airline?.code || 'XX'} {f.flight_number} • {f.origin?.code}→{f.destination?.code} ({formatTimeStr(f.departure_time)})
                          {inactive ? ` [${isCanc ? 'BATAL' : 'SELESAI'}]` : ''}
                        </option>
                      )
                    })}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-subtle pointer-events-none">
                    unfold_more
                  </span>
                </div>
              </div>
            </div>

            {/* Right Tools: Audio Chime Toggle, Live Radar Pulse, Time */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className={`h-8 px-2.5 rounded-control border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isAudioMuted
                    ? 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20'
                    : 'bg-panel border-line text-ink hover:bg-tint'
                }`}
                title={isAudioMuted ? 'Suara Chime Gate Dibisukan' : 'Suara Chime Gate Aktif'}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isAudioMuted ? 'volume_off' : 'volume_up'}
                </span>
                <span className="hidden sm:inline">{isAudioMuted ? 'Audio Bisu' : 'Audio Aktif'}</span>
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint text-brand-fg font-mono text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span>ONLINE DCS</span>
                <span className="text-subtle font-normal">({lastRefreshed || 'live'})</span>
              </div>
            </div>
          </div>

          {/* Active Flight Dashboard Banner */}
          <div className="p-5 md:p-6 bg-panel">
            {selectedFlightId === 'all' ? (
              /* Universal Auto-Detect Mode Header */
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-tint flex items-center justify-center text-brand-fg shrink-0 border border-brand/20">
                    <span className="material-symbols-outlined text-[28px]">travel_explore</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg md:text-xl font-black text-ink tracking-tight">
                        Scanner Universal Multi-Maskapai
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full bg-tint text-brand-fg text-xs font-bold uppercase tracking-wider">
                        Auto-Routing Aktif
                      </span>
                    </div>
                    <p className="text-subtle text-xs mt-1 leading-relaxed max-w-2xl">
                      Pindai boarding pass penerbangan apa pun. Sistem mengenali nomor penerbangan, manifest rute, dan penumpang secara otomatis tanpa perlu mengunci gerbang.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <span className="text-xs text-subtle font-medium">Siap Pindai:</span>
                  <span className="px-3 py-1.5 rounded-control bg-raised border border-line text-ink font-mono font-bold text-xs">
                    {flights.length} Jadwal Hari Ini
                  </span>
                </div>
              </div>
            ) : activeFlight ? (
              /* Locked Specific Gate Flight Header */
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Flight & Airline Details */}
                <div className="flex items-start gap-4 min-w-0">
                  <AirlineLogo
                    code={activeFlight.airline?.code}
                    name={activeFlight.airline?.name}
                    logo={activeFlight.airline?.logo}
                    size="xl"
                    className="shrink-0 rounded-xl shadow-xs border border-line"
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xl md:text-2xl font-black text-ink tracking-tight">
                        {activeFlight.airline?.name || 'Maskapai'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded font-mono font-black text-sm bg-panel border border-line text-ink shadow-2xs">
                        {activeFlight.flight_number}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                          activeFlight.status === 'delayed'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : activeFlight.status === 'cancelled'
                            ? 'bg-danger/15 text-danger'
                            : isCompleted
                            ? 'bg-subtle/15 text-subtle'
                            : 'bg-success/15 text-success'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>
                          {activeFlight.status === 'delayed'
                            ? `Tertunda ${activeFlight.delay_minutes}m`
                            : activeFlight.status === 'cancelled'
                            ? 'Penerbangan Dibatalkan'
                            : isCompleted
                            ? 'Gerbang Ditutup'
                            : 'Boarding Berlangsung'}
                        </span>
                      </span>
                    </div>

                    {/* Route & Times */}
                    <div className="flex items-center gap-2 mt-2 text-xs text-subtle flex-wrap">
                      <span className="font-extrabold text-ink text-sm">
                        {activeFlight.origin?.city} ({activeFlight.origin?.code})
                      </span>
                      <span className="material-symbols-outlined text-[16px] text-brand-fg">
                        arrow_forward
                      </span>
                      <span className="font-extrabold text-ink text-sm">
                        {activeFlight.destination?.city} ({activeFlight.destination?.code})
                      </span>
                      <span className="text-line">•</span>
                      <span>
                        Keberangkatan <strong className="text-ink font-mono font-bold">{formatTimeStr(activeFlight.departure_time)}</strong>
                      </span>
                      {activeFlight.airplane && (
                        <>
                          <span className="text-line">•</span>
                          <span className="font-mono">{activeFlight.airplane.model} ({activeFlight.airplane.registration_number})</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Real-time Boarding Progress Gauge */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 lg:gap-8 bg-raised/70 p-4 rounded-ticket border border-line shrink-0">
                  <div className="flex flex-col gap-1.5 min-w-[200px]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-subtle uppercase tracking-wider text-[10px]">
                        Progres Boarding Kabin
                      </span>
                      <span className="font-mono font-black text-brand-fg text-sm">
                        {boardingPct}%
                      </span>
                    </div>
                    {/* Modern segmented progress bar */}
                    <div className="w-full h-2.5 rounded-full bg-page border border-line overflow-hidden p-0.5 flex">
                      <div
                        className="h-full rounded-full bg-success transition-all duration-500 ease-out"
                        style={{ width: `${boardingPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-subtle mt-0.5">
                      <span><strong className="text-success font-bold font-mono">{boardedPax}</strong> Naik</span>
                      <span><strong className="text-ink font-bold font-mono">{remainingPax}</strong> Tersisa</span>
                      <span>Total <strong className="text-ink font-bold font-mono">{totalPax}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-line pt-3 sm:pt-0 sm:pl-5">
                    <Link
                      to={`/staff/flights/${activeFlight.id}/manifest`}
                      className="h-10 px-4 rounded-control bg-panel border border-line hover:border-brand hover:text-brand-fg text-ink font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">table_chart</span>
                      <span>Manifest</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-subtle text-xs py-2">
                <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span>Memuat data radar gerbang penerbangan...</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── OPERATIONAL ALERT: GERBANG NONAKTIF / SELESAI ─── */}
        {isGateInactive && (
          <div className="bg-danger/10 border-2 border-danger/30 rounded-ticket p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-danger shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">block</span>
              </div>
              <div>
                <span className="font-extrabold text-sm block tracking-tight">GERBANG INAKTIF ATAU TELAH DITUTUP</span>
                <span className="text-xs text-danger/90">
                  Penerbangan {activeFlight?.flight_number} {isCancelled ? 'telah dibatalkan resmi' : 'telah selesai/takeoff'}. Pemindaian gerbang ditangguhkan.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleFlightSelectChange('all')}
              className="px-4 py-2 rounded-control bg-danger text-white font-bold text-xs shrink-0 hover:bg-danger/90 transition-colors shadow-xs cursor-pointer"
            >
              Beralih ke Auto-Detect Universal
            </button>
          </div>
        )}

        {/* ─── 2. MAIN 2-COLUMN SPLIT AIRPORT GATE CONSOLE ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT COLUMN: SCANNER INPUT & OPTICAL CONTROLLER (5 Cols) ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* CARD 1: Hardware & Keyboard Barcode Terminal */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-fg text-[20px]">barcode_scanner</span>
                  <span className="font-bold text-sm text-ink">Pemindai Barcode &amp; PNR</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-success/15 text-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span>Hardware Ready</span>
                </span>
              </div>

              <div>
                <label htmlFor="barcode-input" className="text-xs font-semibold text-subtle block mb-1.5">
                  Scan Barcode Laser, Kamera, atau Ketik Kode PNR 6 Digit:
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[22px] text-brand-fg">
                    qr_code_scanner
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
                        ? 'Gerbang nonaktif...'
                        : 'Contoh: BP-9JFCSZ-1-XYZ atau 9JFCSZ'
                    }
                    className={`w-full h-13 pl-12 pr-10 rounded-control border-2 text-ink text-sm sm:text-base font-mono tracking-wider focus:outline-none transition-all font-black uppercase ${
                      isGateInactive
                        ? 'bg-raised/70 border-line text-subtle cursor-not-allowed'
                        : 'bg-page border-brand/70 focus:border-brand focus:ring-4 focus:ring-brand/15'
                    }`}
                  />
                  {inputCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputCode('')
                        inputRef.current?.focus()
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isGateInactive || loading || !inputCode.trim()}
                  onClick={() => handleVerify()}
                  className="flex-1 h-11 rounded-control bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Verifikasi Boarding [Enter]</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScanResult({ status: 'idle' })
                    setInputCode('')
                    inputRef.current?.focus()
                  }}
                  className="h-11 px-3.5 rounded-control bg-raised border border-line text-subtle hover:text-ink text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                  title="Reset Scanner (Esc)"
                >
                  <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                </button>
              </div>

              <div className="p-3 rounded-control bg-tint/60 border border-brand/15 flex items-start gap-2 text-[11px] text-subtle leading-normal">
                <span className="material-symbols-outlined text-brand-fg text-[16px] shrink-0 mt-0.5">keyboard</span>
                <span>
                  <strong>Tip Keyboard Staf:</strong> Arahkan gun scanner laser USB/Bluetooth langsung ke layar ini, barcode akan otomatis tersubmit saat terdeteksi enter.
                </span>
              </div>
            </div>

            {/* CARD 2: Optical Biometric / Camera HUD Viewfinder */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-fg text-[20px]">videocam</span>
                  <span className="font-bold text-sm text-ink">Sensor Optik Kamera</span>
                </div>
                <button
                  type="button"
                  disabled={isGateInactive}
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className={`h-7 px-3 rounded-full font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    isCameraActive
                      ? 'bg-danger text-white shadow-xs'
                      : 'bg-tint text-brand-fg hover:bg-brand hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isCameraActive ? 'videocam_off' : 'videocam'}
                  </span>
                  <span>{isCameraActive ? 'Matikan Kamera' : 'Nyalakan Kamera'}</span>
                </button>
              </div>

              {/* High-Tech Optical Viewfinder Box */}
              <div className="relative w-full aspect-video sm:aspect-square max-h-[300px] my-4 rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center border-2 border-line">
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand-fg shadow-inner">
                      <span className="material-symbols-outlined text-[36px] animate-pulse">
                        qr_code_2
                      </span>
                    </div>
                    <div>
                      <span className="text-white font-bold text-sm block">Optical Sensor Siaga</span>
                      <span className="text-slate-400 text-xs mt-0.5 block max-w-xs">
                        Nyalakan kamera perangkat untuk membaca QR boarding pass secara instan tanpa alat tambahan.
                      </span>
                    </div>
                  </div>
                )}

                {/* Laser Overlay Reticle */}
                {isCameraActive && (
                  <>
                    <div className="absolute top-4 left-4 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl pointer-events-none" />
                    <div className="absolute top-4 right-4 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr pointer-events-none" />
                    <div className="absolute bottom-4 left-4 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl pointer-events-none" />
                    <div className="absolute bottom-4 right-4 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br pointer-events-none" />
                    <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] opacity-90 animate-pulse pointer-events-none" />
                  </>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-subtle">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">sensors</span>
                  <span>Deteksi QR / PDF417 / Code 128</span>
                </span>
                <span className="font-mono text-[11px]">{isCameraActive ? 'Live Stream 30fps' : 'Standby'}</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: VERIFICATION RESULT HERO & AUDIT LOG (7 Cols) ── */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* ─── CASE 1: IDLE WAITING STATE ─── */}
            {scanResult.status === 'idle' && (
              <div className="bg-panel border-2 border-dashed border-line rounded-ticket p-10 text-center flex flex-col items-center justify-center gap-4 min-h-[380px] shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-tint text-brand-fg flex items-center justify-center border border-brand/20 shadow-sm">
                  <span className="material-symbols-outlined text-[36px]">contactless</span>
                </div>
                <div className="max-w-md">
                  <h3 className="font-black text-lg text-ink">Terminal Gate Siap Memindai</h3>
                  <p className="text-subtle text-xs mt-1.5 leading-relaxed">
                    Arahkan boarding pass penumpang ke scanner laser atau masukkan kode PNR 6 digit. Verifikasi manifest kabin akan diproses seketika.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-subtle font-semibold">
                  <span className="px-3 py-1 rounded-full bg-raised border border-line">
                    ✓ Anti-Duplikat Aktif
                  </span>
                  <span className="px-3 py-1 rounded-full bg-raised border border-line">
                    ✓ Sync Realtime DCS
                  </span>
                </div>
              </div>
            )}

            {/* ─── CASE 2: VALID & BOARDED (ACCESS GRANTED) ─── */}
            {scanResult.status === 'valid' && scanResult.data && (
              <div className="bg-panel border-2 border-emerald-500 rounded-ticket shadow-lg overflow-hidden animate-fadeIn">
                {/* Full-width High-Impact Emerald Header */}
                <div className="bg-emerald-600 text-white p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[28px]">verified</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base sm:text-lg tracking-wide uppercase">
                          BOARDING BERHASIL • SILAKAN MASUK
                        </span>
                      </div>
                      <span className="text-xs text-emerald-100 block">
                        Kabin terverifikasi. Penumpang resmi masuk manifest penerbangan.
                      </span>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-white/20 text-white font-mono font-bold text-xs uppercase tracking-wider">
                    APPROVED
                  </span>
                </div>

                {/* Main Boarding Pass Inspection Body */}
                <div className="p-6 flex flex-col gap-5">
                  {/* Top Metadata Strip */}
                  <div className="flex items-center justify-between pb-3 border-b border-line flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <AirlineLogo
                        code={scanResult.data.airline?.code}
                        name={scanResult.data.airline?.name}
                        logo={scanResult.data.airline?.logo}
                        size="sm"
                      />
                      <span className="font-bold text-ink">
                        {scanResult.data.airline?.name || 'Maskapai'} • {scanResult.data.flight_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="bg-tint text-brand-fg px-2.5 py-1 rounded font-bold">
                        PNR: {scanResult.data.booking_code}
                      </span>
                      <span className="text-subtle text-[11px] hidden sm:inline">
                        {scanResult.timestamp || 'Baru Saja'}
                      </span>
                    </div>
                  </div>

                  {/* Passenger Identity & Giant Hero Seat */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    {/* Left: Passenger Details */}
                    <div className="sm:col-span-8 flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-subtle uppercase tracking-wider">
                        Nama Lengkap Penumpang
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-ink tracking-tight uppercase">
                        {scanResult.data.passenger_name}
                      </h2>
                      <div className="flex items-center gap-2.5 mt-1 text-xs">
                        <span className="px-2.5 py-0.5 rounded bg-brand/10 text-brand-fg font-extrabold uppercase text-[11px]">
                          {scanResult.data.seat_class || 'Ekonomi'}
                        </span>
                        {scanResult.data.id_number && (
                          <span className="font-mono text-subtle text-xs">
                            ID: {scanResult.data.id_number}
                          </span>
                        )}
                        <span className="text-success font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">luggage</span>
                          <span>Kabin 7kg Lolos</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: Giant Hero Seat Callout */}
                    <div className="sm:col-span-4 bg-raised border-2 border-brand/30 rounded-2xl p-4 text-center shadow-xs flex flex-col justify-center items-center">
                      <span className="text-[10px] uppercase font-bold text-subtle tracking-wider block">
                        NOMOR KURSI
                      </span>
                      <span className="text-4xl sm:text-5xl font-black text-brand-fg tracking-tight font-mono my-1 leading-none">
                        {scanResult.data.seat_number}
                      </span>
                      <span className="text-[11px] font-bold text-ink block mt-1">
                        {getSeatPosition(scanResult.data.seat_number)}
                      </span>
                    </div>
                  </div>

                  {/* Route & Flight Segment Strip */}
                  <div className="bg-raised/70 border border-line rounded-control p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-subtle uppercase block">Rute Asal</span>
                      <strong className="text-ink font-mono text-sm">
                        {scanResult.data.origin?.code || 'CGK'}
                      </strong>
                      <span className="text-subtle text-[11px] block truncate">
                        {scanResult.data.origin?.city || 'Jakarta'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-subtle uppercase block">Rute Tujuan</span>
                      <strong className="text-ink font-mono text-sm">
                        {scanResult.data.destination?.code || 'DPS'}
                      </strong>
                      <span className="text-subtle text-[11px] block truncate">
                        {scanResult.data.destination?.city || 'Denpasar'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-subtle uppercase block">Jadwal Terbang</span>
                      <strong className="text-ink font-mono text-sm">
                        {formatTimeStr(scanResult.data.departure_time)}
                      </strong>
                      <span className="text-success text-[11px] font-semibold block">On Schedule</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-subtle uppercase block">Kode Tiket</span>
                      <strong className="text-brand-fg font-mono text-[11px] block truncate">
                        {scanResult.data.boarding_pass_code}
                      </strong>
                      <span className="text-success text-[11px] font-bold block">Status: Boarded</span>
                    </div>
                  </div>

                  {/* Action Strip */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-subtle">
                      Tekan tombol atau Enter untuk memindai penumpang selanjutnya.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setScanResult({ status: 'idle' })
                        inputRef.current?.focus()
                      }}
                      className="h-10 px-5 rounded-control bg-brand hover:bg-brand-hover text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <span>Pindai Berikutnya</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── CASE 3: DUPLICATE SCAN / ALREADY BOARDED (SECURITY ALERT) ─── */}
            {scanResult.status === 'already' && (
              <div className="bg-panel border-2 border-danger rounded-ticket shadow-xl overflow-hidden animate-fadeIn">
                {/* High-Stress Crimson Red Warning Banner */}
                <div className="bg-danger text-white p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-bounce">
                      <span className="material-symbols-outlined text-[28px]">gpp_bad</span>
                    </div>
                    <div>
                      <span className="font-black text-base sm:text-lg tracking-wide uppercase block">
                        AKSES DITOLAK: TIKET DUPLIKAT (SUDAH NAIK)
                      </span>
                      <span className="text-xs text-red-100 block">
                        Boarding pass ini sudah pernah divalidasi sebelumnya pada penerbangan ini!
                      </span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/25 text-white font-mono font-black text-xs uppercase tracking-wider shrink-0">
                    ACCESS DENIED
                  </span>
                </div>

                <div className="p-6 flex flex-col gap-4">
                  {/* Warning Details Box */}
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 flex items-start gap-3 text-xs text-danger">
                    <span className="material-symbols-outlined text-[24px] text-danger shrink-0 mt-0.5">
                      security
                    </span>
                    <div className="flex flex-col gap-1 leading-relaxed">
                      <strong className="text-danger font-bold text-sm">
                        Prosedur Keamanan Pintu Gerbang (Security Alert):
                      </strong>
                      <p className="text-ink text-xs">
                        Penumpang atas nama <strong>{scanResult.data?.passenger_name}</strong> (Kursi <strong>{scanResult.data?.seat_number}</strong>) tercatat telah melalui pemindaian gerbang sebelumnya.
                      </p>
                      <p className="text-danger font-semibold text-xs mt-1">
                        Sistem DCS tidak menduplikasi data di manifest. Jangan izinkan penumpang masuk jika dicurigai ada penggandaan kartu atau orang berbeda!
                      </p>
                    </div>
                  </div>

                  {/* Passenger Information */}
                  <div className="p-4 rounded-xl bg-raised border border-line flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <AirlineLogo
                        code={scanResult.data?.airline?.code || scanResult.data?.flight_number?.split('-')[0]}
                        name={scanResult.data?.airline?.name}
                        logo={scanResult.data?.airline?.logo}
                        size="md"
                        className="rounded-lg shadow-2xs shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-subtle uppercase block">Pemegang Tiket Terdaftar</span>
                        <h3 className="font-black text-lg text-ink truncate">{scanResult.data?.passenger_name}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-subtle font-mono truncate">
                          <span>PNR: {scanResult.data?.booking_code}</span>
                          <span>•</span>
                          <span>{scanResult.data?.airline?.name ? `${scanResult.data.airline.name} ` : ''}{scanResult.data?.flight_number}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-subtle uppercase block">Kursi Asli</span>
                      <span className="text-2xl font-black text-danger font-mono">{scanResult.data?.seat_number}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScanResult({ status: 'idle' })
                        inputRef.current?.focus()
                      }}
                      className="flex-1 h-11 rounded-control bg-danger hover:bg-danger/90 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      <span>Reset &amp; Pindai Penumpang Lain</span>
                    </button>
                    {scanResult.data?.flight_schedule_id && (
                      <Link
                        to={`/staff/flights/${scanResult.data.flight_schedule_id}/manifest`}
                        className="h-11 px-5 rounded-control bg-raised border border-line text-ink hover:bg-tint font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">table_chart</span>
                        <span>Lihat Manifest</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── CASE 4: WRONG FLIGHT / WRONG GATE (AMBER WARNING) ─── */}
            {scanResult.status === 'wrong_flight' && (
              <div className="bg-panel border-2 border-amber-500 rounded-ticket shadow-lg overflow-hidden animate-fadeIn">
                <div className="bg-amber-500 text-white p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[28px]">wrong_location</span>
                    </div>
                    <div>
                      <span className="font-black text-base sm:text-lg tracking-wide uppercase block">
                        SALAH GERBANG / SALAH PENERBANGAN
                      </span>
                      <span className="text-xs text-amber-100 block">
                        Tiket valid, namun terdaftar untuk penerbangan lain!
                      </span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/25 text-white font-mono font-bold text-xs uppercase tracking-wider shrink-0">
                    WRONG GATE
                  </span>
                </div>

                <div className="p-6 flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2 text-xs">
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                      Tujuan Asli Penumpang:
                    </span>
                    <div className="flex items-center justify-between text-ink text-sm font-bold gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <AirlineLogo
                          code={scanResult.data?.airline?.code || scanResult.data?.flight_number?.split('-')[0]}
                          name={scanResult.data?.airline?.name}
                          logo={scanResult.data?.airline?.logo}
                          size="sm"
                          className="rounded shrink-0"
                        />
                        <span className="truncate">{scanResult.data?.airline?.name} • Penerbangan {scanResult.data?.flight_number}</span>
                      </div>
                      <span className="font-mono text-amber-600 dark:text-amber-400 shrink-0">Kursi {scanResult.data?.seat_number}</span>
                    </div>
                    <div className="text-xs text-subtle mt-1">
                      Arahkan penumpang ke gerbang keberangkatan maskapai yang sesuai.
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScanResult({ status: 'idle' })
                        inputRef.current?.focus()
                      }}
                      className="flex-1 h-10 rounded-control bg-raised border border-line text-ink hover:bg-tint font-bold text-xs transition-colors cursor-pointer"
                    >
                      Pindai Penumpang Lain
                    </button>
                    {scanResult.data?.flight_schedule_id && (
                      <button
                        type="button"
                        onClick={() => {
                          handleFlightSelectChange(String(scanResult.data!.flight_schedule_id))
                        }}
                        className="h-10 px-5 rounded-control bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Buka Gerbang Penerbangan Ini
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── CASE 5: INVALID BARCODE / NOT FOUND (RED) ─── */}
            {scanResult.status === 'invalid' && (
              <div className="bg-panel border-2 border-danger/40 rounded-ticket p-6 shadow-xs flex flex-col gap-4 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-danger/15 text-danger flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">error</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-danger uppercase tracking-wide">
                      KODE BOARDING PASS TIDAK DITEMUKAN
                    </h3>
                    <p className="text-subtle text-xs mt-0.5">
                      {scanResult.errorMessage || 'Data tiket tidak terdaftar di sistem reservasi maupun manifest.'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-control bg-raised border border-line text-xs text-subtle leading-relaxed">
                  Pastikan penumpang telah menyelesaikan proses check-in online atau di counter bandara, atau periksa kembali kejelasan barcode cetak fisik.
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult({ status: 'idle' })
                      inputRef.current?.focus()
                    }}
                    className="h-10 px-5 rounded-control bg-brand hover:bg-brand-hover text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            )}

            {/* ─── 3. LIVE RECENT SCANS AUDIT LOG (Bottom Ticker) ─── */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-fg text-[18px]">history</span>
                  <span className="font-bold text-xs text-ink uppercase tracking-wider">
                    Log Pemindaian Terakhir Sesi Ini
                  </span>
                </div>
                <span className="text-[11px] text-subtle font-mono">
                  {recentScans.length} Aktivitas Terekam
                </span>
              </div>

              <div className="flex flex-col divide-y divide-line text-xs">
                {recentScans.length > 0 ? (
                  recentScans.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-tint/20 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            item.status === 'boarded'
                              ? 'bg-success/15 text-success'
                              : item.status === 'wrong_flight'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-danger/15 text-danger'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {item.status === 'boarded'
                              ? 'check'
                              : item.status === 'wrong_flight'
                              ? 'wrong_location'
                              : 'block'}
                          </span>
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-ink block truncate">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AirlineLogo
                              code={item.airlineCode || item.flightNumber.split('-')[0]}
                              name={item.airlineName}
                              size="xs"
                              className="rounded shrink-0"
                            />
                            <span className="text-[11px] text-subtle font-mono truncate">
                              {item.airlineName ? `${item.airlineName} ` : ''}{item.flightNumber} • Kursi {item.seat} • PNR: {item.pnr}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-subtle block font-mono">
                          {item.time}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            item.status === 'boarded'
                              ? 'bg-success/15 text-success'
                              : item.status === 'wrong_flight'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-danger/15 text-danger'
                          }`}
                        >
                          {item.status === 'boarded'
                            ? 'Boarded'
                            : item.status === 'wrong_flight'
                            ? 'Salah Gate'
                            : 'Ditolak'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-subtle">
                    Belum ada pemindaian tercatat pada sesi ini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 4. DISCREET COLLAPSIBLE SIMULATOR & QA TESTBENCH ─── */}
        <div className="bg-panel border border-line rounded-ticket shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsSimOpen(!isSimOpen)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-subtle hover:text-ink hover:bg-tint/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-brand-fg">science</span>
              <span>Simulator DCS &amp; QA Test Bench (Alat Pengujian Cepat)</span>
            </div>
            <span className="material-symbols-outlined text-[18px] transition-transform">
              {isSimOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {isSimOpen && (
            <div className="p-4 bg-raised/50 border-t border-line flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'valid',
                    data: {
                      check_in_id: 1,
                      passenger_id: 1,
                      passenger_name: 'Budi Test Passenger',
                      seat_number: '14A',
                      seat_class: 'economy',
                      flight_schedule_id: activeFlight?.id || 1,
                      flight_number: activeFlight?.flight_number || 'GA 142',
                      airline: activeFlight?.airline || { name: 'Garuda Indonesia', code: 'GA' },
                      origin: activeFlight?.origin || { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta' },
                      destination: activeFlight?.destination || { code: 'DPS', city: 'Denpasar', name: 'Ngurah Rai' },
                      departure_time: activeFlight?.departure_time || new Date().toISOString(),
                      booking_code: '9JFCSZ',
                      boarding_pass_code: 'BP-9JFCSZ-1-RW',
                      status: 'boarded',
                    },
                    timestamp: new Date().toLocaleTimeString('id-ID') + ' WIB',
                  })
                }
                className="px-3 py-1.5 rounded-control bg-panel border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Simulasi Valid (Masuk)</span>
              </button>

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
                    errorMessage: 'Kode boarding ini milik Lion Air JT 204 tujuan Surabaya (Gate 8)',
                    timestamp: new Date().toLocaleTimeString('id-ID') + ' WIB',
                  })
                }
                className="px-3 py-1.5 rounded-control bg-panel border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Simulasi Salah Gerbang</span>
              </button>

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
                      flight_number: activeFlight?.flight_number || 'GA 142',
                      airline: activeFlight?.airline || { name: 'Garuda Indonesia', code: 'GA' },
                      origin: activeFlight?.origin || { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta' },
                      destination: activeFlight?.destination || { code: 'DPS', city: 'Denpasar', name: 'Ngurah Rai' },
                      booking_code: 'P9L2M7',
                      boarding_pass_code: 'BP-P9L2M7-3-DL',
                      status: 'boarded',
                    },
                    errorMessage: 'DITOLAK: Penumpang Dewi Lestari sudah tercatat boarding sebelumnya.',
                    timestamp: new Date().toLocaleTimeString('id-ID') + ' WIB',
                  })
                }
                className="px-3 py-1.5 rounded-control bg-panel border border-danger/30 text-danger font-bold hover:bg-danger/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-danger" />
                <span>Simulasi Duplikat (Ditolak)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'invalid',
                    errorMessage: 'Kode boarding pass tidak ditemukan di sistem maskapai.',
                    timestamp: new Date().toLocaleTimeString('id-ID') + ' WIB',
                  })
                }
                className="px-3 py-1.5 rounded-control bg-panel border border-line text-subtle hover:text-ink font-bold hover:bg-tint transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-subtle" />
                <span>Simulasi Tidak Valid</span>
              </button>
            </div>
          )}
        </div>

        {/* ─── TOAST NOTIFICATION ─── */}
        {toastMessage && (
          <aside
            aria-label="Notifikasi sistem"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-panel border border-line text-ink px-4 py-3 rounded-ticket shadow-2xl animate-fadeIn"
          >
            <div className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[16px]">check</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-ink">{toastMessage}</span>
              <span className="text-[10px] text-subtle">Sinkronisasi status manifest real-time</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-subtle hover:text-ink ml-2 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </div>
    </StaffLayout>
  )
}
