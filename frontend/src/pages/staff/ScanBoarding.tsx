import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import StaffLayout from '../../components/layout/StaffLayout'

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
  pnr: string
  time: string
  status: 'boarded' | 'already' | 'wrong_flight' | 'invalid'
}

export default function ScanBoarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const flightIdParam = searchParams.get('flightId')
  const [selectedFlightId, setSelectedFlightId] = useState<string>(flightIdParam || 'all')

  const [flights, setFlights] = useState<FlightScheduleItem[]>([])
  const [loadingFlights, setLoadingFlights] = useState(false)

  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'valid' | 'already' | 'wrong_flight' | 'invalid'
    data?: VerifyPassengerData | null
    errorMessage?: string
  }>({ status: 'idle' })

  const [recentScans, setRecentScans] = useState<ScanLogItem[]>([])
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanIntervalRef = useRef<any>(null)

  // Sync selected flight with query parameter
  useEffect(() => {
    if (flightIdParam) {
      setSelectedFlightId(flightIdParam)
    } else {
      setSelectedFlightId('all')
    }
  }, [flightIdParam])

  // Fetch all flight schedules to populate flight selector & dynamic banner
  useEffect(() => {
    const fetchFlights = async () => {
      setLoadingFlights(true)
      try {
        const res = await api.get<{ error: boolean; data: FlightScheduleItem[] }>('/staff/flights?date=all')
        if (res.data?.data) {
          setFlights(res.data.data)
        }
      } catch (err) {
        console.error('Gagal mengambil daftar penerbangan untuk scanner:', err)
      } finally {
        setLoadingFlights(false)
      }
    }

    fetchFlights()
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

            // Check if native BarcodeDetector API is available (Chrome / Edge)
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
                        if (detected && detected.trim() !== inputCode) {
                          handleVerify(detected.trim())
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

  // Active flight context
  const activeFlight = flights.find((f) => f.id === Number(selectedFlightId))

  // Handle flight selector change
  const handleFlightSelectChange = (newId: string) => {
    setSelectedFlightId(newId)
    if (newId === 'all') {
      setSearchParams({})
    } else {
      setSearchParams({ flightId: newId })
    }
    setScanResult({ status: 'idle' })
    inputRef.current?.focus()
  }

  // Handle Verify Boarding
  const handleVerify = async (codeToVerify?: string) => {
    const raw = (codeToVerify || inputCode).trim()
    if (!raw) return

    setLoading(true)
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
      setScanResult({
        status: 'valid',
        data: passengerData,
      })

      // Add to recent scans log
      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'

      setRecentScans((prev) => [
        {
          id: String(Date.now()),
          name: passengerData.passenger_name,
          seat: passengerData.seat_number,
          flightNumber: passengerData.flight_number,
          airlineName: passengerData.airline?.name,
          pnr: passengerData.booking_code,
          time: nowStr,
          status: 'boarded',
        },
        ...prev.slice(0, 4),
      ])

      const airlineInfo = passengerData.airline?.name ? `${passengerData.airline.name} ` : ''
      setToastMessage(
        `${passengerData.passenger_name} (${airlineInfo}${passengerData.flight_number} • Kursi ${passengerData.seat_number}) diverifikasi naik pesawat.`
      )
      setInputCode('')
    } catch (err: any) {
      const errCode = err.response?.data?.code
      const errMsg = err.response?.data?.message || 'Kode boarding pass tidak valid'
      const errData = err.response?.data?.data as VerifyPassengerData | undefined

      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'

      if (errCode === 'WRONG_FLIGHT') {
        setScanResult({
          status: 'wrong_flight',
          data: errData || null,
          errorMessage: errMsg,
        })

        if (errData) {
          setRecentScans((prev) => [
            {
              id: String(Date.now()),
              name: errData.passenger_name || 'Penumpang',
              seat: errData.seat_number || 'N/A',
              flightNumber: errData.flight_number || 'Lain',
              airlineName: errData.airline?.name,
              pnr: errData.booking_code || raw,
              time: nowStr,
              status: 'wrong_flight',
            },
            ...prev.slice(0, 4),
          ])
        }
      } else if (errCode === 'ALREADY_BOARDED') {
        setScanResult({
          status: 'already',
          data: errData || null,
          errorMessage: errMsg,
        })

        if (errData) {
          setRecentScans((prev) => [
            {
              id: String(Date.now()),
              name: errData.passenger_name,
              seat: errData.seat_number,
              flightNumber: errData.flight_number,
              airlineName: errData.airline?.name,
              pnr: errData.booking_code,
              time: nowStr,
              status: 'already',
            },
            ...prev.slice(0, 4),
          ])
        }
      } else {
        setScanResult({
          status: 'invalid',
          errorMessage: errMsg,
        })
      }
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

  return (
    <StaffLayout activeFlightId={selectedFlightId !== 'all' ? Number(selectedFlightId) : null}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-5 flex flex-col gap-5">
        {/* ─── TOP BAR & MODE SELECTOR ─── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-2 text-subtle text-xs flex-wrap">
            <Link
              to="/staff"
              className="inline-flex items-center gap-1 hover:text-brand-fg transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Penerbangan Hari Ini</span>
            </Link>
            <span className="text-line">•</span>
            <Link
              to={selectedFlightId !== 'all' ? `/staff/flights/${selectedFlightId}/manifest` : '/staff'}
              className="hover:text-brand-fg transition-colors font-medium text-ink"
            >
              Manifest Penerbangan
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Flight Gate Switcher Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="flight-select" className="text-xs font-semibold text-subtle whitespace-nowrap">
                Fokus Gerbang / Mode:
              </label>
              <select
                id="flight-select"
                disabled={loadingFlights}
                value={selectedFlightId}
                onChange={(e) => handleFlightSelectChange(e.target.value)}
                className="h-9 px-3 rounded-control bg-panel border border-line text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand-fg shadow-xs cursor-pointer disabled:opacity-60"
              >
                <option value="all">🌐 Semua Maskapai (Auto-Detect Universal)</option>
                {flights.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.airline?.name || 'Maskapai'} {f.flight_number} • {f.origin?.code} → {f.destination?.code} ({formatTimeStr(f.departure_time)})
                  </option>
                ))}
              </select>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint text-brand-fg font-semibold uppercase tracking-wider text-[11px] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>{selectedFlightId === 'all' ? 'Auto-Detect Aktif' : 'Gate Lock Aktif'}</span>
            </span>
          </div>
        </div>

        {/* ─── DYNAMIC OPERATIONAL BANNER ─── */}
        <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {selectedFlightId === 'all' ? (
              /* Universal Scanner Mode Header */
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base text-ink tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-brand-fg text-[22px]">travel_explore</span>
                    <span>Scanner Universal Multi-Maskapai (Auto-Detect Aktif)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-tint text-brand-fg text-xs font-semibold">
                    Semua Penerbangan Siap Dipindai
                  </span>
                </div>
                <p className="text-subtle text-xs leading-relaxed max-w-3xl">
                  Pindai boarding pass apa pun. Sistem secara otomatis mengenali maskapai, nomor penerbangan, rute, dan identitas penumpang tanpa perlu memilih jadwal secara manual.
                </p>
              </div>
            ) : activeFlight ? (
              /* Locked Specific Flight Header */
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base text-ink tracking-tight">
                    {activeFlight.airline?.name || 'Maskapai'} • Penerbangan {activeFlight.flight_number}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    activeFlight.status === 'delayed'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : activeFlight.status === 'cancelled'
                      ? 'bg-danger/15 text-danger'
                      : 'bg-success/15 text-success'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>
                      {activeFlight.status === 'delayed'
                        ? `Tertunda ${activeFlight.delay_minutes} Menit`
                        : activeFlight.status === 'cancelled'
                        ? 'Dibatalkan'
                        : 'Pintu Gerbang Dibuka'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-subtle text-xs flex-wrap">
                  <span className="font-semibold text-ink">
                    {activeFlight.origin?.city} ({activeFlight.origin?.code})
                  </span>
                  <span className="material-symbols-outlined text-[14px] text-brand-fg">arrow_forward</span>
                  <span className="font-semibold text-ink">
                    {activeFlight.destination?.city} ({activeFlight.destination?.code})
                  </span>
                  <span>•</span>
                  <span>
                    Keberangkatan <strong className="text-ink tabular-nums">{formatTimeStr(activeFlight.departure_time)}</strong>
                  </span>
                  {activeFlight.airplane && (
                    <>
                      <span>•</span>
                      <span>{activeFlight.airplane.model} ({activeFlight.airplane.registration_number})</span>
                    </>
                  )}
                  <span>•</span>
                  <span className="text-brand-fg font-semibold">
                    {activeFlight.boarded_count} / {activeFlight.passenger_count || activeFlight.total_capacity} Penumpang Naik
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-subtle text-xs">
                <span>Memuat informasi penerbangan...</span>
              </div>
            )}

            <div className="flex items-center gap-2 shrink-0">
              {selectedFlightId !== 'all' && (
                <Link
                  to={`/staff/flights/${selectedFlightId}/manifest`}
                  className="px-3.5 py-2 rounded-control bg-raised border border-line hover:bg-tint text-ink text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">table_chart</span>
                  <span>Lihat Manifest Penerbangan Ini</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ─── MAIN 2-COLUMN BOARDING SCANNER ENGINE ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── LEFT COLUMN: SCANNER INPUT & VIEWFINDER ── */}
          <div className="flex flex-col gap-5">
            {/* 1. Barcode / PNR Input Box */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs">
              <div className="flex items-center justify-between pb-1">
                <label htmlFor="barcode-input" className="text-xs font-bold text-ink">
                  Kode Boarding Pass atau Kode Booking (PNR)
                </label>
                <span className="text-[10px] uppercase font-bold text-brand-fg tracking-wider bg-tint px-2 py-0.5 rounded">
                  {selectedFlightId === 'all' ? 'Auto-Detect Universal' : 'Gate Locked'}
                </span>
              </div>

              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-subtle">
                    barcode_scanner
                  </span>
                  <input
                    ref={inputRef}
                    id="barcode-input"
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Contoh: BP-9JFCSZ-1-XYZ atau 9JFCSZ"
                    className="w-full h-12 pl-11 pr-9 rounded-control bg-panel border-2 border-brand text-ink text-sm font-mono tracking-wider focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all font-bold uppercase"
                  />
                  {inputCode && (
                    <button
                      type="button"
                      onClick={() => setInputCode('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={loading || !inputCode.trim()}
                  onClick={() => handleVerify()}
                  className="h-12 px-6 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                      <span>Verifikasi</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-1.5 text-subtle text-[11px]">
                <span className="material-symbols-outlined text-[14px]">info</span>
                <span>
                  Mendukung scanner laser USB/Bluetooth langsung, kamera ponsel/laptop, atau ketik kode PNR 6 digit lalu Enter.
                </span>
              </div>
            </div>

            {/* 2. Live Camera Viewfinder Panel */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-fg text-[20px]">videocam</span>
                  <span className="font-bold text-sm text-ink">Pemindai Kamera Langsung</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/15 text-success text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span>{isCameraActive ? 'Kamera Aktif' : 'Kamera Siaga'}</span>
                </div>
              </div>

              {/* Viewfinder Frame */}
              <div className="relative w-full max-w-[360px] mx-auto aspect-square my-4 rounded-xl bg-[#0B2545] overflow-hidden flex items-center justify-center border-2 border-line/60">
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1d5bd6_1px,transparent_1px)] [background-size:16px_16px]" />
                )}

                {/* Azure Corner Brackets */}
                <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-brand rounded-tl-sm pointer-events-none" />
                <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-brand rounded-tr-sm pointer-events-none" />
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-brand rounded-bl-sm pointer-events-none" />
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-brand rounded-br-sm pointer-events-none" />

                {/* Laser Bar */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-brand shadow-[0_0_12px_#1d5bd6] opacity-90 animate-pulse pointer-events-none" />

                {/* QR Silhouette */}
                {!isCameraActive && (
                  <div className="w-36 h-36 border-2 border-dashed border-brand/40 rounded-lg flex flex-col items-center justify-center p-3 text-center pointer-events-none">
                    <span className="material-symbols-outlined text-brand/60 text-[52px]">qr_code_2</span>
                  </div>
                )}

                {/* Guidance Overlay */}
                <div className="absolute bottom-3 inset-x-4 text-center">
                  <span className="inline-block px-3 py-1 rounded-full bg-panel/90 text-ink text-[11px] font-semibold shadow-xs">
                    {isCameraActive
                      ? 'Arahkan kamera ke QR / Barcode boarding pass'
                      : 'Nyalakan kamera untuk pemindaian visual langsung'}
                  </span>
                </div>
              </div>

              {/* Viewfinder Controls */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-line text-xs">
                <div className="flex items-center gap-1.5 text-subtle">
                  <span className="material-symbols-outlined text-[18px]">photo_camera_front</span>
                  <span>Sensor Kamera Perangkat</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className={`h-9 px-3.5 rounded-control font-semibold text-xs flex items-center gap-1.5 transition-colors ${
                    isCameraActive
                      ? 'bg-danger/10 text-danger hover:bg-danger/20'
                      : 'bg-tint text-brand-fg hover:bg-brand hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isCameraActive ? 'videocam_off' : 'videocam'}
                  </span>
                  <span>{isCameraActive ? 'Matikan Kamera' : 'Nyalakan Kamera'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: DETECTED AIRLINE RESULT & RECENT SCANS ── */}
          <div className="flex flex-col gap-5">
            {/* Quick Simulation Tabs for Testing */}
            <div className="bg-raised border border-line rounded-control p-1 flex items-center gap-1 text-[11px] font-semibold overflow-x-auto">
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
                      flight_schedule_id: 1,
                      flight_number: 'GA 142',
                      airline: { name: 'Garuda Indonesia', code: 'GA' },
                      origin: { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta' },
                      destination: { code: 'DPS', city: 'Denpasar', name: 'Ngurah Rai' },
                      departure_time: new Date().toISOString(),
                      booking_code: '9JFCSZ',
                      boarding_pass_code: 'BP-9JFCSZ-1-RW',
                      status: 'boarded',
                    },
                  })
                }
                className={`flex-1 py-1 px-2 rounded text-center transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                  scanResult.status === 'valid'
                    ? 'bg-panel text-success shadow-xs font-bold'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span>Simulasi Valid</span>
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
                    errorMessage: 'Kode boarding ini milik penerbangan lain (Lion Air JT 204)',
                  })
                }
                className={`flex-1 py-1 px-2 rounded text-center transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                  scanResult.status === 'wrong_flight'
                    ? 'bg-panel text-amber-600 shadow-xs font-bold'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Simulasi Beda Pesawat</span>
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
                      flight_schedule_id: 1,
                      flight_number: 'GA 142',
                      airline: { name: 'Garuda Indonesia', code: 'GA' },
                      origin: { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta' },
                      destination: { code: 'DPS', city: 'Denpasar', name: 'Ngurah Rai' },
                      booking_code: 'P9L2M7',
                      boarding_pass_code: 'BP-P9L2M7-3-DL',
                      status: 'boarded',
                    },
                    errorMessage: 'Penumpang Dewi Lestari (Kursi 15A) sudah tercatat naik pesawat sebelumnya',
                  })
                }
                className={`flex-1 py-1 px-2 rounded text-center transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                  scanResult.status === 'already'
                    ? 'bg-panel text-brand-fg shadow-xs font-bold'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-subtle" />
                <span>Simulasi Sudah Naik</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'invalid',
                    errorMessage: 'Kode boarding pass tidak ditemukan di sistem maskapai.',
                  })
                }
                className={`flex-1 py-1 px-2 rounded text-center transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                  scanResult.status === 'invalid'
                    ? 'bg-panel text-danger shadow-xs font-bold'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                <span>Simulasi Ditolak</span>
              </button>
            </div>

            {/* ─── CASE A: VALID & BOARDED CARD ─── */}
            {scanResult.status === 'valid' && scanResult.data && (
              <div className="bg-panel border-2 border-success/40 rounded-ticket p-5 shadow-sm flex flex-col gap-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-ink block">
                        Boarding Pass Terverifikasi
                      </span>
                      <span className="text-[11px] text-subtle">
                        Data maskapai &amp; manifest cocok. Penumpang resmi naik pesawat.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] uppercase font-bold tracking-wider">
                    Valid • Boarded
                  </span>
                </div>

                {/* Detected Airline Card Notch */}
                <div className="bg-raised border border-line rounded-control p-4 flex flex-col gap-3">
                  {/* Airline Identified Header */}
                  <div className="flex items-center justify-between bg-panel p-2.5 rounded-control border border-line">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-brand-fg text-[20px]">airlines</span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-subtle block">Maskapai Terdeteksi</span>
                        <span className="text-sm font-bold text-ink">
                          {scanResult.data.airline?.name || 'Maskapai Penerbangan'} ({scanResult.data.flight_number})
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-tint text-brand-fg px-2.5 py-1 rounded">
                      PNR: {scanResult.data.booking_code}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle">
                        Nama Lengkap Penumpang
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold text-ink mt-0.5">
                        {scanResult.data.passenger_name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-tint text-brand-fg font-semibold text-[10px] uppercase">
                          {scanResult.data.seat_class || 'Ekonomi'}
                        </span>
                        {scanResult.data.id_number && (
                          <span className="text-xs text-subtle font-mono">
                            ID: {scanResult.data.id_number}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Giant Seat Callout */}
                    <div className="bg-panel border border-line rounded-control px-4 py-2 text-right shadow-xs min-w-[110px]">
                      <span className="text-[10px] uppercase font-semibold text-subtle block">
                        Nomor Kursi
                      </span>
                      <span className="text-3xl font-bold text-brand-fg tracking-tight leading-none block my-1">
                        {scanResult.data.seat_number}
                      </span>
                      <span className="text-[11px] font-medium text-ink block">
                        Kabin Terverifikasi
                      </span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-line my-1" />

                  {/* Flight & Route Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Rute</span>
                      <strong className="text-ink">
                        {scanResult.data.origin?.code || 'ORIGIN'} → {scanResult.data.destination?.code || 'DEST'}
                      </strong>
                      <span className="text-subtle text-[11px] block truncate">
                        {scanResult.data.destination?.city || ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Penerbangan</span>
                      <strong className="text-ink">{scanResult.data.flight_number}</strong>
                      <span className="text-subtle text-[11px] block">
                        {scanResult.data.airline?.code || ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Jadwal Keberangkatan</span>
                      <strong className="text-ink tabular-nums">
                        {formatTimeStr(scanResult.data.departure_time)}
                      </strong>
                      <span className="text-subtle text-[11px] block">Gate Terverifikasi</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Kode Boarding</span>
                      <strong className="text-brand-fg font-mono text-[11px] block truncate">
                        {scanResult.data.boarding_pass_code}
                      </strong>
                      <span className="text-success text-[10px] font-semibold block">
                        Status: Boarded
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-success/10 rounded-control border border-success/30 flex items-center justify-between text-xs font-semibold text-success">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Penumpang siap masuk ke garbarata / pesawat.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult({ status: 'idle' })
                      inputRef.current?.focus()
                    }}
                    className="text-ink hover:underline text-xs"
                  >
                    Scan Berikutnya &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* ─── CASE B: WRONG FLIGHT / WRONG AIRLINE WARNING CARD ─── */}
            {scanResult.status === 'wrong_flight' && (
              <div className="bg-panel border-2 border-amber-500/50 rounded-ticket p-5 shadow-md flex flex-col gap-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">warning</span>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-amber-600 dark:text-amber-400 block">
                        SALAH PENERBANGAN / GERBANG
                      </span>
                      <span className="text-[11px] text-subtle">
                        Tiket valid, namun terdeteksi untuk penerbangan maskapai lain!
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider">
                    Wrong Gate
                  </span>
                </div>

                {/* Detected Flight & Airline Details */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-control p-4 flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">
                        Maskapai &amp; Jadwal Asli Penumpang
                      </span>
                      <span className="text-base font-bold text-ink">
                        {scanResult.data?.airline?.name || 'Maskapai Lain'} • {scanResult.data?.flight_number}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-panel border border-amber-500/30 text-ink px-2 py-1 rounded">
                      Kursi {scanResult.data?.seat_number || 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-ink">
                    <div>
                      <span className="text-subtle text-[10px] uppercase block">Penumpang</span>
                      <strong>{scanResult.data?.passenger_name || 'Nama Penumpang'}</strong>
                    </div>
                    <div>
                      <span className="text-subtle text-[10px] uppercase block">Rute Asli</span>
                      <strong>
                        {scanResult.data?.origin?.code || 'CGK'} → {scanResult.data?.destination?.code || 'DPS'}
                      </strong>
                    </div>
                  </div>

                  <div className="p-2.5 bg-panel rounded border border-amber-500/20 text-ink text-xs leading-relaxed">
                    <strong>Pemberitahuan Staf:</strong> Penumpang ini bukan untuk penerbangan gerbang ini ({activeFlight?.airline?.name} {activeFlight?.flight_number}). Arahkan penumpang ke gerbang keberangkatan {scanResult.data?.airline?.name || 'maskapainya'} ({scanResult.data?.flight_number}).
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult({ status: 'idle' })
                      inputRef.current?.focus()
                    }}
                    className="flex-1 h-10 rounded-control bg-raised border border-line text-ink hover:bg-tint text-xs font-semibold transition-colors"
                  >
                    Scan Penumpang Lain
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (scanResult.data?.flight_schedule_id) {
                        handleFlightSelectChange(String(scanResult.data.flight_schedule_id))
                      }
                    }}
                    className="h-10 px-4 rounded-control bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center justify-center transition-colors"
                  >
                    Buka Penerbangan Tersebut
                  </button>
                </div>
              </div>
            )}

            {/* ─── CASE C: ALREADY BOARDED CARD ─── */}
            {scanResult.status === 'already' && (
              <div className="bg-panel border-2 border-line rounded-ticket p-5 shadow-xs flex flex-col gap-3 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-tint text-brand-fg flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">info</span>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-ink block">
                        Sudah Berada di Pesawat
                      </span>
                      <span className="text-[11px] text-subtle">
                        Boarding pass ini sudah discan dan tercatat naik sebelumnya
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-raised text-subtle text-[10px] uppercase font-bold tracking-wider">
                    Already Boarded
                  </span>
                </div>

                <div className="p-4 rounded-control bg-raised border border-line flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-sm text-ink">
                      {scanResult.data?.passenger_name}
                    </span>
                    <span className="font-bold text-brand-fg">
                      Kursi {scanResult.data?.seat_number}
                    </span>
                  </div>
                  <div className="text-subtle">
                    Penerbangan: <strong>{scanResult.data?.airline?.name} {scanResult.data?.flight_number}</strong>
                  </div>
                  <p className="text-subtle mt-1">
                    {scanResult.errorMessage || 'Boarding pass ini telah diverifikasi dan masuk kabin.'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult({ status: 'idle' })
                      inputRef.current?.focus()
                    }}
                    className="flex-1 h-10 rounded-control bg-raised border border-line text-ink hover:bg-tint text-xs font-semibold transition-colors"
                  >
                    Scan Penumpang Lain
                  </button>
                </div>
              </div>
            )}

            {/* ─── CASE D: INVALID / NOT FOUND CARD ─── */}
            {scanResult.status === 'invalid' && (
              <div className="bg-panel border-2 border-danger/40 rounded-ticket p-5 shadow-xs flex flex-col gap-3 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-danger/15 text-danger flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">warning</span>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-danger block">
                        Kode Tidak Cocok / Ditolak
                      </span>
                      <span className="text-[11px] text-subtle">
                        Data boarding pass tidak ditemukan di sistem
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-danger/15 text-danger text-[10px] uppercase font-bold tracking-wider">
                    Ditolak
                  </span>
                </div>

                <div className="p-3.5 rounded-control bg-raised border border-line text-xs text-subtle leading-relaxed">
                  {scanResult.errorMessage ||
                    'Kode yang dipindai tidak terdaftar di sistem tiket. Pastikan penumpang telah melakukan check-in atau periksa kode fisik tiket.'}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult({ status: 'idle' })
                      inputRef.current?.focus()
                    }}
                    className="flex-1 h-10 rounded-control bg-raised border border-line text-ink hover:bg-tint text-xs font-semibold transition-colors"
                  >
                    Coba Lagi
                  </button>
                  <Link
                    to="/staff"
                    className="h-10 px-4 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center justify-center transition-colors"
                  >
                    Cari di Manifest
                  </Link>
                </div>
              </div>
            )}

            {/* ─── CASE E: IDLE / WAITING STATE ─── */}
            {scanResult.status === 'idle' && (
              <div className="bg-panel border border-line rounded-ticket p-8 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-tint text-brand-fg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
                </div>
                <h3 className="font-bold text-sm text-ink">Siap Memindai Boarding Pass</h3>
                <p className="text-xs text-subtle max-w-xs">
                  {selectedFlightId === 'all'
                    ? 'Mode Universal: Scan tiket maskapai apa saja, sistem akan langsung mengenali maskapai & penerbangannya.'
                    : `Mode Gerbang: Memverifikasi penumpang untuk penerbangan ${activeFlight?.airline?.name || ''} ${activeFlight?.flight_number || ''}.`}
                </p>
              </div>
            )}

            {/* 3. Recent Scans Log Panel */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-ink uppercase tracking-wider">
                    Scan Terakhir Sesi Ini
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-success/15 text-success">
                    Live DCS
                  </span>
                </div>
                {selectedFlightId !== 'all' && (
                  <Link
                    to={`/staff/flights/${selectedFlightId}/manifest`}
                    className="text-xs text-brand-fg font-semibold hover:underline"
                  >
                    Lihat Manifest
                  </Link>
                )}
              </div>

              <div className="flex flex-col divide-y divide-line text-xs">
                {recentScans.length > 0 ? (
                  recentScans.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-tint/20 px-1 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          item.status === 'boarded'
                            ? 'bg-success/15 text-success'
                            : item.status === 'wrong_flight'
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-subtle/15 text-subtle'
                        }`}>
                          <span className="material-symbols-outlined text-[15px]">
                            {item.status === 'boarded' ? 'check' : item.status === 'wrong_flight' ? 'priority_high' : 'info'}
                          </span>
                        </span>
                        <div>
                          <span className="font-bold text-ink block leading-tight">
                            {item.name}
                          </span>
                          <span className="text-[11px] text-subtle">
                            {item.airlineName ? `${item.airlineName} ` : ''}{item.flightNumber} • Kursi {item.seat} • PNR: {item.pnr}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-subtle block font-mono">
                          {item.time}
                        </span>
                        <span className={`text-[10px] font-semibold uppercase ${
                          item.status === 'boarded'
                            ? 'text-success'
                            : item.status === 'wrong_flight'
                            ? 'text-amber-600'
                            : 'text-subtle'
                        }`}>
                          {item.status === 'boarded' ? 'Naik' : item.status === 'wrong_flight' ? 'Salah Gate' : 'Sudah'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-subtle">
                    Belum ada pemindaian pada sesi ini. Pindai kode boarding pass untuk memulai.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Operational Toast Notification */}
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
              className="text-subtle hover:text-ink ml-2 p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </div>
    </StaffLayout>
  )
}
