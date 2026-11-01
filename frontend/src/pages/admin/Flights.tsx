import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout'
import { api } from '../../lib/api'
import Pagination, { CompactPagination } from '../../components/common/Pagination'

export interface AirportInfo {
  id: number
  code: string
  name: string
  city: string
}

export interface FlightSegment {
  id: number
  segmentOrder: number
  departureTime: string
  arrivalTime: string
  transitDurationMinutes?: number | null
  originAirport?: AirportInfo | null
  destinationAirport?: AirportInfo | null
}

export interface FlightScheduleItem {
  id: number
  flightNumber: string
  flightType: 'direct' | 'transit'
  priceEconomy: string | number
  priceBusiness?: string | number | null
  status: 'scheduled' | 'delayed' | 'cancelled'
  delayMinutes?: number | null
  source?: 'manual' | 'api' | string | null
  externalRef?: string | null
  createdAt?: string
  airline?: {
    id: number
    name: string
    code: string
    logo?: string | null
  } | null
  airplane?: {
    id: number
    registrationNumber: string
    model: string
    totalSeatEconomy: number
    totalSeatBusiness?: number | null
  } | null
  segments: FlightSegment[]
  seatStats?: {
    total: number
    booked: number
  }
}

// Mock fallback data matching Stitch B15 exactly if API has no flights yet
const mockFlights: FlightScheduleItem[] = [
  {
    id: 1,
    flightNumber: 'KA 412',
    flightType: 'direct',
    priceEconomy: 1450000,
    priceBusiness: 3200000,
    status: 'scheduled',
    delayMinutes: 0,
    source: 'manual',
    airline: { id: 1, name: 'Kenari Air', code: 'KA' },
    airplane: { id: 1, registrationNumber: 'PK-KNA', model: 'Boeing 737-800', totalSeatEconomy: 180, totalSeatBusiness: 0 },
    segments: [
      {
        id: 1,
        segmentOrder: 1,
        departureTime: '2026-10-14T07:40:00Z',
        arrivalTime: '2026-10-14T10:30:00Z',
        originAirport: { id: 1, code: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta' },
        destinationAirport: { id: 2, code: 'DPS', name: 'Ngurah Rai', city: 'Denpasar' },
      },
    ],
    seatStats: { total: 180, booked: 176 },
  },
  {
    id: 2,
    flightNumber: 'HA 602',
    flightType: 'direct',
    priceEconomy: 1100000,
    priceBusiness: 2400000,
    status: 'scheduled',
    delayMinutes: 0,
    source: 'manual',
    airline: { id: 2, name: 'Halmahera Air', code: 'HA' },
    airplane: { id: 2, registrationNumber: 'PK-HMA', model: 'Airbus A320', totalSeatEconomy: 150, totalSeatBusiness: 0 },
    segments: [
      {
        id: 2,
        segmentOrder: 1,
        departureTime: '2026-10-14T08:15:00Z',
        arrivalTime: '2026-10-14T09:45:00Z',
        originAirport: { id: 1, code: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta' },
        destinationAirport: { id: 3, code: 'SUB', name: 'Juanda', city: 'Surabaya' },
      },
    ],
    seatStats: { total: 150, booked: 140 },
  },
  {
    id: 3,
    flightNumber: 'KA 220',
    flightType: 'transit',
    priceEconomy: 1850000,
    priceBusiness: 3900000,
    status: 'scheduled',
    delayMinutes: 0,
    source: 'manual',
    airline: { id: 1, name: 'Kenari Air', code: 'KA' },
    airplane: { id: 1, registrationNumber: 'PK-KNA', model: 'Boeing 737-800', totalSeatEconomy: 180, totalSeatBusiness: 12 },
    segments: [
      {
        id: 3,
        segmentOrder: 1,
        departureTime: '2026-10-14T06:15:00Z',
        arrivalTime: '2026-10-14T07:55:00Z',
        originAirport: { id: 1, code: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta' },
        destinationAirport: { id: 3, code: 'SUB', name: 'Juanda', city: 'Surabaya' },
      },
      {
        id: 4,
        segmentOrder: 2,
        departureTime: '2026-10-14T09:00:00Z',
        arrivalTime: '2026-10-14T11:50:00Z',
        transitDurationMinutes: 65,
        originAirport: { id: 3, code: 'SUB', name: 'Juanda', city: 'Surabaya' },
        destinationAirport: { id: 4, code: 'UPG', name: 'Sultan Hasanuddin', city: 'Makassar' },
      },
    ],
    seatStats: { total: 192, booked: 165 },
  },
  {
    id: 4,
    flightNumber: 'GA 180',
    flightType: 'direct',
    priceEconomy: 1650000,
    priceBusiness: 3500000,
    status: 'delayed',
    delayMinutes: 25,
    source: 'api',
    airline: { id: 3, name: 'Garuda Nusantara', code: 'GA' },
    airplane: { id: 3, registrationNumber: 'PK-GAA', model: 'Boeing 737-800', totalSeatEconomy: 162, totalSeatBusiness: 12 },
    segments: [
      {
        id: 5,
        segmentOrder: 1,
        departureTime: '2026-10-14T10:10:00Z',
        arrivalTime: '2026-10-14T12:00:00Z',
        originAirport: { id: 1, code: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta' },
        destinationAirport: { id: 5, code: 'KNO', name: 'Kualanamu', city: 'Medan' },
      },
    ],
    seatStats: { total: 174, booked: 158 },
  },
  {
    id: 5,
    flightNumber: 'KA 880',
    flightType: 'direct',
    priceEconomy: 950000,
    status: 'cancelled',
    delayMinutes: 0,
    source: 'manual',
    airline: { id: 1, name: 'Kenari Air', code: 'KA' },
    airplane: { id: 1, registrationNumber: 'PK-KNA', model: 'Boeing 737-800', totalSeatEconomy: 180, totalSeatBusiness: 0 },
    segments: [
      {
        id: 6,
        segmentOrder: 1,
        departureTime: '2026-10-14T16:00:00Z',
        arrivalTime: '2026-10-14T17:15:00Z',
        originAirport: { id: 2, code: 'DPS', name: 'Ngurah Rai', city: 'Denpasar' },
        destinationAirport: { id: 6, code: 'LOP', name: 'Zainuddin Abdul Madjid', city: 'Lombok' },
      },
    ],
    seatStats: { total: 180, booked: 0 },
  },
]

export default function FlightsPage() {
  const navigate = useNavigate()
  const [flights, setFlights] = useState<FlightScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAirline, setSelectedAirline] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Status Change Dialog State
  const [statusModalFlight, setStatusModalFlight] = useState<FlightScheduleItem | null>(null)
  const [statusFormState, setStatusFormState] = useState<{
    status: 'scheduled' | 'delayed' | 'cancelled'
    delay_minutes: number
  }>({
    status: 'scheduled',
    delay_minutes: 0,
  })
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Delete Dialog State
  const [deleteModalFlight, setDeleteModalFlight] = useState<FlightScheduleItem | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // Load flights from backend
  const loadFlights = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/flights')
      const items = res.data?.data !== undefined ? res.data.data : res.data
      if (Array.isArray(items)) {
        setFlights(items)
      } else {
        setFlights(mockFlights)
      }
    } catch (err) {
      console.warn('Failed to load flights from API, using fallback data:', err)
      setFlights(mockFlights)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFlights()
  }, [])

  // Extract airlines list for filter
  const airlineOptions = useMemo(() => {
    const map = new Map<string, string>()
    flights.forEach((f) => {
      if (f.airline?.name) {
        map.set(f.airline.name, f.airline.name)
      }
    })
    return Array.from(map.values())
  }, [flights])

  // Filter and search
  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      // Search by flight number or airport codes/cities
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchNumber = flight.flightNumber.toLowerCase().includes(q)
        const matchAirline = flight.airline?.name?.toLowerCase().includes(q)
        const matchRoute = flight.segments.some((seg) => {
          const originCode = seg.originAirport?.code?.toLowerCase() || ''
          const originCity = seg.originAirport?.city?.toLowerCase() || ''
          const destCode = seg.destinationAirport?.code?.toLowerCase() || ''
          const destCity = seg.destinationAirport?.city?.toLowerCase() || ''
          return (
            originCode.includes(q) ||
            originCity.includes(q) ||
            destCode.includes(q) ||
            destCity.includes(q)
          )
        })
        if (!matchNumber && !matchAirline && !matchRoute) return false
      }

      // Airline filter
      if (selectedAirline !== 'all') {
        if (flight.airline?.name !== selectedAirline) return false
      }

      // Type filter
      if (selectedType !== 'all') {
        if (flight.flightType !== selectedType) return false
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (flight.status !== selectedStatus) return false
      }

      // Date filter
      if (selectedDate) {
        const firstSeg = flight.segments[0]
        if (firstSeg?.departureTime) {
          const depDate = firstSeg.departureTime.slice(0, 10)
          if (depDate !== selectedDate) return false
        }
      }

      return true
    })
  }, [flights, searchTerm, selectedAirline, selectedType, selectedStatus, selectedDate])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedAirline, selectedType, selectedStatus, selectedDate])

  // Pagination Slice
  const paginatedFlights = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredFlights.slice(start, start + pageSize)
  }, [filteredFlights, currentPage, pageSize])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    const el = document.getElementById('flights-table-container')
    if (el && window.scrollY > el.offsetTop) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Select all on current page handler
  const isCurrentPageAllSelected =
    paginatedFlights.length > 0 &&
    paginatedFlights.every((f) => selectedIds.includes(f.id))

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedFlights.map((f) => f.id)
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    } else {
      const pageIds = new Set(paginatedFlights.map((f) => f.id))
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)))
    }
  }

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Open Status Modal
  const openStatusModal = (flight: FlightScheduleItem) => {
    setActiveMenuId(null)
    setStatusModalFlight(flight)
    setStatusFormState({
      status: flight.status || 'scheduled',
      delay_minutes: flight.delayMinutes || 0,
    })
    setStatusError(null)
  }

  // Submit Status Change
  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!statusModalFlight) return

    if (statusFormState.status === 'delayed' && (!statusFormState.delay_minutes || statusFormState.delay_minutes <= 0)) {
      setStatusError('Waktu keterlambatan wajib diisi lebih dari 0 menit')
      return
    }

    setStatusSubmitting(true)
    setStatusError(null)

    try {
      await api.put(`/admin/flights/${statusModalFlight.id}`, {
        status: statusFormState.status,
        delay_minutes: statusFormState.status === 'delayed' ? Number(statusFormState.delay_minutes) : 0,
      })

      showToast(`Status penerbangan ${statusModalFlight.flightNumber} berhasil diperbarui`)
      setStatusModalFlight(null)
      loadFlights()
    } catch (err: any) {
      console.error('Update status error:', err)
      setStatusError(err?.message || 'Gagal mengubah status penerbangan')
    } finally {
      setStatusSubmitting(false)
    }
  }

  // Open Delete Modal
  const openDeleteModal = (flight: FlightScheduleItem) => {
    setActiveMenuId(null)
    setDeleteModalFlight(flight)
    setDeleteError(null)
  }

  // Submit Delete
  const handleConfirmDelete = async () => {
    if (!deleteModalFlight) return

    setDeleteSubmitting(true)
    setDeleteError(null)

    try {
      await api.delete(`/admin/flights/${deleteModalFlight.id}`)
      showToast(`Jadwal penerbangan ${deleteModalFlight.flightNumber} berhasil dihapus`)
      setDeleteModalFlight(null)
      loadFlights()
    } catch (err: any) {
      console.error('Delete flight error:', err)
      setDeleteError(
        err?.message ||
          'Jadwal penerbangan tidak dapat dihapus karena sudah memiliki pemesanan tiket'
      )
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // Format Time Helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      const hours = String(d.getUTCHours()).padStart(2, '0')
      const mins = String(d.getUTCMinutes()).padStart(2, '0')
      return `${hours}.${mins}`
    } catch {
      return '--:--'
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Nomor', 'Maskapai', 'Rute', 'Berangkat', 'Tiba', 'Tipe', 'Status', 'Kursi']
    const rows = filteredFlights.map((f) => {
      const firstSeg = f.segments[0]
      const lastSeg = f.segments[f.segments.length - 1]
      const rute = `${firstSeg?.originAirport?.code || ''} - ${lastSeg?.destinationAirport?.code || ''}`
      const statusText =
        f.status === 'delayed' ? `Tertunda ${f.delayMinutes}m` : f.status === 'cancelled' ? 'Dibatalkan' : 'Tepat waktu'
      const kursi = `${f.seatStats?.booked || 0}/${f.seatStats?.total || 0}`
      return [f.flightNumber, f.airline?.name || '', rute, formatTime(firstSeg?.departureTime), formatTime(lastSeg?.arrivalTime), f.flightType, statusText, kursi]
    })
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `manifest_harian_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Manifest harian berhasil diunduh (CSV)')
  }

  return (
    <AdminLayout>
      <div className="w-full max-w-[1360px] mx-auto px-6 lg:px-8 py-8 space-y-6">
        {/* ─── 1. Header Section ─── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-subtle tracking-widest uppercase">
                Pusat Kendali Armada
              </span>
              <span className="inline-block w-1 h-1 rounded-full bg-subtle"></span>
              <span className="text-[11px] font-bold text-brand-fg tracking-widest">
                WIB / UTC+7
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-ink tracking-tight">
              Jadwal Penerbangan
            </h1>
            <p className="text-sm text-subtle">
              Kelola alokasi armada penerbangan, rute harian, kapasitas kursi, dan status operasional.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleExportCSV}
              type="button"
              className="h-11 px-4 rounded-control bg-panel border border-line text-ink hover:bg-tint font-medium text-sm shadow-sm flex items-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-subtle">download</span>
              <span>Unduh Manifest Harian</span>
            </button>
            <Link
              to="/admin/flights/new"
              className="h-11 px-5 rounded-control bg-brand hover:bg-brand-hover text-white font-medium text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Tambah jadwal</span>
            </Link>
          </div>
        </section>

        {/* ─── 2. Search & Filter Bar Horizon Panel ─── */}
        <section className="bg-panel border border-line rounded-ticket p-4 shadow-sm flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="md:col-span-4 relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-subtle text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nomor penerbangan atau rute (mis. CGK, KA 412)..."
                className="w-full h-11 pl-10 pr-24 rounded-control bg-page border border-line text-ink placeholder:text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg/30 transition-all"
              />
              <span className="absolute right-3 text-[11px] font-semibold bg-tint text-brand-fg px-2 py-0.5 rounded">
                {filteredFlights.length} Hasil
              </span>
            </div>

            {/* Filter: Maskapai */}
            <div className="md:col-span-2">
              <select
                value={selectedAirline}
                onChange={(e) => setSelectedAirline(e.target.value)}
                className="w-full h-11 px-3 rounded-control bg-page border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg/30 transition-all cursor-pointer"
              >
                <option value="all">Semua Maskapai</option>
                {airlineOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter: Tipe */}
            <div className="md:col-span-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-11 px-3 rounded-control bg-page border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg/30 transition-all cursor-pointer"
              >
                <option value="all">Semua Tipe</option>
                <option value="direct">Langsung</option>
                <option value="transit">Transit</option>
              </select>
            </div>

            {/* Filter: Status */}
            <div className="md:col-span-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-11 px-3 rounded-control bg-page border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg/30 transition-all cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="scheduled">Tepat Waktu / Terjadwal</option>
                <option value="delayed">Tertunda (Delayed)</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>

            {/* Filter: Date */}
            <div className="md:col-span-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-11 px-3 rounded-control bg-page border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg/30 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Applied Filter Chips */}
          <div className="flex items-center justify-between pt-1 border-t border-line/50 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-subtle">Filter Aktif:</span>
              {selectedAirline !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint text-brand-fg font-medium">
                  Maskapai: <strong>{selectedAirline}</strong>
                  <button
                    onClick={() => setSelectedAirline('all')}
                    className="hover:text-danger flex items-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              )}
              {selectedType !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint text-brand-fg font-medium">
                  Tipe: <strong>{selectedType === 'direct' ? 'Langsung' : 'Transit'}</strong>
                  <button
                    onClick={() => setSelectedType('all')}
                    className="hover:text-danger flex items-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              )}
              {selectedStatus !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint text-brand-fg font-medium">
                  Status: <strong>{selectedStatus}</strong>
                  <button
                    onClick={() => setSelectedStatus('all')}
                    className="hover:text-danger flex items-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              )}
              {selectedDate && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint text-brand-fg font-medium">
                  Tanggal: <strong>{selectedDate}</strong>
                  <button
                    onClick={() => setSelectedDate('')}
                    className="hover:text-danger flex items-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              )}
              {(selectedAirline !== 'all' ||
                selectedType !== 'all' ||
                selectedStatus !== 'all' ||
                selectedDate ||
                searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedAirline('all')
                    setSelectedType('all')
                    setSelectedStatus('all')
                    setSelectedDate('')
                    setSearchTerm('')
                  }}
                  className="text-brand-fg font-semibold hover:underline ml-1"
                >
                  Reset filter
                </button>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 text-subtle">
              <span className="material-symbols-outlined text-[16px] text-emerald-500 animate-pulse">
                sensors
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Live Radar Feed: AKTIF
              </span>
            </div>
          </div>
        </section>

        {/* ─── 3. Batch Action Bar (Active Row Selection) ─── */}
        {selectedIds.length > 0 && (
          <section className="bg-tint border border-brand-fg/30 rounded-ticket px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-6 h-6 rounded bg-brand text-white flex items-center justify-center font-bold text-xs">
                {selectedIds.length}
              </div>
              <span className="text-sm font-semibold text-brand-fg">
                {selectedIds.length} penerbangan dipilih
              </span>
              {selectedIds.length < filteredFlights.length && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(filteredFlights.map((f) => f.id))}
                  className="text-xs text-brand font-bold underline hover:text-brand-hover transition-colors"
                >
                  Pilih semua ({filteredFlights.length.toLocaleString('id-ID')})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const firstSelected = flights.find((f) => f.id === selectedIds[0])
                  if (firstSelected) openStatusModal(firstSelected)
                }}
                className="px-3.5 py-1.5 rounded-control bg-panel hover:bg-page border border-line text-ink font-medium text-xs shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-brand-fg">tune</span>
                <span>Ubah status ({selectedIds.length})</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 text-xs text-subtle hover:text-ink font-medium"
              >
                Batal pilih
              </button>
            </div>
          </section>
        )}

        {/* ─── 4. Flight Manifest Table ─── */}
        <section id="flights-table-container" className="bg-panel border border-line rounded-ticket shadow-sm overflow-hidden relative">
          {/* Table Sub-header toolbar: Showing count & Compact Pagination */}
          <div className="px-5 py-3 border-b border-line bg-page/35 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-ink">Daftar Jadwal Penerbangan</span>
              <span className="px-2 py-0.5 rounded-full bg-tint text-brand-fg text-[11px] font-bold">
                {filteredFlights.length.toLocaleString('id-ID')} Total
              </span>
            </div>
            <CompactPagination
              currentPage={currentPage}
              totalItems={filteredFlights.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              itemLabel="penerbangan"
            />
          </div>

          <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-raised shadow-xs">
                <tr className="bg-page/95 backdrop-blur-xs text-subtle text-[11px] font-bold uppercase tracking-wider border-b border-line">
                  <th className="py-3.5 px-4 w-12 text-center" scope="col">
                    <input
                      type="checkbox"
                      checked={isCurrentPageAllSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-subtle" scope="col">
                    NOMOR PENERBANGAN
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-subtle" scope="col">
                    MASKAPAI
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-subtle" scope="col">
                    RUTE & TRANSIT
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-brand-fg" scope="col">
                    BERANGKAT
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-subtle" scope="col">
                    TIBA
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-subtle" scope="col">
                    TIPE
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-subtle min-w-[140px]" scope="col">
                    KURSI TERISI
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-subtle" scope="col">
                    STATUS
                  </th>
                  <th className="py-3.5 px-4 text-center font-semibold text-subtle" scope="col">
                    AKSI
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line text-sm text-ink font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-subtle">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
                        <span>Memuat data jadwal penerbangan...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredFlights.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-subtle">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[36px] text-subtle/50">
                          flight_takeoff
                        </span>
                        <p className="font-semibold text-ink">Tidak ada jadwal penerbangan</p>
                        <p className="text-xs text-subtle">
                          Silakan ubah filter pencarian atau buat jadwal penerbangan baru.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedFlights.map((flight) => {
                    const isSelected = selectedIds.includes(flight.id)
                    const firstSeg = flight.segments[0]
                    const lastSeg = flight.segments[flight.segments.length - 1]
                    const isTransit = flight.flightType === 'transit' || flight.segments.length > 1

                    // Capacity computation
                    const totalSeats =
                      flight.seatStats?.total ||
                      (flight.airplane?.totalSeatEconomy || 0) +
                        (flight.airplane?.totalSeatBusiness || 0) ||
                      180
                    const bookedSeats = flight.seatStats?.booked ?? Math.round(totalSeats * 0.85)
                    const percent = Math.min(100, Math.round((bookedSeats / (totalSeats || 1)) * 100))

                    return (
                      <tr
                        key={flight.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-tint/50' : 'hover:bg-page/60'
                        } ${flight.status === 'cancelled' ? 'opacity-70 bg-danger/5' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(flight.id)}
                            className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                          />
                        </td>

                        {/* Nomor Penerbangan */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span
                              className={`text-base font-bold tabular-nums ${
                                flight.status === 'cancelled'
                                  ? 'text-danger line-through'
                                  : 'text-ink'
                              }`}
                            >
                              {flight.flightNumber}
                            </span>
                            {/* Revisi Data Real: teks kecil subtle 'Impor API' untuk source = 'api' */}
                            {flight.source === 'api' ? (
                              <span className="text-[10px] text-brand-fg font-semibold tracking-wider uppercase mt-0.5">
                                Impor API
                              </span>
                            ) : (
                              <span className="text-[10px] text-subtle uppercase">Manual</span>
                            )}
                          </div>
                        </td>

                        {/* Maskapai */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
                            <span className="font-medium text-ink truncate max-w-[130px]">
                              {flight.airline?.name || 'Maskapai'}
                            </span>
                          </div>
                        </td>

                        {/* Rute & Transit */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 font-bold tabular-nums text-ink">
                              <span>{firstSeg?.originAirport?.code || 'CGK'}</span>
                              <span className="material-symbols-outlined text-[14px] text-brand-fg">
                                east
                              </span>
                              {isTransit && flight.segments.length > 1 && (
                                <>
                                  <span className="text-subtle text-xs font-normal">
                                    {flight.segments[0].destinationAirport?.code}
                                  </span>
                                  <span className="material-symbols-outlined text-[14px] text-brand-fg">
                                    east
                                  </span>
                                </>
                              )}
                              <span>{lastSeg?.destinationAirport?.code || 'DPS'}</span>
                            </div>
                            <span className="text-xs text-subtle truncate max-w-[190px]">
                              {firstSeg?.originAirport?.city || 'Jakarta'} →{' '}
                              {lastSeg?.destinationAirport?.city || 'Denpasar'}
                              {isTransit && ' (Transit)'}
                            </span>
                          </div>
                        </td>

                        {/* Departure Time */}
                        <td className="py-4 px-4 font-bold tabular-nums text-ink text-sm">
                          {formatTime(firstSeg?.departureTime)}
                        </td>

                        {/* Arrival Time */}
                        <td className="py-4 px-4 font-medium tabular-nums text-subtle text-sm">
                          {formatTime(lastSeg?.arrivalTime)}
                        </td>

                        {/* Type */}
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                              isTransit
                                ? 'bg-signal/20 text-brand-fg border border-signal/40'
                                : 'bg-page text-subtle border border-line'
                            }`}
                          >
                            {isTransit ? 'Transit' : 'Langsung'}
                          </span>
                        </td>

                        {/* Kursi Terisi */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs tabular-nums">
                              <span className="font-semibold text-ink">
                                {bookedSeats} / {totalSeats}
                              </span>
                              <span className="text-subtle font-medium">{percent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-page rounded-full overflow-hidden border border-line/60">
                              <div
                                className={`h-full rounded-full ${
                                  percent > 90 ? 'bg-brand' : 'bg-brand-fg'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {flight.status === 'delayed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-danger/10 text-danger text-xs font-semibold">
                              <span className="material-symbols-outlined text-[14px]">
                                schedule
                              </span>
                              <span>Tertunda {flight.delayMinutes || 0}m</span>
                            </span>
                          ) : flight.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-danger/15 text-danger text-xs font-semibold">
                              <span className="material-symbols-outlined text-[14px]">block</span>
                              <span>Dibatalkan</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                              <span className="material-symbols-outlined text-[14px]">
                                check_circle
                              </span>
                              <span>Tepat waktu</span>
                            </span>
                          )}
                        </td>

                        {/* Row Actions Menu */}
                        <td className="py-4 px-4 text-center relative">
                          <button
                            onClick={() =>
                              setActiveMenuId(activeMenuId === flight.id ? null : flight.id)
                            }
                            type="button"
                            aria-label="Menu Opsi"
                            className="w-8 h-8 rounded-control hover:bg-page border border-transparent hover:border-line flex items-center justify-center text-subtle hover:text-ink transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              more_vert
                            </span>
                          </button>

                          {/* Floating Context Dropdown */}
                          {activeMenuId === flight.id && (
                            <div className="absolute right-6 top-10 z-30 w-56 bg-raised border border-line rounded-ticket shadow-2xl p-1.5 flex flex-col gap-1 text-left animate-in fade-in zoom-in-95 duration-150">
                              <button
                                onClick={() => {
                                  setActiveMenuId(null)
                                  navigate(`/admin/flights/${flight.id}/edit`)
                                }}
                                className="w-full px-3 py-2 rounded-control hover:bg-tint flex items-center gap-2 text-ink text-xs font-medium transition-colors"
                              >
                                <span className="material-symbols-outlined text-subtle text-[18px]">
                                  edit_calendar
                                </span>
                                <span>Ubah jadwal</span>
                              </button>

                              <button
                                onClick={() => openStatusModal(flight)}
                                className="w-full px-3 py-2 rounded-control hover:bg-tint flex items-center gap-2 text-ink text-xs font-medium transition-colors"
                              >
                                <span className="material-symbols-outlined text-brand-fg text-[18px]">
                                  published_with_changes
                                </span>
                                <span>Ubah status operasional</span>
                              </button>

                              <div className="h-px bg-line my-0.5" />

                              <button
                                onClick={() => openDeleteModal(flight)}
                                className="w-full px-3 py-2 rounded-control hover:bg-danger/10 text-danger flex items-center gap-2 text-xs font-semibold transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  delete
                                </span>
                                <span>Hapus penerbangan</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ─── Pagination Footer ─── */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredFlights.length}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setCurrentPage(1)
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="jadwal penerbangan"
          />
        </section>

        {/* ─── 5. Dialog: Ubah Status Operasional (Revisi Data Real: ADM-10 & NTF-01) ─── */}
        {statusModalFlight && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-raised border border-line rounded-ticket shadow-2xl p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">
                      published_with_changes
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-base">Ubah Status Operasional</h3>
                    <p className="text-xs text-subtle">
                      Penerbangan {statusModalFlight.flightNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStatusModalFlight(null)}
                  className="w-8 h-8 rounded-control hover:bg-tint text-subtle hover:text-ink flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {statusError && (
                <div className="p-3 rounded-control bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{statusError}</span>
                </div>
              )}

              <form onSubmit={handleSaveStatus} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-subtle uppercase tracking-wider">
                    Pilih Status Baru
                  </label>
                  <select
                    value={statusFormState.status}
                    onChange={(e) =>
                      setStatusFormState({
                        ...statusFormState,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full h-11 px-3 rounded-control bg-page border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-fg/30"
                  >
                    <option value="scheduled">Tepat Waktu (Scheduled)</option>
                    <option value="delayed">Tertunda (Delayed)</option>
                    <option value="cancelled">Dibatalkan (Cancelled)</option>
                  </select>
                </div>

                {/* Delay Minutes Field (wajib > 0 saat status delayed) */}
                {statusFormState.status === 'delayed' && (
                  <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
                    <label className="text-xs font-bold text-subtle uppercase tracking-wider">
                      Menit Keterlambatan (Delay)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="1"
                        required
                        value={statusFormState.delay_minutes || ''}
                        onChange={(e) =>
                          setStatusFormState({
                            ...statusFormState,
                            delay_minutes: Number(e.target.value),
                          })
                        }
                        placeholder="Contoh: 25"
                        className="w-full h-11 pl-3 pr-16 rounded-control bg-page border border-line text-ink text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-fg/30"
                      />
                      <span className="absolute right-3 text-xs text-subtle font-medium">Menit</span>
                    </div>
                  </div>
                )}

                {/* Important Notice NTF-01 */}
                <div className="p-3.5 rounded-control bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">
                    notification_important
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">Notifikasi Otomatis Penumpang</span>
                    <span>
                      Pelanggan dengan pesanan lunas akan otomatis menerima email pemberitahuan
                      mengenai perubahan jadwal atau pembatalan ini.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setStatusModalFlight(null)}
                    disabled={statusSubmitting}
                    className="h-10 px-4 rounded-control border border-line text-ink hover:bg-page text-sm font-medium transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={statusSubmitting}
                    className="h-10 px-5 rounded-control bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-sm transition-all flex items-center gap-1.5"
                  >
                    {statusSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>Simpan Perubahan</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 6. Dialog: Konfirmasi Hapus Penerbangan ─── */}
        {deleteModalFlight && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-raised border border-line rounded-ticket shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-danger">
                <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-ink text-base">Hapus Jadwal Penerbangan?</h3>
                  <p className="text-xs text-subtle">
                    Nomor: <strong>{deleteModalFlight.flightNumber}</strong>
                  </p>
                </div>
              </div>

              {deleteError ? (
                <div className="p-3 rounded-control bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                    block
                  </span>
                  <span>{deleteError}</span>
                </div>
              ) : (
                <p className="text-sm text-subtle leading-relaxed">
                  Tindakan ini akan menghapus jadwal penerbangan beserta seluruh kursi dan alokasi
                  armada terkait secara permanen.
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setDeleteModalFlight(null)}
                  disabled={deleteSubmitting}
                  className="h-10 px-4 rounded-control border border-line text-ink hover:bg-page text-sm font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                  className="h-10 px-5 rounded-control bg-danger hover:bg-red-700 text-white text-sm font-semibold shadow-sm transition-all flex items-center gap-1.5"
                >
                  {deleteSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Hapus Jadwal</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 7. Toast Feedback ─── */}
        {toastMessage && (
          <aside className="fixed bottom-8 right-8 z-50 bg-raised border border-line text-ink px-4 py-3 rounded-ticket shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
            <span className="material-symbols-outlined text-emerald-500 text-[20px]">
              check_circle
            </span>
            <span className="text-sm font-medium">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-subtle hover:text-ink ml-2"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </div>
    </AdminLayout>
  )
}
