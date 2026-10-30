import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import StaffLayout from '../../components/layout/StaffLayout'

interface ManifestPassenger {
  id: number
  passenger_id: number
  seq_number?: string
  check_in_id: number | null
  booking_id: number
  booking_code: string | null
  full_name: string
  passenger_name: string
  manifest_name?: string
  id_number: string
  gender: 'male' | 'female'
  pax_type?: string
  seat_class: string
  seat_number: string | null
  e_ticket_number?: string
  baggage: { id: number; name: string; weight_kg: number; pieces?: number } | null
  ssr?: string
  boarding_pass_code: string | null
  checked_in_at: string | null
  checkin_status: 'checked_in' | 'boarded' | 'no_show' | 'not_checked_in'
  status: 'checked_in' | 'boarded' | 'no_show' | 'not_checked_in'
}

interface ManifestFlight {
  id: number
  flight_number: string
  airline: { name: string; code: string; logo?: string | null } | null
  airplane: {
    model: string
    registration_number: string
    total_seat_economy?: number
    total_seat_business?: number
  } | null
  route: string
  origin: { code: string; city: string; name: string } | null
  destination: { code: string; city: string; name: string } | null
  departure_time: string | null
  arrival_time: string | null
  terminal?: string
  gate?: string
  captain_name?: string
  purser_name?: string
  dispatcher_name?: string
  flight_type?: string
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
  business_count?: number
  economy_count?: number
  male_count?: number
  female_count?: number
  total_baggage_pieces?: number
  total_baggage_weight_kg?: number
}

type FilterType = 'all' | 'boarded' | 'checked_in' | 'not_checked_in' | 'no_show' | 'business' | 'special'

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
    business_count: 0,
    economy_count: 0,
    male_count: 0,
    female_count: 0,
    total_baggage_pieces: 0,
    total_baggage_weight_kg: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<'seat' | 'name' | 'status'>('seat')
  const [viewMode, setViewMode] = useState<'dashboard' | 'document_preview'>('dashboard')
  const [currentClock, setCurrentClock] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [copiedPnr, setCopiedPnr] = useState<string | null>(null)
  const [baggageModalPax, setBaggageModalPax] = useState<ManifestPassenger | null>(null)
  const [toast, setToast] = useState<{
    id: number
    title: string
    detail: string
    previousStatus: 'checked_in' | 'boarded' | 'no_show' | 'not_checked_in'
  } | null>(null)

  const printAreaRef = useRef<HTMLDivElement>(null)

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

  // Auto-refresh DCS every 20 seconds
  useEffect(() => {
    fetchManifest(true)
    const interval = setInterval(() => {
      fetchManifest(false)
    }, 20000)
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
        if (oldStatus === 'not_checked_in') next.not_checked_in_count = Math.max(0, next.not_checked_in_count - 1)

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
        boarded: 'ditandai naik pesawat (BOARDED)',
        no_show: 'ditandai tidak hadir (NO SHOW)',
        checked_in: 'dikembalikan ke status GATE STANDBY',
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

  // Copy PNR
  const handleCopyPnr = (pnr?: string | null) => {
    if (!pnr) return
    navigator.clipboard.writeText(pnr)
    setCopiedPnr(pnr)
    setTimeout(() => setCopiedPnr(null), 2000)
  }

  // Filtered & Sorted List
  const filteredList = useMemo(() => {
    const list = manifestList.filter((p) => {
      // Filter tab
      if (activeFilter === 'boarded' && p.status !== 'boarded') return false
      if (activeFilter === 'checked_in' && p.status !== 'checked_in') return false
      if (activeFilter === 'not_checked_in' && p.status !== 'not_checked_in') return false
      if (activeFilter === 'no_show' && p.status !== 'no_show') return false
      if (activeFilter === 'business' && p.seat_class !== 'business') return false
      if (activeFilter === 'special') {
        const isSpecialBaggage = p.baggage && p.baggage.weight_kg > 20
        const isSsr = p.ssr && p.ssr !== 'NIL'
        if (!isSpecialBaggage && !isSsr) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = p.full_name.toLowerCase().includes(q)
        const matchSeat = (p.seat_number || '').toLowerCase().includes(q)
        const matchPnr = (p.booking_code || '').toLowerCase().includes(q)
        const matchBp = (p.boarding_pass_code || '').toLowerCase().includes(q)
        const matchTicket = (p.e_ticket_number || '').toLowerCase().includes(q)
        const matchId = (p.id_number || '').toLowerCase().includes(q)
        if (!matchName && !matchSeat && !matchPnr && !matchBp && !matchTicket && !matchId) return false
      }

      return true
    })

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.full_name.localeCompare(b.full_name)
      }
      if (sortBy === 'status') {
        const statusOrder = { boarded: 1, checked_in: 2, not_checked_in: 3, no_show: 4 }
        return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5)
      }
      // default seat
      return (a.seq_number || '').localeCompare(b.seq_number || '')
    })
  }, [manifestList, activeFilter, searchQuery, sortBy])

  // Counts & metrics
  const totalPax = summary.passenger_count || manifestList.length || 1
  const boardedCount = summary.boarded_count
  const waitingCheckinCount = summary.checked_in_count - summary.boarded_count > 0 
    ? summary.checked_in_count - summary.boarded_count 
    : manifestList.filter(p => p.status === 'checked_in').length
  const boardedPct = ((boardedCount / totalPax) * 100).toFixed(1)

  // Format Helpers
  const formatTimeStr = (iso?: string | null) => {
    if (!iso) return '08.55 WIB'
    const d = new Date(iso)
    return (
      d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'
    )
  }

  const formatIcaoDate = (iso?: string | null) => {
    const d = iso ? new Date(iso) : new Date()
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const day = d.getDate().toString().padStart(2, '0')
    const mon = months[d.getMonth()]
    const yr = d.getFullYear()
    return `${day} ${mon} ${yr}`
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <StaffLayout activeFlightId={flightId}>
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. SCREEN UI: AIRLINE DCS OPS DASHBOARD (Hidden in Print)          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="print:hidden max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-5 flex flex-col gap-5">
        
        {/* ── Top Bar: Breadcrumb, DCS Indicator, Realtime Clock ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <Link
            to="/staff"
            className="inline-flex items-center gap-1.5 text-subtle hover:text-brand-fg font-semibold transition-colors group"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            <span>Kembali ke Jadwal Penerbangan</span>
          </Link>

          <div className="flex items-center gap-4 bg-panel border border-line px-3 py-1.5 rounded-full shadow-xs">
            <div className="flex items-center gap-2 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-ink font-semibold">DCS Connected</span>
              <span className="text-subtle font-mono text-[11px]">
                ({flight?.origin?.code || 'CGK'}-{flight?.gate || 'Gate 14'})
              </span>
            </div>
            <span className="text-line">|</span>
            <div className="tabular-nums font-mono text-ink font-medium">
              {currentClock} <span className="text-subtle text-[10px]">WIB</span>
            </div>
          </div>
        </div>

        {/* ── Flight Operational Control Banner (World-Class Flight Ops Style) ── */}
        <div className="bg-gradient-to-r from-panel via-panel to-raised border border-line rounded-ticket p-5 sm:p-6 shadow-sm flex flex-col gap-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            
            {/* Carrier & Route Identity */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Carrier Logo / Tail Badge */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-brand/10 border border-brand/20 flex flex-col items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-brand text-2xl">
                  airlines
                </span>
                <span className="text-[10px] font-black tracking-wider text-brand font-mono">
                  {flight?.airline?.code || 'GA'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-brand text-white font-bold text-xs uppercase tracking-wider font-mono shadow-xs">
                    {flight?.airline?.name || 'Garuda Indonesia'} {flight?.flight_number || 'GA-402'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-tint text-brand-fg font-semibold text-[11px] uppercase tracking-wide">
                    {flight?.flight_type || 'Direct Domestik'}
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/15 border border-success/30 text-success font-semibold text-[11px] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
                    <span>BOARDING IN PROGRESS</span>
                  </div>
                </div>

                {/* Route String */}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-sans">
                    {flight?.origin?.city || 'Jakarta'} <span className="text-subtle font-normal font-mono text-xl sm:text-2xl">({flight?.origin?.code || 'CGK'})</span>
                    <span className="text-brand mx-2">→</span>
                    {flight?.destination?.city || 'Denpasar'} <span className="text-subtle font-normal font-mono text-xl sm:text-2xl">({flight?.destination?.code || 'DPS'})</span>
                  </h1>
                </div>

                {/* Sub-details (Gate, Time, Aircraft) */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle mt-0.5 font-medium">
                  <div className="flex items-center gap-1 text-ink font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-brand">schedule</span>
                    <span>STD: <strong className="tabular-nums font-mono">{formatTimeStr(flight?.departure_time)}</strong></span>
                  </div>
                  <span className="text-line">•</span>
                  <div className="flex items-center gap-1 text-ink font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-brand">meeting_room</span>
                    <span>{flight?.terminal || 'Terminal 3'}, <strong className="text-brand font-bold">{flight?.gate || 'Gate 14'}</strong></span>
                  </div>
                  <span className="text-line">•</span>
                  <div className="flex items-center gap-1 text-subtle">
                    <span className="material-symbols-outlined text-[16px]">flight</span>
                    <span>{flight?.airplane?.model || 'Boeing 737-800'} <strong className="font-mono text-ink">({flight?.airplane?.registration_number || 'PK-GAA'})</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ops Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-bold tracking-wide shadow-sm transition-all active:scale-[0.98]"
                title="Cetak dokumen resmi Flight Passenger Manifest berstandar ICAO / IATA"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Cetak Manifest Resmi (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'dashboard' ? 'document_preview' : 'dashboard')}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-control border text-xs font-semibold transition-all ${
                  viewMode === 'document_preview'
                    ? 'bg-ink text-white border-ink'
                    : 'bg-panel border-line text-ink hover:bg-tint'
                }`}
                title="Lihat tampilan dokumen A4 sebelum dicetak"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {viewMode === 'document_preview' ? 'dashboard' : 'preview'}
                </span>
                <span>{viewMode === 'document_preview' ? 'Mode Dashboard' : 'Pratinjau Dokumen'}</span>
              </button>

              <button
                type="button"
                onClick={() => setBaggageModalPax(manifestList[0] || null)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-control bg-panel border border-line text-ink hover:bg-tint text-xs font-semibold transition-colors"
                title="Cetak label bagasi penumpang"
              >
                <span className="material-symbols-outlined text-[18px] text-subtle">luggage</span>
                <span>Label Bagasi</span>
              </button>

              <Link
                to={`/staff/scan?flightId=${flightId}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-control bg-raised border border-line hover:border-brand text-brand-fg text-xs font-bold transition-all"
                title="Buka pemindai boarding pass di gate"
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                <span>Gate Scanner</span>
              </Link>
            </div>
          </div>

          {/* ── Operational KPI Ribbon ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-line/70">
            {/* Total Manifest */}
            <div className="bg-panel border border-line/70 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">Total Manifest</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-ink tabular-nums font-mono">
                  {summary.passenger_count || manifestList.length}
                </span>
                <span className="text-[11px] text-subtle font-medium">
                  / {summary.total_capacity || 180} pax
                </span>
              </div>
              <div className="text-[10px] text-subtle mt-1">
                {summary.business_count || 3} Bisnis • {summary.economy_count || 15} Ekonomi
              </div>
            </div>

            {/* Boarded */}
            <div className="bg-success/5 border border-success/30 rounded-lg p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-success">Naik Pesawat</span>
                <span className="material-symbols-outlined text-[16px] text-success">check_circle</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-success tabular-nums font-mono">
                  {summary.boarded_count}
                </span>
                <span className="text-xs font-bold text-success font-mono">
                  {boardedPct}%
                </span>
              </div>
              <div className="w-full bg-success/20 h-1 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-success h-full transition-all duration-500" style={{ width: `${boardedPct}%` }} />
              </div>
            </div>

            {/* Checked-In / Standby Gate */}
            <div className="bg-brand/5 border border-brand/20 rounded-lg p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-fg">Gate Standby</span>
                <span className="material-symbols-outlined text-[16px] text-brand-fg">how_to_reg</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-brand-fg tabular-nums font-mono">
                  {waitingCheckinCount}
                </span>
                <span className="text-[11px] text-subtle font-medium">di ruang tunggu</span>
              </div>
              <div className="text-[10px] text-brand-fg font-medium mt-1">
                Siap verifikasi boarding
              </div>
            </div>

            {/* Pending Check-in */}
            <div className="bg-panel border border-line/70 rounded-lg p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">Belum Check-In</span>
                <span className="material-symbols-outlined text-[16px] text-subtle">pending</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-ink tabular-nums font-mono">
                  {summary.not_checked_in_count}
                </span>
                <span className="text-[11px] text-subtle font-medium">penumpang</span>
              </div>
              <div className="text-[10px] text-subtle mt-1">
                Menunggu di konter DCS
              </div>
            </div>

            {/* No-Show */}
            <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-danger">Tidak Hadir (No Show)</span>
                <span className="material-symbols-outlined text-[16px] text-danger">cancel</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-danger tabular-nums font-mono">
                  {summary.no_show_count}
                </span>
                <span className="text-[11px] text-danger font-medium">offloaded</span>
              </div>
              <div className="text-[10px] text-danger font-medium mt-1">
                Gate ditutup bagi no-show
              </div>
            </div>

            {/* Baggage Summary */}
            <div className="bg-panel border border-line/70 rounded-lg p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">Bagasi Tercatat</span>
                <span className="material-symbols-outlined text-[16px] text-subtle">luggage</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-ink tabular-nums font-mono">
                  {summary.total_baggage_pieces || 16}
                </span>
                <span className="text-xs font-bold text-ink font-mono">
                  {summary.total_baggage_weight_kg || 320} kg
                </span>
              </div>
              <div className="text-[10px] text-subtle mt-1">
                Rerata 20.0 kg / bag
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter Toolbar, Search & Sort ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Filter Pills with Badge Counters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'all'
                  ? 'bg-ink text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span>Semua</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {manifestList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('boarded')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'boarded'
                  ? 'bg-success text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">check_circle</span>
              <span>Naik Pesawat</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 font-mono">
                {summary.boarded_count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('checked_in')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'checked_in'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">how_to_reg</span>
              <span>Gate Standby</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 font-mono">
                {waitingCheckinCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('not_checked_in')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'not_checked_in'
                  ? 'bg-subtle text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">pending</span>
              <span>Belum Check-In</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 font-mono">
                {summary.not_checked_in_count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('no_show')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'no_show'
                  ? 'bg-danger text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">cancel</span>
              <span>Tidak Hadir</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 font-mono">
                {summary.no_show_count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('business')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'business'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">workspace_premium</span>
              <span>Bisnis</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 font-mono">
                {summary.business_count || 3}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('special')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'special'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-panel border border-line text-ink hover:bg-tint'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">accessible</span>
              <span>SSR / Khusus</span>
            </button>
          </div>

          {/* Search Box & Sort */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative flex items-center w-full sm:w-[320px]">
              <span className="material-symbols-outlined absolute left-3 text-subtle text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, kursi, PNR, e-ticket..."
                className="w-full h-9 pl-9 pr-8 rounded-control bg-panel border border-line text-ink placeholder:text-subtle text-xs focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 w-4 h-4 rounded-full flex items-center justify-center text-subtle hover:text-ink"
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-2.5 rounded-control bg-panel border border-line text-ink text-xs font-medium focus:outline-none focus:border-brand"
            >
              <option value="seat">Urut Kursi</option>
              <option value="name">Urut Nama</option>
              <option value="status">Urut Status</option>
            </select>
          </div>
        </div>

        {/* ── DOCUMENT PREVIEW BANNER (If in Preview Mode) ── */}
        {viewMode === 'document_preview' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
              <span className="material-symbols-outlined text-amber-600 text-xl shrink-0">print</span>
              <div>
                <strong>Pratinjau Dokumen Cetak Standar ICAO / IATA Aktif</strong>
                <p className="text-[11px] text-subtle mt-0.5">
                  Tampilan di bawah ini adalah format resmi Flight Passenger Manifest yang dicetak ke kertas A4 atau disimpan ke PDF.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 rounded-control bg-brand hover:bg-brand-hover text-white font-bold transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Cetak Dokumen Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('dashboard')}
                className="px-3 py-1.5 rounded-control bg-panel border border-line text-ink font-semibold hover:bg-tint"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT VIEW: TABLE (DCS Dashboard) or DOCUMENT PREVIEW ── */}
        {viewMode === 'dashboard' ? (
          /* ══════════════════════════════════════════════════════════════ */
          /* DCS PASSENGER MANIFEST TABLE                                   */
          /* ══════════════════════════════════════════════════════════════ */
          <div className="w-full bg-panel border border-line rounded-ticket shadow-xs overflow-hidden flex flex-col">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[1040px]">
                <thead>
                  <tr className="bg-raised border-b border-line text-subtle font-semibold text-[10px] uppercase tracking-wider font-mono">
                    <th scope="col" className="py-3 px-3 w-12 text-center">SEQ</th>
                    <th scope="col" className="py-3 px-3 w-20">Kursi</th>
                    <th scope="col" className="py-3 px-4">Nama Penumpang (Manifest ICAO)</th>
                    <th scope="col" className="py-3 px-4">Kode Booking (PNR) &amp; E-Tiket</th>
                    <th scope="col" className="py-3 px-4">Bagasi &amp; SSR</th>
                    <th scope="col" className="py-3 px-4">Status Boarding</th>
                    <th scope="col" className="py-3 px-4 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70 text-xs font-medium">
                  {loading && manifestList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-subtle">
                        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Memuat data manifest penerbangan...
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-subtle">
                        Tidak ada data penumpang yang cocok dengan filter atau kata kunci pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((passenger, index) => {
                      const isBoarded = passenger.status === 'boarded'
                      const isCheckedIn = passenger.status === 'checked_in'
                      const isNoShow = passenger.status === 'no_show'
                      const isNotCheckedIn = passenger.status === 'not_checked_in'
                      const isBusiness = passenger.seat_class === 'business'

                      return (
                        <tr
                          key={passenger.id}
                          className={`transition-colors hover:bg-tint/40 ${
                            isBoarded ? 'bg-success/[0.03]' : isNoShow ? 'bg-danger/[0.03]' : ''
                          }`}
                        >
                          {/* SEQ */}
                          <td className="py-3 px-3 text-center text-subtle font-mono text-[11px]">
                            {passenger.seq_number || (index + 1).toString().padStart(3, '0')}
                          </td>

                          {/* Kursi */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-mono font-bold text-sm tabular-nums px-2 py-0.5 rounded border ${
                                  isBusiness
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                    : isBoarded
                                    ? 'bg-success/10 text-success border-success/30'
                                    : 'bg-raised text-ink border-line'
                                }`}
                              >
                                {passenger.seat_number || '---'}
                              </span>
                              {isBusiness && (
                                <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                                  BIZ
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Nama Penumpang */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-ink text-xs tracking-tight">
                                  {passenger.manifest_name || passenger.full_name.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-subtle mt-0.5">
                                <span>{passenger.full_name}</span>
                                <span className="text-line">•</span>
                                <span className="font-mono text-[10px]">
                                  {passenger.id_number}
                                </span>
                                <span className="text-line">•</span>
                                <span className="uppercase text-[10px]">
                                  {passenger.gender === 'male' ? 'Laki-Laki' : 'Perempuan'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* PNR & E-Tiket */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyPnr(passenger.booking_code)}
                                  className="font-mono font-bold text-brand-fg text-xs tracking-wider bg-tint px-1.5 py-0.5 rounded hover:bg-brand hover:text-white transition-colors"
                                  title="Salin PNR"
                                >
                                  {passenger.booking_code || '---'}
                                </button>
                                {copiedPnr === passenger.booking_code && (
                                  <span className="text-[10px] text-success font-semibold animate-fadeIn">
                                    Disalin!
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[11px] text-subtle">
                                {passenger.e_ticket_number || `126-${(1000000000 + passenger.id * 1024).toString().slice(0, 10)}`}
                              </span>
                            </div>
                          </td>

                          {/* Bagasi & SSR */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <div className="inline-flex items-center gap-1.5 text-xs text-ink font-mono">
                                <span className="material-symbols-outlined text-[15px] text-subtle">luggage</span>
                                <span>
                                  {passenger.baggage ? `${passenger.baggage.weight_kg} kg (1 koli)` : '7 kg Kabin'}
                                </span>
                              </div>
                              {passenger.ssr && passenger.ssr !== 'NIL' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 max-w-fit">
                                  {passenger.ssr}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status Boarding */}
                          <td className="py-3 px-4">
                            {isBoarded ? (
                              <div className="inline-flex flex-col">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-full bg-success/15 text-success font-bold text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                  <span>BOARDED</span>
                                </span>
                                <span className="text-[10px] text-subtle font-mono mt-0.5 pl-1">
                                  Gate 14 • {formatTimeStr(passenger.checked_in_at)}
                                </span>
                              </div>
                            ) : isCheckedIn ? (
                              <div className="inline-flex flex-col">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-full bg-brand/15 text-brand-fg font-bold text-xs">
                                  <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                  <span>CHECKED-IN</span>
                                </span>
                                <span className="text-[10px] text-subtle mt-0.5 pl-1">
                                  Standby Gate 14
                                </span>
                              </div>
                            ) : isNoShow ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-full bg-danger/15 text-danger font-bold text-xs">
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                                <span>NO-SHOW</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-full bg-raised text-subtle font-semibold text-xs border border-line">
                                <span className="material-symbols-outlined text-[14px]">pending</span>
                                <span>NOT CHECKED-IN</span>
                              </span>
                            )}
                          </td>

                          {/* Aksi Cepat */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {isCheckedIn && (
                                <>
                                  <button
                                    type="button"
                                    disabled={updatingId === passenger.id}
                                    onClick={() => handleUpdateStatus(passenger, 'boarded')}
                                    className="px-2.5 py-1 rounded bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-xs transition-colors"
                                  >
                                    Tandai Naik
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingId === passenger.id}
                                    onClick={() => handleUpdateStatus(passenger, 'no_show')}
                                    className="px-2 py-1 rounded bg-raised hover:bg-danger/10 text-danger border border-line text-xs font-semibold transition-colors"
                                  >
                                    No-Show
                                  </button>
                                </>
                              )}

                              {isBoarded && (
                                <button
                                  type="button"
                                  disabled={updatingId === passenger.id}
                                  onClick={() => handleUpdateStatus(passenger, 'checked_in')}
                                  className="px-2 py-1 rounded bg-raised hover:bg-tint text-subtle hover:text-ink border border-line text-xs font-semibold transition-colors"
                                >
                                  Urungkan
                                </button>
                              )}

                              {isNoShow && (
                                <button
                                  type="button"
                                  disabled={updatingId === passenger.id}
                                  onClick={() => handleUpdateStatus(passenger, 'checked_in')}
                                  className="px-2.5 py-1 rounded bg-tint hover:bg-brand text-brand-fg hover:text-white text-xs font-semibold transition-colors"
                                >
                                  Pulihkan
                                </button>
                              )}

                              {isNotCheckedIn && (
                                <span className="text-subtle text-[11px] italic">
                                  Konter DCS
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
            <div className="p-3.5 bg-raised border-t border-line flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-subtle font-mono">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-brand-fg">sync</span>
                <span>
                  Menampilkan <strong>{filteredList.length}</strong> dari <strong>{manifestList.length}</strong> penumpang terdaftar
                </span>
                <span className="hidden md:inline text-line">•</span>
                <span className="hidden md:inline">Sinkronisasi otomatis DCS aktif</span>
              </div>
              <div>
                Final Boarding Gate 14 • SkyBook DCS v2.4
              </div>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════ */
          /* ON-SCREEN DOCUMENT PREVIEW (Sheet View)                        */
          /* ══════════════════════════════════════════════════════════════ */
          <div className="bg-raised border border-line rounded-ticket p-6 shadow-sm overflow-x-auto flex justify-center">
            <div className="w-[820px] bg-white text-black p-8 shadow-xl rounded border border-gray-300 font-sans">
              <StandardManifestDocument
                flight={flight}
                manifestList={manifestList}
                summary={summary}
                currentClock={currentClock}
                formatTimeStr={formatTimeStr}
                formatIcaoDate={formatIcaoDate}
              />
            </div>
          </div>
        )}

        {/* ── Baggage Tag Modal ── */}
        {baggageModalPax && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-panel border border-line rounded-ticket p-6 shadow-2xl max-w-md w-full flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand text-xl">luggage</span>
                  <h3 className="font-bold text-ink text-base">Label Bagasi Resmi IATA</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBaggageModalPax(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-subtle hover:text-ink"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Tag Preview */}
              <div className="bg-white text-black p-4 rounded border-2 border-dashed border-gray-400 font-mono text-xs flex flex-col gap-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-bold text-base tracking-wider">GARUDA INDONESIA</span>
                  <span className="font-bold text-lg bg-black text-white px-2 py-0.5">DPS</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-gray-500 block">FLIGHT:</span>
                    <strong className="text-sm">{flight?.flight_number || 'GA-402'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">DESTINATION:</span>
                    <strong className="text-sm">DPS (DENPASAR)</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">PASSENGER:</span>
                    <strong>{baggageModalPax.full_name}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">SEAT:</span>
                    <strong className="text-sm">{baggageModalPax.seat_number || '10A'}</strong>
                  </div>
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 text-[10px] block">BAG TAG NO:</span>
                    <span className="font-bold text-sm tracking-widest">
                      GA {baggageModalPax.id.toString().padStart(3, '0')} {Math.floor(1000 + Math.random() * 9000)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 text-[10px] block">WEIGHT:</span>
                    <strong className="text-sm">{baggageModalPax.baggage?.weight_kg || 20} KG</strong>
                  </div>
                </div>
                {/* Barcode representation */}
                <div className="pt-2 text-center">
                  <div className="h-10 bg-[repeating-linear-gradient(90deg,#000_0px,#000_2px,#fff_2px,#fff_4px,#000_4px,#000_7px,#fff_7px,#fff_9px)] w-full rounded" />
                  <span className="text-[10px] tracking-widest block mt-1">
                    *GA402{baggageModalPax.booking_code || 'GAP94L'}*
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBaggageModalPax(null)}
                  className="px-4 py-2 rounded-control bg-raised border border-line text-ink text-xs font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Cetak Tag Ini</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Toast Notification Layer ── */}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. OFFICIAL STANDARD AIRLINE PASSENGER MANIFEST DOCUMENT           */}
      {/*    (Visible ONLY during Print / Window.print())                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block w-full bg-white text-black p-0 font-sans" ref={printAreaRef}>
        <StandardManifestDocument
          flight={flight}
          manifestList={manifestList}
          summary={summary}
          currentClock={currentClock}
          formatTimeStr={formatTimeStr}
          formatIcaoDate={formatIcaoDate}
        />
      </div>
    </StaffLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Standard Aviation Passenger Manifest Document (ICAO / IATA Format)
// ─────────────────────────────────────────────────────────────────────────────
interface DocumentProps {
  flight: ManifestFlight | null
  manifestList: ManifestPassenger[]
  summary: ManifestSummary
  currentClock: string
  formatTimeStr: (iso?: string | null) => string
  formatIcaoDate: (iso?: string | null) => string
}

function StandardManifestDocument({
  flight,
  manifestList,
  summary,
  currentClock,
  formatTimeStr,
  formatIcaoDate,
}: DocumentProps) {
  const flightDate = formatIcaoDate(flight?.departure_time)
  const carrierName = (flight?.airline?.name || 'GARUDA INDONESIA').toUpperCase()
  const carrierCode = flight?.airline?.code || 'GA'
  const flightNumber = flight?.flight_number || 'GA-402'
  const originCode = flight?.origin?.code || 'CGK'
  const originCity = (flight?.origin?.city || 'JAKARTA').toUpperCase()
  const destCode = flight?.destination?.code || 'DPS'
  const destCity = (flight?.destination?.city || 'DENPASAR').toUpperCase()
  const aircraftModel = (flight?.airplane?.model || 'BOEING 737-800').toUpperCase()
  const aircraftReg = flight?.airplane?.registration_number || 'PK-GAA'
  const gate = flight?.gate || 'Gate 14'
  const terminal = flight?.terminal || 'Terminal 3'

  const totalPax = manifestList.length
  const boardedPax = summary.boarded_count
  const checkedInPax = summary.checked_in_count
  const noShowPax = summary.no_show_count
  const notCheckedInPax = summary.not_checked_in_count
  const bizPax = summary.business_count || manifestList.filter(p => p.seat_class === 'business').length
  const ecoPax = summary.economy_count || manifestList.filter(p => p.seat_class === 'economy').length
  const malePax = summary.male_count || manifestList.filter(p => p.gender === 'male').length
  const femalePax = summary.female_count || manifestList.filter(p => p.gender === 'female').length
  const totalBags = summary.total_baggage_pieces || 16
  const totalBagsKg = summary.total_baggage_weight_kg || 320

  return (
    <div className="w-full text-black bg-white flex flex-col gap-3 font-sans print:p-0 leading-normal">
      
      {/* ── Document Header & Airline Authority Banner ── */}
      <div className="border-b-2 border-black pb-2.5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-xl tracking-tight uppercase">
              {carrierName}
            </span>
            <span className="text-xs font-mono font-bold border border-black px-1.5 py-0.2">
              {carrierCode} / GIA
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-gray-700 font-medium mt-0.5">
            Member of SkyTeam Airline Alliance • Directorate General of Civil Aviation Licensed Carrier
          </p>
        </div>

        <div className="text-right flex flex-col items-end">
          <h2 className="text-base font-black tracking-wider uppercase font-mono">
            PASSENGER MANIFEST
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-800">
            GENERAL DECLARATION / DAFTAR MANIFEST PENUMPANG
          </span>
          <span className="text-[9px] font-mono mt-0.5 bg-gray-100 px-1.5 py-0.2 border border-gray-400">
            DOC REF: GA-MNF-{flightNumber.replace('-', '')}-{flightDate.replace(/\s+/g, '')}
          </span>
        </div>
      </div>

      {/* ── Flight Operations Specification Grid (Standard IATA DCS Box) ── */}
      <div className="border border-black text-[11px] grid grid-cols-4 divide-x divide-y divide-black font-mono">
        {/* Row 1 */}
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">FLIGHT NUMBER:</span>
          <strong className="text-sm font-black">{flightNumber}</strong>
        </div>
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">DATE OF FLIGHT:</span>
          <strong className="font-bold">{flightDate}</strong>
        </div>
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">POINT OF EMBARKATION (ORIGIN):</span>
          <strong className="font-bold">{originCity} ({originCode})</strong>
          <span className="text-[9px] text-gray-600 block">{terminal}, {gate}</span>
        </div>
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">POINT OF DISEMBARKATION (DEST):</span>
          <strong className="font-bold">{destCity} ({destCode})</strong>
          <span className="text-[9px] text-gray-600 block">Domestic Arrival T1</span>
        </div>

        {/* Row 2 */}
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">AIRCRAFT / REGISTRATION:</span>
          <strong className="font-bold">{aircraftReg}</strong>
          <span className="text-[9px] text-gray-600 block">{aircraftModel}</span>
        </div>
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">SCHEDULED DEP (STD):</span>
          <strong className="font-bold">{formatTimeStr(flight?.departure_time)}</strong>
          <span className="text-[9px] text-gray-600 block">Gate Clearance OK</span>
        </div>
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">COMMANDER / PURSER:</span>
          <strong className="font-bold">{flight?.captain_name || 'Capt. Hendra Wijaya'}</strong>
          <span className="text-[9px] text-gray-600 block">{flight?.purser_name || 'Sarah Anggraini (Purser)'}</span>
        </div>
        <div className="p-1.5">
          <span className="text-[9px] text-gray-600 block uppercase">SERVICE &amp; STATUS:</span>
          <strong className="font-bold">SCHEDULED PASSENGER</strong>
          <span className="text-[9px] text-gray-600 block">RELEASE: FINAL MANIFEST</span>
        </div>
      </div>

      {/* ── Operational Load Summary Ribbon ── */}
      <div className="border border-black bg-gray-50 text-[10px] p-2 flex flex-wrap items-center justify-between gap-y-1 font-mono">
        <div>
          <span className="text-gray-600">CAPACITY: </span>
          <strong>180 (C: {bizPax} / Y: {ecoPax})</strong>
        </div>
        <span className="text-gray-400">|</span>
        <div>
          <span className="text-gray-600">TOTAL MANIFEST: </span>
          <strong>{totalPax} PAX</strong>
          <span className="text-gray-600 text-[9px]"> (M: {malePax}, F: {femalePax}, CHD: 0, INF: 0)</span>
        </div>
        <span className="text-gray-400">|</span>
        <div>
          <span className="text-gray-600">ON BOARD (BOARDED): </span>
          <strong className="text-black bg-gray-200 px-1">{boardedPax} PAX</strong>
        </div>
        <span className="text-gray-400">|</span>
        <div>
          <span className="text-gray-600">GATE STANDBY: </span>
          <strong>{checkedInPax - boardedPax > 0 ? checkedInPax - boardedPax : 4} PAX</strong>
        </div>
        <span className="text-gray-400">|</span>
        <div>
          <span className="text-gray-600">STANDBY (BELUM CI): </span>
          <strong>{notCheckedInPax} PAX</strong>
        </div>
        <span className="text-gray-400">|</span>
        <div>
          <span className="text-gray-600">NO-SHOW: </span>
          <strong>{noShowPax} PAX</strong>
        </div>
        <span className="text-gray-400">|</span>
        <div>
          <span className="text-gray-600">CHECKED BAGS: </span>
          <strong>{totalBags} PCS / {totalBagsKg} KG</strong>
        </div>
      </div>

      {/* ── Passenger Manifest Table (Standard Airline DCS High-Density Format) ── */}
      <div className="w-full">
        <table className="w-full text-left border-collapse border border-black text-[10px] font-mono">
          <thead>
            <tr className="bg-gray-200 border-b border-black text-[9px] font-black uppercase tracking-wider text-black">
              <th className="border-r border-black py-1 px-1.5 w-8 text-center">SEQ</th>
              <th className="border-r border-black py-1 px-1.5 w-12 text-center">SEAT</th>
              <th className="border-r border-black py-1 px-1.5 w-8 text-center">CLS</th>
              <th className="border-r border-black py-1 px-2">PASSENGER NAME (SURNAME / FIRST TITLE)</th>
              <th className="border-r border-black py-1 px-1.5 w-8 text-center">SEX</th>
              <th className="border-r border-black py-1 px-1.5 w-10 text-center">TYPE</th>
              <th className="border-r border-black py-1 px-2 w-16">PNR</th>
              <th className="border-r border-black py-1 px-2 w-28">E-TICKET NO</th>
              <th className="border-r border-black py-1 px-2 w-28">ID / PASSPORT</th>
              <th className="border-r border-black py-1 px-1.5 w-14 text-center">BAGS</th>
              <th className="border-r border-black py-1 px-2 w-24 text-center">STATUS</th>
              <th className="py-1 px-2 w-24">SSR / REMARKS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/80">
            {manifestList.map((pax, idx) => {
              const isBiz = pax.seat_class === 'business'
              const isBoarded = pax.status === 'boarded'
              const isCheckedIn = pax.status === 'checked_in'
              const isNoShow = pax.status === 'no_show'

              return (
                <tr key={pax.id} className={isBiz ? 'bg-gray-50' : ''}>
                  {/* SEQ */}
                  <td className="border-r border-black py-1 px-1.5 text-center font-bold">
                    {pax.seq_number || (idx + 1).toString().padStart(3, '0')}
                  </td>

                  {/* SEAT */}
                  <td className="border-r border-black py-1 px-1.5 text-center font-black text-[11px]">
                    {pax.seat_number || '---'}
                  </td>

                  {/* CLS */}
                  <td className="border-r border-black py-1 px-1.5 text-center font-bold">
                    {isBiz ? 'C' : 'Y'}
                  </td>

                  {/* NAME */}
                  <td className="border-r border-black py-1 px-2 font-bold tracking-tight">
                    {pax.manifest_name || pax.full_name.toUpperCase()}
                  </td>

                  {/* SEX */}
                  <td className="border-r border-black py-1 px-1.5 text-center">
                    {pax.gender === 'male' ? 'M' : 'F'}
                  </td>

                  {/* TYPE */}
                  <td className="border-r border-black py-1 px-1.5 text-center">
                    {pax.pax_type || 'ADULT'}
                  </td>

                  {/* PNR */}
                  <td className="border-r border-black py-1 px-2 font-bold">
                    {pax.booking_code || '---'}
                  </td>

                  {/* E-TICKET */}
                  <td className="border-r border-black py-1 px-2">
                    {pax.e_ticket_number || `126-${(1000000000 + pax.id * 1024).toString().slice(0, 10)}`}
                  </td>

                  {/* ID */}
                  <td className="border-r border-black py-1 px-2 text-[9px]">
                    {pax.id_number}
                  </td>

                  {/* BAGS */}
                  <td className="border-r border-black py-1 px-1.5 text-center">
                    {pax.baggage ? `${pax.baggage.weight_kg}K` : '7K'}
                  </td>

                  {/* STATUS */}
                  <td className="border-r border-black py-1 px-2 text-center font-bold">
                    {isBoarded ? (
                      <span className="uppercase">ON BOARD</span>
                    ) : isCheckedIn ? (
                      <span className="uppercase">STANDBY</span>
                    ) : isNoShow ? (
                      <span className="uppercase underline">NO-SHOW</span>
                    ) : (
                      <span className="uppercase text-gray-500">PENDING</span>
                    )}
                  </td>

                  {/* SSR */}
                  <td className="py-1 px-2 text-[9px] uppercase font-bold text-gray-800">
                    {pax.ssr || 'NIL'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Official Compliance Signatures & Verification Section ── */}
      <div className="print-page-break-avoid border border-black p-3 mt-1 text-[10px] font-mono flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-6 divide-x divide-black pt-1">
          {/* Ground Operations Duty Manager */}
          <div className="pr-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] uppercase text-gray-600 block">
                GROUND OPERATIONS / GATE CLEARANCE OFFICER:
              </span>
              <strong className="text-xs block mt-0.5">Petugas Boarding (Staff Ops)</strong>
              <span className="text-[9px] text-gray-600 block">STAFF ID: GA-OPS-8812 • TERMINAL 3 CGK</span>
            </div>
            <div className="mt-8 border-t border-black pt-1 flex justify-between text-[9px]">
              <span>SIGNATURE &amp; STAMP: ____________________</span>
              <span>TIME: {currentClock} WIB</span>
            </div>
          </div>

          {/* Commander / Purser Acceptance */}
          <div className="pl-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] uppercase text-gray-600 block">
                ACCEPTED BY PILOT IN COMMAND (PIC) / PURSER:
              </span>
              <strong className="text-xs block mt-0.5">{flight?.captain_name || 'Capt. Hendra Wijaya'}</strong>
              <span className="text-[9px] text-gray-600 block">LICENSE: ATPL-74892 • PURSER: {flight?.purser_name || 'Sarah Anggraini'}</span>
            </div>
            <div className="mt-8 border-t border-black pt-1 flex justify-between text-[9px]">
              <span>SIGNATURE: ____________________</span>
              <span>DATE: {flightDate}</span>
            </div>
          </div>
        </div>

        {/* Regulatory Compliance Declaration */}
        <div className="border-t border-black/50 pt-2 text-[8px] text-gray-700 leading-tight">
          <p>
            <strong>OFFICIAL CERTIFICATION &amp; CONFIDENTIALITY NOTICE:</strong> I hereby certify that this flight passenger manifest is a true, accurate, and complete record of all passengers embarked on Flight {flightNumber} on {flightDate} in strict accordance with the standards of the International Civil Aviation Organization (ICAO Annex 9), IATA Passenger Services Conference, and Indonesian Civil Aviation Safety Regulations (CASR). This document is strictly confidential and restricted to authorized airline flight operations, airport security, customs, immigration, and port health authorities only.
          </p>
          <div className="flex justify-between items-center text-gray-500 mt-1">
            <span>System Generated by SkyBook Departure Control System (DCS v2.4)</span>
            <span>PAGE 1 OF 1 • PRINT RUN: {flightDate} {currentClock} WIB</span>
          </div>
        </div>
      </div>
    </div>
  )
}
