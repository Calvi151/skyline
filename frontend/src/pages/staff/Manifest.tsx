import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import StaffLayout from '../../components/layout/StaffLayout'

interface ManifestPassenger {
  id: number
  passenger_id: number
  check_in_id: number | null
  booking_id: number
  booking_code: string | null
  full_name: string
  passenger_name: string
  id_number: string
  gender: string
  seat_class: string
  seat_number: string | null
  baggage: { id: number; name: string; weight_kg: number } | null
  boarding_pass_code: string | null
  checked_in_at: string | null
  checkin_status: 'checked_in' | 'boarded' | 'no_show' | 'not_checked_in'
  status: 'checked_in' | 'boarded' | 'no_show' | 'not_checked_in'
}

interface ManifestFlight {
  id: number
  flight_number: string
  airline: { name: string; code: string; logo?: string | null } | null
  airplane: { model: string; registration_number: string } | null
  route: string
  origin: { code: string; city: string; name: string } | null
  destination: { code: string; city: string; name: string } | null
  departure_time: string | null
  arrival_time: string | null
  status: string
  delay_minutes: number
}

interface ManifestSummary {
  total_capacity: number
  passenger_count: number
  checked_in_count: number
  boarded_count: number
  no_show_count: number
  not_checked_in_count: number
}

export default function FlightManifest() {
  const { id } = useParams<{ id: string }>()
  const flightId = Number(id) || 1

  const [flight, setFlight] = useState<ManifestFlight | null>(null)
  const [manifestList, setManifestList] = useState<ManifestPassenger[]>([])
  const [summary, setSummary] = useState<ManifestSummary>({
    total_capacity: 180,
    passenger_count: 0,
    checked_in_count: 0,
    boarded_count: 0,
    no_show_count: 0,
    not_checked_in_count: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'boarded' | 'checked_in' | 'not_checked_in' | 'special'>('all')
  const [currentClock, setCurrentClock] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{
    id: number
    title: string
    detail: string
    previousStatus: 'checked_in' | 'boarded' | 'no_show' | 'not_checked_in'
  } | null>(null)

  // Real-time clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentClock(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Jakarta',
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Manifest
  const fetchManifest = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const res = await api.get<{
        error: boolean
        data: ManifestPassenger[]
        flight: ManifestFlight
        summary: ManifestSummary
      }>(`/staff/flights/${flightId}/manifest`)

      if (res.data) {
        setManifestList(res.data.data || [])
        setFlight(res.data.flight || null)
        if (res.data.summary) {
          setSummary(res.data.summary)
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data manifest:', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Auto-refresh DCS every 15 seconds
  useEffect(() => {
    fetchManifest(true)
    const interval = setInterval(() => {
      fetchManifest(false)
    }, 15000)
    return () => clearInterval(interval)
  }, [flightId])

  // Update Passenger Status
  const handleUpdateStatus = async (
    passenger: ManifestPassenger,
    newStatus: 'boarded' | 'no_show' | 'checked_in'
  ) => {
    const targetId = passenger.check_in_id || passenger.id
    setUpdatingId(passenger.id)
    try {
      await api.put(`/staff/passengers/${targetId}/status`, { status: newStatus })

      // Optimistic update
      setManifestList((prev) =>
        prev.map((p) =>
          p.id === passenger.id ? { ...p, status: newStatus, checkin_status: newStatus } : p
        )
      )

      // Update counters locally
      setSummary((prev) => {
        const oldStatus = passenger.status
        const next = { ...prev }
        if (oldStatus === 'boarded') next.boarded_count = Math.max(0, next.boarded_count - 1)
        if (oldStatus === 'no_show') next.no_show_count = Math.max(0, next.no_show_count - 1)
        if (oldStatus === 'checked_in') next.checked_in_count = Math.max(0, next.checked_in_count - 1)

        if (newStatus === 'boarded') {
          next.boarded_count++
          if (oldStatus === 'not_checked_in') next.checked_in_count++
        } else if (newStatus === 'checked_in') {
          next.checked_in_count++
        } else if (newStatus === 'no_show') {
          next.no_show_count++
        }
        return next
      })

      const statusLabels = {
        boarded: 'ditandai naik pesawat',
        no_show: 'ditandai tidak hadir (no show)',
        checked_in: 'dikembalikan ke status check-in',
      }

      setToast({
        id: targetId,
        title: `${passenger.full_name} (${passenger.seat_number || 'Kursi -'})`,
        detail: `${statusLabels[newStatus]} pada pukul ${currentClock} WIB`,
        previousStatus: passenger.status,
      })
    } catch (err: any) {
      console.error('Gagal memperbarui status penumpang:', err)
      alert(err.response?.data?.message || 'Gagal mengubah status penumpang')
    } finally {
      setUpdatingId(null)
    }
  }

  // Undo status
  const handleUndo = async () => {
    if (!toast) return
    const targetStatus = toast.previousStatus === 'not_checked_in' ? 'checked_in' : toast.previousStatus
    try {
      await api.put(`/staff/passengers/${toast.id}/status`, { status: targetStatus })
      setToast(null)
      fetchManifest(false)
    } catch (err) {
      console.error('Gagal mengurungkan aksi:', err)
    }
  }

  // Filtered List
  const filteredList = useMemo(() => {
    return manifestList.filter((p) => {
      // Filter status
      if (activeFilter === 'boarded' && p.status !== 'boarded') return false
      if (activeFilter === 'checked_in' && p.status !== 'checked_in') return false
      if (activeFilter === 'not_checked_in' && p.status !== 'not_checked_in') return false
      if (activeFilter === 'special') {
        const hasExtraBaggage = p.baggage && p.baggage.weight_kg > 20
        if (!hasExtraBaggage) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = p.full_name.toLowerCase().includes(q)
        const matchSeat = (p.seat_number || '').toLowerCase().includes(q)
        const matchCode = (p.booking_code || '').toLowerCase().includes(q)
        const matchBp = (p.boarding_pass_code || '').toLowerCase().includes(q)
        if (!matchName && !matchSeat && !matchCode && !matchBp) return false
      }

      return true
    })
  }, [manifestList, activeFilter, searchQuery])

  // Percentages for stacked progress bar
  const totalPax = summary.passenger_count || 1
  const boardedPct = ((summary.boarded_count / totalPax) * 100).toFixed(1)
  const waitingCheckinCount = Math.max(0, summary.checked_in_count - summary.boarded_count)
  const waitingPct = ((waitingCheckinCount / totalPax) * 100).toFixed(1)
  const notCheckedInPct = ((summary.not_checked_in_count / totalPax) * 100).toFixed(1)

  const formatTimeStr = (iso?: string | null) => {
    if (!iso) return '07.40 WIB'
    const d = new Date(iso)
    return (
      d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'
    )
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <StaffLayout activeFlightId={flightId}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-5 flex flex-col gap-5">
        {/* ─── TOP CONTEXT & BACK NAVIGATION ─── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <Link
            to="/staff"
            className="inline-flex items-center gap-1.5 text-subtle hover:text-brand-fg transition-colors text-xs font-semibold group"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            <span>Kembali ke Penerbangan Hari Ini</span>
          </Link>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-subtle">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>DCS Terhubung (CGK-T2F)</span>
            </div>
            <span className="text-line">•</span>
            <div className="tabular-nums text-subtle">
              Pukul <span className="text-ink font-bold">{currentClock}</span> WIB
            </div>
          </div>
        </div>

        {/* ─── PAGE HEADER & ROUTE DETAILS CARD ─── */}
        <div className="bg-panel border border-line rounded-ticket p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-tint text-brand-fg font-semibold text-[11px] uppercase tracking-wider">
                  {flight?.airline?.name || 'Kenari Air'} • Penerbangan {flight?.flight_number || 'KA 412'}
                </span>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-success/15 text-success font-semibold text-[11px] uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
                  <span>BOARDING AKTIF — PINTU GERBANG DIBUKA</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mt-1">
                Manifest Penumpang: {flight?.airline?.name || 'Kenari Air'} {flight?.flight_number || 'KA 412'}
              </h1>

              <p className="text-xs sm:text-sm text-subtle leading-relaxed mt-0.5">
                {flight?.origin?.name || 'Jakarta'} ({flight?.origin?.code || 'CGK'}){' '}
                <span className="text-brand-fg font-bold">→</span>{' '}
                {flight?.destination?.name || 'Denpasar'} ({flight?.destination?.code || 'DPS'}){' '}
                <span className="text-line mx-1">•</span> Berangkat{' '}
                <strong className="text-ink tabular-nums">{formatTimeStr(flight?.departure_time)}</strong>{' '}
                <span className="text-line mx-1">•</span> Gerbang{' '}
                <strong className="text-brand-fg">Gate 14</strong>{' '}
                <span className="text-line mx-1">•</span>{' '}
                {flight?.airplane?.model || 'Boeing 737-800'}{' '}
                <span className="tabular-nums text-subtle">
                  ({flight?.airplane?.registration_number || 'PK-KNA'})
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-raised border border-line hover:bg-tint text-ink text-xs font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-subtle">download</span>
                <span>Unduh Manifest (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-raised border border-line hover:bg-tint text-ink text-xs font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-subtle">print</span>
                <span>Cetak Label Bagasi</span>
              </button>
              <Link
                to={`/staff/scan?flightId=${flightId}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                <span>Buka Verifikasi Boarding</span>
              </Link>
            </div>
          </div>

          {/* Counts & Visual Stacked Progress Bar */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line/60">
            <div className="flex flex-wrap items-center justify-between text-xs text-subtle gap-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                <span className="font-bold text-ink text-sm">{summary.passenger_count}</span>
                <span>Total Penumpang</span>
                <span className="text-line">•</span>
                <span className="font-bold text-success text-sm">{summary.checked_in_count}</span>
                <span>Sudah Check-in</span>
                <span className="text-line">•</span>
                <span className="font-bold text-success text-sm">{summary.boarded_count}</span>
                <span>Naik Pesawat (Boarded)</span>
                <span className="text-line">•</span>
                <span className="font-bold text-ink text-sm">{summary.not_checked_in_count}</span>
                <span>Belum Check-in</span>
                <span className="text-line">•</span>
                <span className="font-bold text-danger text-sm">{summary.no_show_count}</span>
                <span>Tidak Hadir</span>
              </div>
              <span className="text-[11px] font-semibold text-subtle uppercase tracking-wider">
                Sisa 26 Menit Menuju Pintu Ditutup
              </span>
            </div>

            {/* Stacked Progress Bar */}
            <div
              className="w-full h-3 rounded-full bg-raised overflow-hidden flex border border-line/50"
              title="Distribusi Boarding Penumpang"
            >
              {/* Naik Pesawat (Boarded - Green) */}
              <div
                className="h-full bg-success transition-all duration-500 ease-out"
                style={{ width: `${boardedPct}%` }}
              />
              {/* Check-in / Menunggu (Blue) */}
              <div
                className="h-full bg-brand transition-all duration-500 ease-out"
                style={{ width: `${waitingPct}%` }}
              />
              {/* Belum Check-in (Gray) */}
              <div
                className="h-full bg-line/60 transition-all duration-500 ease-out"
                style={{ width: `${notCheckedInPct}%` }}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-subtle pt-1 tabular-nums">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-success" />
                <span>
                  Naik pesawat: <strong className="text-ink">{summary.boarded_count}</strong> ({boardedPct}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-brand" />
                <span>
                  Check-in / Menunggu: <strong className="text-ink">{waitingCheckinCount}</strong> ({waitingPct}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-line" />
                <span>
                  Belum check-in: <strong className="text-ink">{summary.not_checked_in_count}</strong> ({notCheckedInPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── FILTER PILLS & SEARCH HORIZONS ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              Semua ({summary.passenger_count})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('boarded')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1 shrink-0 ${
                activeFilter === 'boarded'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${activeFilter === 'boarded' ? 'text-white' : 'text-success'}`}>
                check_circle
              </span>
              <span>Naik pesawat ({summary.boarded_count})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('checked_in')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1 shrink-0 ${
                activeFilter === 'checked_in'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>Check-in ({waitingCheckinCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('not_checked_in')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1 shrink-0 ${
                activeFilter === 'not_checked_in'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-subtle">schedule</span>
              <span>Belum check-in ({summary.not_checked_in_count})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('special')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1 shrink-0 ${
                activeFilter === 'special'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-signal">luggage</span>
              <span>Bagasi Ekstra</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex items-center w-full sm:w-[340px]">
              <span className="material-symbols-outlined absolute left-3 text-subtle text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama penumpang, kursi, atau kode..."
                className="w-full h-10 pl-9 pr-8 rounded-control bg-panel border border-line text-ink placeholder:text-subtle text-xs focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-subtle hover:text-ink"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
            <div className="px-2.5 py-1 rounded bg-tint text-brand-fg font-semibold text-[11px] uppercase shrink-0 tabular-nums">
              {filteredList.length} hasil
            </div>
          </div>
        </div>

        {/* ─── HAIRLINE MANIFEST TABLE CONTAINER ─── */}
        <div className="w-full bg-panel border border-line rounded-ticket shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-raised border-b border-line text-subtle font-semibold text-[11px] uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4 w-20">Kursi</th>
                  <th scope="col" className="py-3 px-4">Penumpang (Nama &amp; Kontak)</th>
                  <th scope="col" className="py-3 px-4">No. Identitas (NIK/Paspor)</th>
                  <th scope="col" className="py-3 px-4">Tiket &amp; Kode Booking</th>
                  <th scope="col" className="py-3 px-4">Bagasi</th>
                  <th scope="col" className="py-3 px-4">Status Boarding</th>
                  <th scope="col" className="py-3 px-4 text-right">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs font-medium">
                {loading && manifestList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-subtle">
                      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Memuat data manifest penumpang...
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-subtle">
                      Tidak ada data penumpang yang cocok dengan filter atau pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((passenger) => {
                    const isBoarded = passenger.status === 'boarded'
                    const isCheckedIn = passenger.status === 'checked_in'
                    const isNoShow = passenger.status === 'no_show'
                    const isNotCheckedIn = passenger.status === 'not_checked_in'

                    return (
                      <tr
                        key={passenger.id}
                        className={`transition-colors hover:bg-tint/30 ${
                          isBoarded ? 'bg-success/5' : ''
                        }`}
                      >
                        {/* Kursi */}
                        <td className="py-3.5 px-4 font-bold text-base text-ink tabular-nums">
                          {passenger.seat_number ? (
                            <span className={isBoarded ? 'text-success' : 'text-brand-fg'}>
                              {passenger.seat_number}
                            </span>
                          ) : (
                            <span className="text-subtle text-xs italic">-</span>
                          )}
                        </td>

                        {/* Nama Penumpang */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-ink text-sm">
                              {passenger.full_name}
                            </span>
                            <span className="text-subtle text-[11px] mt-0.5">
                              {passenger.gender === 'male' ? 'Tuan' : 'Nyonya'} • {passenger.seat_class || 'Ekonomi'}
                            </span>
                          </div>
                        </td>

                        {/* NIK Masked */}
                        <td className="py-3.5 px-4 tabular-nums text-ink font-mono text-xs">
                          {passenger.id_number}
                        </td>

                        {/* Tiket & Booking Code */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="tabular-nums font-semibold text-ink">
                              TK-{passenger.id.toString().padStart(7, '0')}
                            </span>
                            <span className="text-[11px] text-subtle">
                              PNR:{' '}
                              <strong className="text-brand-fg font-semibold font-mono">
                                {passenger.booking_code || '---'}
                              </strong>
                            </span>
                          </div>
                        </td>

                        {/* Bagasi */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 text-xs text-ink">
                            <span className="material-symbols-outlined text-[16px] text-subtle">
                              luggage
                            </span>
                            <span>
                              {passenger.baggage
                                ? `${passenger.baggage.name} (${passenger.baggage.weight_kg} kg)`
                                : '7 kg Kabin'}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isBoarded ? (
                            <div className="inline-flex flex-col">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/15 text-success font-semibold text-xs">
                                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                Naik pesawat
                              </span>
                              <span className="text-[10px] text-subtle mt-0.5 pl-1 tabular-nums">
                                Tercatat (Gate 14)
                              </span>
                            </div>
                          ) : isCheckedIn ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tint text-brand-fg font-semibold text-xs">
                              <span className="material-symbols-outlined text-[15px]">check</span>
                              Check-in
                            </span>
                          ) : isNoShow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-danger/15 text-danger font-semibold text-xs">
                              <span className="material-symbols-outlined text-[15px]">cancel</span>
                              Tidak hadir (No show)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-raised text-subtle font-semibold text-xs border border-line">
                              <span className="material-symbols-outlined text-[15px]">schedule</span>
                              Belum check-in
                            </span>
                          )}
                        </td>

                        {/* Aksi Cepat */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isCheckedIn && (
                              <>
                                <button
                                  type="button"
                                  disabled={updatingId === passenger.id}
                                  onClick={() => handleUpdateStatus(passenger, 'boarded')}
                                  className="px-2.5 py-1 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-xs transition-colors"
                                >
                                  Tandai naik
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingId === passenger.id}
                                  onClick={() => handleUpdateStatus(passenger, 'no_show')}
                                  className="px-2.5 py-1 rounded-control bg-raised hover:bg-danger/10 text-danger border border-line text-xs font-semibold transition-colors"
                                >
                                  Tidak hadir
                                </button>
                              </>
                            )}

                            {isBoarded && (
                              <button
                                type="button"
                                disabled={updatingId === passenger.id}
                                onClick={() => handleUpdateStatus(passenger, 'checked_in')}
                                className="px-2.5 py-1 rounded-control bg-raised hover:bg-tint text-subtle hover:text-ink border border-line text-xs font-semibold transition-colors"
                              >
                                Urungkan
                              </button>
                            )}

                            {isNoShow && (
                              <button
                                type="button"
                                disabled={updatingId === passenger.id}
                                onClick={() => handleUpdateStatus(passenger, 'checked_in')}
                                className="px-2.5 py-1 rounded-control bg-tint hover:bg-brand text-brand-fg hover:text-white text-xs font-semibold transition-colors"
                              >
                                Pulihkan
                              </button>
                            )}

                            {isNotCheckedIn && (
                              <span className="text-subtle text-[11px] italic">
                                Menunggu konter
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-raised border-t border-line flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-subtle">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-brand-fg">sync</span>
              <span>
                Menampilkan <strong>{filteredList.length}</strong> dari <strong>{manifestList.length}</strong> penumpang terdaftar
              </span>
              <span className="hidden md:inline text-line">•</span>
              <span className="hidden md:inline">Sinkronisasi otomatis dengan DCS setiap 15 detik</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <span>Halaman 1 dari 1</span>
            </div>
          </div>
        </div>

        {/* ─── FLOATING TOAST LAYER (Bottom Right) ─── */}
        {toast && (
          <aside
            role="alert"
            className="fixed bottom-6 right-6 z-50 bg-panel border border-line rounded-ticket p-4 shadow-xl flex items-center gap-3.5 max-w-md animate-fadeIn"
          >
            <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">check</span>
            </div>
            <div className="flex flex-col text-left pr-2 text-xs">
              <span className="font-semibold text-ink leading-snug">
                <strong>{toast.title}</strong>
              </span>
              <span className="text-subtle text-[11px] mt-0.5">{toast.detail}</span>
            </div>
            <button
              type="button"
              onClick={handleUndo}
              className="text-brand-fg hover:underline font-bold text-xs shrink-0"
            >
              Urungkan
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-subtle hover:text-ink hover:bg-raised transition-colors shrink-0"
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

