import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import StaffLayout from '../../components/layout/StaffLayout'

interface FlightItem {
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

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [flights, setFlights] = useState<FlightItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'departing' | 'completed'>('all')
  const [selectedGate, setSelectedGate] = useState<string>('all')
  const [lastRefreshed, setLastRefreshed] = useState<string>('')
  const [toastNotification, setToastNotification] = useState<{
    gate: string
    title: string
    desc: string
  } | null>({
    gate: 'Gate 14',
    title: 'Gerbang 14 Siap Boarding',
    desc: 'Penerbangan KA 412 siap untuk verifikasi boarding penumpang.',
  })

  const fetchFlights = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ error: boolean; data: FlightItem[] }>('/staff/flights?date=all')
      if (res.data?.data) {
        setFlights(res.data.data)
      }
      const now = new Date()
      setLastRefreshed(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
      )
    } catch (err) {
      console.error('Gagal mengambil daftar penerbangan staf:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFlights()
    const interval = setInterval(() => {
      fetchFlights()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Helper formats
  const formatTimeStr = (iso?: string | null) => {
    if (!iso) return '--.-- WIB'
    const d = new Date(iso)
    return (
      d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'
    )
  }

  const calculateDuration = (dep?: string | null, arr?: string | null) => {
    if (!dep || !arr) return '1j 50m'
    const diffMs = new Date(arr).getTime() - new Date(dep).getTime()
    if (diffMs <= 0) return '1j 50m'
    const mins = Math.floor(diffMs / (1000 * 60))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}j ${m > 0 ? `${m}m` : ''}`
  }

  // Derive pseudo gates deterministically from id
  const getGateForFlight = (flightId: number) => {
    const gates = ['Gate 14', 'Gate 22', 'Gate 12B', 'Gate 18', 'Gate 7', 'Gate 11']
    return gates[(flightId - 1) % gates.length]
  }

  // Categorize flights (departing vs completed)
  const isFlightCompleted = (f: FlightItem) => {
    if (!f.departure_time) return false
    const dep = new Date(f.departure_time).getTime()
    const now = Date.now()
    return now - dep > 3 * 3600 * 1000 // > 3 hours after departure
  }

  // Filtered flights
  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      const isCompleted = isFlightCompleted(f)
      if (activeTab === 'departing' && isCompleted) return false
      if (activeTab === 'completed' && !isCompleted) return false

      const gate = getGateForFlight(f.id)
      if (selectedGate !== 'all' && gate !== selectedGate) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNum = f.flight_number.toLowerCase().includes(q)
        const matchAirline = f.airline?.name.toLowerCase().includes(q) || false
        const matchOrig = f.origin?.city.toLowerCase().includes(q) || f.origin?.code.toLowerCase().includes(q) || false
        const matchDest = f.destination?.city.toLowerCase().includes(q) || f.destination?.code.toLowerCase().includes(q) || false
        if (!matchNum && !matchAirline && !matchOrig && !matchDest) return false
      }

      return true
    })
  }, [flights, activeTab, selectedGate, searchQuery])

  // Operational metrics
  const totalScheduled = flights.length
  const totalCapacity = flights.reduce((sum, f) => sum + (f.total_capacity || 180), 0)
  const totalPassengers = flights.reduce((sum, f) => sum + (f.passenger_count || 0), 0)
  const totalCheckedIn = flights.reduce((sum, f) => sum + (f.checked_in_count || 0), 0)
  const occupancyPercent = totalCapacity > 0 ? Math.round((totalPassengers / totalCapacity) * 100) : 0
  const onTimeCount = flights.filter((f) => f.status === 'scheduled' && f.delay_minutes === 0).length
  const delayedCount = flights.filter((f) => f.delay_minutes > 0 || f.status === 'delayed').length

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  return (
    <StaffLayout activeFlightId={flights[0]?.id || 1}>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ─── TOP OPERATIONAL CONTROL PANEL ─── */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tint text-brand-fg font-semibold text-[11px] uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Pusat Kendali Gerbang • Sinkronisasi Real-time Aktif
                </div>
                <span className="text-subtle font-semibold text-[11px] tracking-widest uppercase">
                  CGK T3/T1
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                Penerbangan Hari Ini, {todayStr}
              </h1>
              <p className="text-sm text-subtle mt-0.5">
                Terminal Keberangkatan Domestik T3 &amp; T1 • Bandara Internasional Soekarno-Hatta
              </p>
            </div>

            {/* Segmented Control Filters */}
            <div className="flex items-center self-start lg:self-auto bg-raised border border-line p-1 rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-panel text-brand-fg shadow-sm'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                Semua ({totalScheduled})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('departing')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'departing'
                    ? 'bg-panel text-brand-fg shadow-sm'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                Akan berangkat ({flights.filter((f) => !isFlightCompleted(f)).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'completed'
                    ? 'bg-panel text-brand-fg shadow-sm'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                Selesai ({flights.filter((f) => isFlightCompleted(f)).length})
              </button>
            </div>
          </div>

          {/* Search Bar & Integrated Quick Filters */}
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative w-full md:w-96">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor penerbangan atau kota tujuan..."
                className="w-full h-11 pl-10 pr-4 rounded-control bg-panel border border-line text-ink placeholder:text-subtle text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto text-xs text-subtle">
              <span className="shrink-0 font-semibold uppercase tracking-wider text-[11px] text-subtle">
                Gerbang Cepat:
              </span>
              {['all', 'Gate 14', 'Gate 22', 'Gate 12B', 'Gate 18'].map((gate) => {
                const label = gate === 'all' ? 'Semua' : gate === 'Gate 14' ? 'Gate 14 (Aktif)' : gate
                const isSelected = selectedGate === gate
                return (
                  <button
                    key={gate}
                    type="button"
                    onClick={() => setSelectedGate(gate)}
                    className={`px-2.5 py-1 rounded border transition-colors tabular-nums font-medium ${
                      isSelected
                        ? 'bg-brand text-white border-brand'
                        : 'bg-panel border-line text-ink hover:bg-tint'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── OPERATIONAL KPI METRIC HORIZON BAR ─── */}
        <div className="w-full bg-raised border border-line px-4 py-3 rounded-ticket mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-ink text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-fg text-[20px]">analytics</span>
            <span>
              Total <strong>{totalScheduled} penerbangan terjadwal</strong> hari ini:{' '}
              {totalCapacity} kursi kapasitas, {totalPassengers} penumpang terdaftar (
              <strong>{occupancyPercent}% okupansi</strong>), {totalCheckedIn} selesai check-in.
            </span>
          </div>
          <div className="flex items-center gap-4 text-subtle shrink-0 tabular-nums">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-success" />
              {onTimeCount} Tepat Waktu
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-danger" />
              {delayedCount} Tertunda
            </span>
          </div>
        </div>

        {/* ─── DEPARTURE FLIGHTS SCHEDULE STACK ─── */}
        {loading && flights.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-subtle">Memuat jadwal penerbangan staf...</p>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="bg-panel border border-line rounded-ticket p-12 text-center my-6">
            <span className="material-symbols-outlined text-subtle text-4xl mb-2">flight_takeoff</span>
            <h3 className="font-bold text-ink text-base">Tidak ada penerbangan yang cocok</h3>
            <p className="text-subtle text-xs mt-1">Coba sesuaikan filter status atau kata kunci pencarian Anda.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredFlights.map((flight) => {
              const gate = getGateForFlight(flight.id)
              const isCompleted = isFlightCompleted(flight)
              const checkinPct =
                flight.passenger_count > 0
                  ? Math.round((flight.checked_in_count / flight.passenger_count) * 100)
                  : 0
              const depFormatted = formatTimeStr(flight.departure_time)
              const arrFormatted = formatTimeStr(flight.arrival_time)
              const duration = calculateDuration(flight.departure_time, flight.arrival_time)

              const airlineInitials =
                flight.airline?.code ||
                flight.flight_number.split('-')[0] ||
                flight.airline?.name.slice(0, 2).toUpperCase() ||
                'SB'

              // Status badges logic
              let statusBadge = (
                <div className="px-3 py-1.5 rounded-full bg-success/10 text-success flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                  <span>Check-in dibuka</span>
                </div>
              )

              if (flight.delay_minutes > 0 || flight.status === 'delayed') {
                statusBadge = (
                  <div className="px-3 py-1.5 rounded-full bg-danger/10 text-danger flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[15px]">warning</span>
                    <span>Tertunda {flight.delay_minutes}m</span>
                  </div>
                )
              } else if (isCompleted) {
                statusBadge = (
                  <div className="px-3 py-1.5 rounded-full bg-raised text-subtle flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[15px]">done_all</span>
                    <span>Boarding selesai</span>
                  </div>
                )
              } else if (checkinPct > 60) {
                statusBadge = (
                  <div className="px-3 py-1.5 rounded-full bg-tint text-brand-fg flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[15px]">schedule</span>
                    <span>Boarding segera dibuka</span>
                  </div>
                )
              }

              const isHighlighted = flight.id === 1

              return (
                <div
                  key={flight.id}
                  className={`relative transition-all rounded-ticket p-4 sm:p-5 border ${
                    isHighlighted
                      ? 'bg-tint/40 hover:bg-tint/60 border-brand/40 shadow-xs'
                      : isCompleted
                      ? 'bg-panel/70 opacity-85 hover:opacity-100 border-line'
                      : 'bg-panel hover:bg-tint/20 border-line shadow-xs'
                  }`}
                >
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Flight Identification */}
                    <div className="flex items-start md:items-center gap-3.5 min-w-[240px]">
                      <div className="w-12 h-12 rounded-xl bg-brand text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {airlineInitials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-ink tracking-tight">
                            {flight.airline?.name || 'SkyBook'} • {flight.flight_number}
                          </span>
                          {!isCompleted && (
                            <span className="px-2 py-0.5 rounded-full bg-tint text-brand-fg text-[10px] uppercase tracking-wider font-semibold">
                              Berangkat 1j 20m
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-subtle mt-0.5">
                          {flight.airplane?.model || 'Boeing 737-800'} • T3 Domestik
                        </p>
                      </div>
                    </div>

                    {/* Route & Timing Matrix */}
                    <div className="flex items-center gap-6 min-w-[300px]">
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold text-ink tracking-tight">
                          {flight.origin?.code || 'CGK'}
                        </span>
                        <span className="tabular-nums text-xs font-semibold text-ink">
                          {depFormatted}
                        </span>
                        <span className="text-xs text-subtle">
                          {flight.origin?.city || 'Jakarta'}
                        </span>
                      </div>

                      <div className="flex flex-col items-center flex-1 px-2">
                        <span className="text-[10px] font-semibold text-subtle uppercase tracking-widest mb-1">
                          {duration}
                        </span>
                        <div className="relative w-full flex items-center">
                          <div className="w-full h-[1.5px] bg-line" />
                          <span className="material-symbols-outlined text-brand-fg text-[16px] absolute left-1/2 -translate-x-1/2 bg-panel px-1">
                            flight
                          </span>
                        </div>
                        <span className="text-[10px] text-success uppercase tracking-wider mt-1 font-semibold">
                          Langsung
                        </span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-bold text-ink tracking-tight">
                          {flight.destination?.code || 'DPS'}
                        </span>
                        <span className="tabular-nums text-xs font-semibold text-ink">
                          {arrFormatted}
                        </span>
                        <span className="text-xs text-subtle">
                          {flight.destination?.city || 'Denpasar'}
                        </span>
                      </div>
                    </div>

                    {/* Check-in Metrics */}
                    <div className="w-full xl:w-44 flex flex-col justify-center">
                      <div className="flex justify-between items-baseline mb-1 text-xs">
                        <span className="text-subtle font-semibold uppercase text-[10px]">Check-in</span>
                        <span className="tabular-nums font-semibold text-ink">
                          {flight.checked_in_count}{' '}
                          <span className="text-subtle font-normal">
                            / {flight.passenger_count || flight.total_capacity} ({checkinPct}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-raised overflow-hidden border border-line/40">
                        <div
                          className="h-full bg-brand rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(checkinPct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Gate & Status */}
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-ink">{gate}</span>
                        <span className="text-[10px] uppercase font-semibold text-subtle">
                          Boarding Gerbang
                        </span>
                      </div>
                      {statusBadge}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 xl:pt-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/staff/flights/${flight.id}/manifest`)}
                        className="px-3.5 py-2 rounded-control bg-raised border border-line text-ink hover:bg-tint transition-colors text-xs font-semibold"
                      >
                        Buka manifest
                      </button>
                      <button
                        type="button"
                        disabled={isCompleted}
                        onClick={() => navigate(`/staff/scan?flightId=${flight.id}`)}
                        className={`px-4 py-2 rounded-control text-xs font-semibold shadow-xs transition-all ${
                          isCompleted
                            ? 'bg-raised text-subtle cursor-not-allowed border border-line'
                            : 'bg-brand hover:bg-brand-hover text-white active:scale-[0.98]'
                        }`}
                      >
                        Verifikasi boarding
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── OPERATIONAL FOOTER CONTEXT DETAIL ─── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-subtle text-xs py-4 border-t border-line">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>Status otomatis disinkronisasi setiap 30 detik melalui integrasi DCS bandara.</span>
          </div>
          <div className="flex items-center gap-3 mt-2 sm:mt-0 tabular-nums">
            <span>Pembaruan terakhir: {lastRefreshed || 'Baru saja'}</span>
            <button
              type="button"
              onClick={fetchFlights}
              className="text-brand-fg hover:underline font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Segarkan
            </button>
          </div>
        </div>

        {/* ─── FLOATING TOAST NOTIFICATION ─── */}
        {toastNotification && (
          <aside className="fixed bottom-6 right-6 z-40 max-w-md bg-panel border border-line rounded-ticket p-4 shadow-lg flex items-start gap-3 transition-all animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
            <div className="flex-1 pr-2">
              <h4 className="text-xs font-bold text-ink leading-snug">
                {toastNotification.title}
              </h4>
              <p className="text-[11px] text-subtle mt-0.5 leading-relaxed">
                {toastNotification.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-subtle hover:text-ink p-1 rounded transition-colors"
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
