import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import StaffLayout from '../../components/layout/StaffLayout'

interface VerifyPassengerData {
  check_in_id: number
  passenger_id: number
  passenger_name: string
  seat_number: string
  seat_class?: string
  flight_schedule_id: number
  flight_number: string
  booking_code: string
  boarding_pass_code: string
  status: string
}

interface ScanLogItem {
  id: string
  name: string
  seat: string
  pnr: string
  time: string
  status: 'boarded' | 'already' | 'invalid'
}

export default function ScanBoarding() {
  const [searchParams] = useSearchParams()
  const flightIdParam = searchParams.get('flightId')
  const flightScheduleId = flightIdParam ? Number(flightIdParam) : undefined

  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'valid' | 'already' | 'invalid'
    data?: VerifyPassengerData | null
    errorMessage?: string
  }>({ status: 'idle' })

  const [recentScans, setRecentScans] = useState<ScanLogItem[]>([
    {
      id: '1',
      name: 'Rina Wulandari',
      seat: '14A',
      pnr: 'K7QM4X',
      time: 'Baru Saja',
      status: 'boarded',
    },
    {
      id: '2',
      name: 'Dimas Pratama',
      seat: '14B',
      pnr: '8M2K1L',
      time: '07.11 WIB',
      status: 'boarded',
    },
    {
      id: '3',
      name: 'Hendra Kusuma',
      seat: '14C',
      pnr: 'V93N1A',
      time: '07.10 WIB',
      status: 'boarded',
    },
  ])

  const [isCameraActive, setIsCameraActive] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Camera stream handler
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
          }
        })
        .catch((err) => {
          console.warn('Tidak dapat mengakses kamera perangkat:', err)
          setIsCameraActive(false)
        })
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isCameraActive])

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
        flight_schedule_id: flightScheduleId,
      })

      const passengerData = res.data?.data
      setScanResult({
        status: 'valid',
        data: passengerData,
      })

      // Add to recent scans
      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB'

      setRecentScans((prev) => [
        {
          id: String(Date.now()),
          name: passengerData.passenger_name,
          seat: passengerData.seat_number,
          pnr: passengerData.booking_code,
          time: nowStr,
          status: 'boarded',
        },
        ...prev.slice(0, 4),
      ])

      setToastMessage(
        `${passengerData.passenger_name} (Kursi ${passengerData.seat_number}) berhasil diverifikasi naik pesawat.`
      )
      setInputCode('')
    } catch (err: any) {
      const errCode = err.response?.data?.code
      const errMsg = err.response?.data?.message || 'Kode boarding pass tidak valid'

      if (errCode === 'ALREADY_BOARDED') {
        const extraData = err.response?.data?.data
        setScanResult({
          status: 'already',
          data: extraData || null,
          errorMessage: errMsg,
        })
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

  return (
    <StaffLayout activeFlightId={flightScheduleId || 1}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-5 flex flex-col gap-5">
        {/* ─── BREADCRUMB & CONTEXT TOPBAR ─── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-2 text-subtle text-xs">
            <Link
              to="/staff"
              className="inline-flex items-center gap-1 hover:text-brand-fg transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Kembali ke Penerbangan Hari Ini</span>
            </Link>
            <span className="text-line">•</span>
            <Link
              to={flightScheduleId ? `/staff/flights/${flightScheduleId}/manifest` : '/staff/flights/1/manifest'}
              className="hover:text-brand-fg transition-colors font-medium text-ink"
            >
              Manifest Penerbangan
            </Link>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint text-brand-fg font-semibold uppercase tracking-wider text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              DCS Gate Link Aktif
            </span>
            <span className="tabular-nums text-subtle font-medium">Sesi: G14-OP-02</span>
          </div>
        </div>

        {/* ─── FLIGHT OPERATIONAL BANNER ─── */}
        <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base text-ink tracking-tight">
                  Kenari Air • Penerbangan KA 412
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success text-xs font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Pintu Gerbang Dibuka • Sisa 26 Menit
                </span>
              </div>
              <div className="flex items-center gap-2 text-subtle text-xs flex-wrap">
                <span className="font-semibold text-ink">Jakarta (CGK)</span>
                <span className="material-symbols-outlined text-[14px] text-brand-fg">
                  arrow_forward
                </span>
                <span className="font-semibold text-ink">Denpasar (DPS)</span>
                <span>•</span>
                <span>
                  Gerbang 14 • Keberangkatan <strong className="text-ink tabular-nums">07.40 WIB</strong>
                </span>
                <span>•</span>
                <span>Boeing 737-800NG (PK-LKB)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={flightScheduleId ? `/staff/flights/${flightScheduleId}/manifest` : '/staff/flights/1/manifest'}
                className="px-3.5 py-2 rounded-control bg-raised border border-line hover:bg-tint text-ink text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">table_chart</span>
                Lihat Manifest Lengkap
              </Link>
            </div>
          </div>
        </div>

        {/* ─── MAIN 2-COLUMN BOARDING SCANNER ENGINE (50% / 50%) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── LEFT COLUMN: SCANNER INPUT & VIEWFINDER ── */}
          <div className="flex flex-col gap-5">
            {/* 1. Manual / Barcode Scanner Input */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs">
              <div className="flex items-center justify-between pb-1">
                <label htmlFor="barcode-input" className="text-xs font-bold text-ink">
                  Kode boarding pass atau kode booking (PNR)
                </label>
                <span className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                  Auto-Detect
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
                    placeholder="Contoh: BP-93X1-RW atau K7QM4X"
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
                  disabled={loading}
                  onClick={() => handleVerify()}
                  className="h-12 px-6 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
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
                  Mendukung pemindai barcode laser USB/Bluetooth atau ketik manual 6–10 karakter lalu tekan Enter.
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

              {/* Viewfinder Area */}
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

                {/* Scanning Laser Line */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-brand shadow-[0_0_12px_#1d5bd6] opacity-90 animate-pulse pointer-events-none" />

                {/* QR Silhouette */}
                {!isCameraActive && (
                  <div className="w-36 h-36 border-2 border-dashed border-brand/40 rounded-lg flex flex-col items-center justify-center p-3 text-center pointer-events-none">
                    <span className="material-symbols-outlined text-brand/60 text-[52px]">
                      qr_code_2
                    </span>
                  </div>
                )}

                {/* Instructions Overlay */}
                <div className="absolute bottom-3 inset-x-4 text-center">
                  <span className="inline-block px-3 py-1 rounded-full bg-panel/90 text-ink text-[11px] font-semibold shadow-xs">
                    {isCameraActive
                      ? 'Arahkan kamera ke QR boarding pass penumpang'
                      : 'Nyalakan kamera untuk pemindaian visual langsung'}
                  </span>
                </div>
              </div>

              {/* Viewfinder Controls */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-line text-xs">
                <div className="flex items-center gap-1.5 text-subtle">
                  <span className="material-symbols-outlined text-[18px]">photo_camera_front</span>
                  <span>Kamera Depan Gerbang 14</span>
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

          {/* ── RIGHT COLUMN: SCAN RESULT CARD & RECENT SCANS ── */}
          <div className="flex flex-col gap-5">
            {/* Quick Demo Switcher Tabs */}
            <div className="bg-raised border border-line rounded-control p-1 flex items-center gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'valid',
                    data: {
                      check_in_id: 1,
                      passenger_id: 1,
                      passenger_name: 'Rina Wulandari',
                      seat_number: '14A',
                      flight_schedule_id: 1,
                      flight_number: 'KA 412',
                      booking_code: 'K7QM4X',
                      boarding_pass_code: 'BP-93X1-RW',
                      status: 'boarded',
                    },
                  })
                }
                className={`flex-1 py-1 px-2.5 rounded text-center transition-all flex items-center justify-center gap-1 ${
                  scanResult.status === 'valid'
                    ? 'bg-panel text-brand-fg shadow-xs font-bold'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span>Valid (Siap Naik)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'already',
                    data: {
                      check_in_id: 2,
                      passenger_id: 2,
                      passenger_name: 'Dewi Lestari',
                      seat_number: '15A',
                      flight_schedule_id: 1,
                      flight_number: 'KA 412',
                      booking_code: 'P9L2M7',
                      boarding_pass_code: 'BP-5531-DL',
                      status: 'boarded',
                    },
                    errorMessage:
                      'Penumpang Dewi Lestari (Kursi 15A) sudah tercatat naik pesawat sebelumnya',
                  })
                }
                className={`flex-1 py-1 px-2.5 rounded text-center transition-all flex items-center justify-center gap-1 ${
                  scanResult.status === 'already'
                    ? 'bg-panel text-brand-fg shadow-xs font-bold'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-subtle" />
                <span>Sudah Naik</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'invalid',
                    errorMessage:
                      'Kode boarding pass tidak ditemukan dalam manifest penerbangan ini.',
                  })
                }
                className={`flex-1 py-1 px-2.5 rounded text-center transition-all flex items-center justify-center gap-1 ${
                  scanResult.status === 'invalid'
                    ? 'bg-panel text-brand-fg shadow-xs font-bold'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                <span>Tidak Ditemukan</span>
              </button>
            </div>

            {/* RESULT CARD A: VALID & READY */}
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
                        Penumpang telah terdaftar di sistem DCS &amp; siap masuk pesawat
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] uppercase font-bold tracking-wider">
                    Valid • Boarded
                  </span>
                </div>

                {/* Passenger Notch Ticket Card */}
                <div className="bg-raised border border-line rounded-control p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle">
                        Nama Lengkap Penumpang
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold text-ink mt-0.5">
                        {scanResult.data.passenger_name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-tint text-brand-fg font-semibold text-[10px] uppercase">
                          Dewasa (Adult)
                        </span>
                        <span className="text-xs text-subtle font-mono">
                          SkyMiles: #SK-881923
                        </span>
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
                        Lorong Kiri • Jendela
                      </span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-line my-1" />

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Penerbangan</span>
                      <strong className="text-ink">{scanResult.data.flight_number}</strong>
                      <span className="text-subtle text-[11px] block">CGK → DPS</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Kelas &amp; Gerbang</span>
                      <strong className="text-ink">Ekonomi</strong>
                      <span className="text-subtle text-[11px] block">Gate 14</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Jadwal Boarding</span>
                      <strong className="text-ink">07.10 WIB</strong>
                      <span className="text-subtle text-[11px] block">Zona 2</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">Kode PNR / BP</span>
                      <strong className="text-brand-fg font-mono">{scanResult.data.booking_code}</strong>
                      <span className="text-subtle text-[10px] font-mono block">
                        {scanResult.data.boarding_pass_code}
                      </span>
                    </div>
                  </div>

                  {/* Baggage Indicator */}
                  <div className="p-2.5 rounded bg-panel border border-line flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-success text-[18px]">
                        luggage
                      </span>
                      <span>
                        <strong>Bagasi Terverifikasi:</strong> 1 Koli (20 kg) + 7 kg Kabin
                      </span>
                    </div>
                    <span className="text-success font-semibold text-[11px] flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[14px]">done</span>
                      Sesuai
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-success/10 rounded-control border border-success/30 flex items-center gap-2 text-xs font-semibold text-success">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Penumpang berhasil dicatat masuk ke kabin pesawat.</span>
                </div>
              </div>
            )}

            {/* RESULT CARD B: ALREADY BOARDED */}
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
                        Boarding pass ini sudah discan dan tercatat masuk
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
                      {scanResult.data?.passenger_name || 'Dewi Lestari'}
                    </span>
                    <span className="font-bold text-brand-fg">
                      Kursi {scanResult.data?.seat_number || '15A'}
                    </span>
                  </div>
                  <p className="text-subtle">
                    {scanResult.errorMessage ||
                      'Boarding pass ini telah diverifikasi sebelumnya oleh staf Gate Crew.'}
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

            {/* RESULT CARD C: INVALID / NOT FOUND */}
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
                        Data boarding pass tidak ditemukan dalam manifest penerbangan ini
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-danger/15 text-danger text-[10px] uppercase font-bold tracking-wider">
                    Data Tidak Cocok
                  </span>
                </div>

                <div className="p-3.5 rounded-control bg-raised border border-line text-xs text-subtle leading-relaxed">
                  {scanResult.errorMessage ||
                    'Kode yang dipindai tidak terdaftar pada penerbangan KA 412. Periksa kembali boarding pass fisik penumpang atau arahkan ke layanan pelanggan.'}
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
                    to={flightScheduleId ? `/staff/flights/${flightScheduleId}/manifest` : '/staff/flights/1/manifest'}
                    className="h-10 px-4 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center justify-center transition-colors"
                  >
                    Cari di Manifest
                  </Link>
                </div>
              </div>
            )}

            {/* RESULT CARD D: IDLE / WAITING */}
            {scanResult.status === 'idle' && (
              <div className="bg-panel border border-line rounded-ticket p-8 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-tint text-brand-fg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
                </div>
                <h3 className="font-bold text-sm text-ink">Siap Memindai Boarding Pass</h3>
                <p className="text-xs text-subtle max-w-xs">
                  Gunakan pemindai laser atau arahkan kamera ke barcode/QR penumpang untuk verifikasi instan.
                </p>
              </div>
            )}

            {/* 3. Recent Scans Log Panel */}
            <div className="bg-panel border border-line rounded-ticket p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-ink uppercase tracking-wider">
                    5 Scan Terakhir di Gerbang 14
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-success/15 text-success">
                    Live Sync
                  </span>
                </div>
                <Link
                  to={flightScheduleId ? `/staff/flights/${flightScheduleId}/manifest` : '/staff/flights/1/manifest'}
                  className="text-xs text-brand-fg font-semibold hover:underline"
                >
                  Lihat Semua
                </Link>
              </div>

              <div className="flex flex-col divide-y divide-line text-xs">
                {recentScans.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-tint/20 px-1 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[15px]">check</span>
                      </span>
                      <div>
                        <span className="font-bold text-ink block leading-tight">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-subtle">
                          Kursi <strong>{item.seat}</strong> • PNR: <span className="font-mono">{item.pnr}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <span className="font-semibold text-ink block text-[11px]">{item.time}</span>
                      <span className="text-[10px] font-bold text-success uppercase">
                        Naik Pesawat
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-[11px] text-subtle">
                <span>Total 96 penumpang telah melewati gerbang.</span>
                <span>
                  Kecepatan rata-rata: <strong className="text-ink">3.2 detik / pax</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── FLOATING TOAST FEEDBACK ─── */}
        {toastMessage && (
          <aside className="fixed bottom-6 right-6 z-50 bg-panel border border-line rounded-ticket p-4 shadow-xl flex items-center gap-3 max-w-md animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">check</span>
            </div>
            <div className="flex flex-col text-xs pr-2">
              <span className="font-semibold text-ink leading-snug">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-subtle hover:text-ink p-1 rounded"
              aria-label="Tutup notifikasi"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </div>
    </StaffLayout>
  )
}

