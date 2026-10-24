import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

export interface FlightSegment {
  id: number
  segment_order: number
  origin: { id: number; code: string; name: string; city: string } | null
  destination: { id: number; code: string; name: string; city: string } | null
  departure_time: string
  arrival_time: string
  transit_duration_minutes?: number | null
}

export interface FlightResultItem {
  id: number
  flight_number: string
  airline: { id: number; name: string; code: string; logo?: string | null } | null
  airplane: { id: number; model: string; registration_number: string } | null
  flight_type: 'direct' | 'transit'
  status: 'scheduled' | 'delayed' | 'cancelled'
  delay_minutes: number
  status_synced_at?: string | null
  segments: FlightSegment[]
  price_economy: number
  price_business: number | null
  available_seats_economy: number
  available_seats_business: number
  total_duration_minutes: number
  layover_warning: 'short' | 'long' | null
  value_score: number
}

interface CalendarDay {
  date: string
  lowest_price: number | null
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Query parameters from URL
  const origin = searchParams.get('origin') || 'CGK'
  const destination = searchParams.get('destination') || 'DPS'
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const passengers = Math.max(1, Number(searchParams.get('passengers') || 1))
  const cabinClass = (searchParams.get('class') || 'economy') as 'economy' | 'business'
  const sort = searchParams.get('sort') || 'price'

  // Data fetching state
  const [flights, setFlights] = useState<FlightResultItem[]>([])
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Expandable row states
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null)
  const [activeTabByRow, setActiveTabByRow] = useState<{ [id: number]: 'flight' | 'baggage' | 'refund' }>({})

  // Inline search edit open state
  const [isEditSearchOpen, setIsEditSearchOpen] = useState(false)
  const [editOrigin, setEditOrigin] = useState(origin)
  const [editDestination, setEditDestination] = useState(destination)
  const [editDate, setEditDate] = useState(date)
  const [editPassengers, setEditPassengers] = useState(passengers)
  const [editClass, setEditClass] = useState(cabinClass)

  // Client-side filters
  const [filterTypes, setFilterTypes] = useState<string[]>([]) // ['direct', 'transit']
  const [filterAirlines, setFilterAirlines] = useState<string[]>([])
  const [maxPrice, setMaxPrice] = useState<number>(20000000)
  const [timeWindows, setTimeWindows] = useState<string[]>([]) // 'pagi', 'siang', 'sore', 'malam'
  const [filterBaggageIncluded, setFilterBaggageIncluded] = useState(false)


  // Sort dropdown open state
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Load Flights Search Data
  useEffect(() => {
    const fetchSearchResults = async () => {
      setLoading(true)
      setErrorMsg(null)
      try {
        const queryParams = new URLSearchParams({
          origin,
          destination,
          date,
          passengers: String(passengers),
          class: cabinClass,
          sort,
        })

        const [flightsRes, calRes] = await Promise.all([
          api.get<{ data: FlightResultItem[] }>(`/flights/search?${queryParams.toString()}`),
          api.get<{ data: CalendarDay[] }>(
            `/flights/price-calendar?origin=${origin}&destination=${destination}&date=${date}&passengers=${passengers}&class=${cabinClass}&days=7`
          ).catch(() => ({ data: [] })),
        ])

        const rawFlights = (flightsRes?.data as any)?.data || flightsRes?.data
        const results = Array.isArray(rawFlights) ? rawFlights : []
        setFlights(results)

        const rawCal = (calRes?.data as any)?.data || calRes?.data
        if (Array.isArray(rawCal) && rawCal.length > 0) {
          setCalendarDays(rawCal)
        } else {
          // Generate 7-day fallback dates around current date (tanpa harga, tampil "-")
          const anchor = new Date(date)
          const fallbackDays: CalendarDay[] = []
          for (let i = -3; i <= 3; i++) {
            const d = new Date(anchor)
            d.setDate(anchor.getDate() + i)
            fallbackDays.push({
              date: d.toISOString().slice(0, 10),
              lowest_price: null,
            })
          }
          setCalendarDays(fallbackDays)
        }

        // Set max price limit dynamically from results
        if (results.length > 0) {
          const prices = results.map((r) =>
            cabinClass === 'business' && r.price_business ? r.price_business : r.price_economy
          )
          const highest = Math.max(...prices, 4000000)
          setMaxPrice(Math.ceil(highest / 500000) * 500000 + 500000)
        }
      } catch (err: any) {
        console.error('Failed to fetch search results:', err)
        setErrorMsg(err?.message || 'Terjadi gangguan saat mencari penerbangan. Silakan coba lagi.')
      } finally {
        setLoading(false)
      }
    }

    fetchSearchResults()
  }, [origin, destination, date, passengers, cabinClass, sort])

  // Close sort dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Unique airlines from search results
  const availableAirlines = useMemo(() => {
    const map = new Map<string, { name: string; minPrice: number }>()
    flights.forEach((f) => {
      if (f.airline?.name) {
        const p = cabinClass === 'business' && f.price_business ? f.price_business : f.price_economy
        const existing = map.get(f.airline.name)
        if (!existing || p < existing.minPrice) {
          map.set(f.airline.name, { name: f.airline.name, minPrice: p })
        }
      }
    })
    return Array.from(map.values())
  }, [flights, cabinClass])

  // Max price ceiling for the range slider
  const maxSliderPrice = useMemo(() => {
    if (flights.length === 0) return 20000000
    const prices = flights.map((f) =>
      cabinClass === 'business' && f.price_business ? f.price_business : f.price_economy
    )
    const highest = Math.max(...prices, 4000000)
    return Math.ceil(highest / 500000) * 500000 + 500000
  }, [flights, cabinClass])

  // Count by flight type
  const typeCounts = useMemo(() => {
    let direct = 0
    let transit = 0
    flights.forEach((f) => {
      if (f.flight_type === 'direct') direct++
      else transit++
    })
    return { direct, transit }
  }, [flights])

  // Filtered flights (Client-side filters: Type, Airlines, Price, Time Windows)
  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      // 1. Flight Type Filter
      if (filterTypes.length > 0) {
        if (!filterTypes.includes(f.flight_type)) return false
      }

      // 2. Airline Filter
      if (filterAirlines.length > 0) {
        if (!f.airline?.name || !filterAirlines.includes(f.airline.name)) return false
      }

      // 3. Price Filter
      const price = cabinClass === 'business' && f.price_business ? f.price_business : f.price_economy
      if (price > maxPrice) return false

      // 4. Departure Time Window Filter
      if (timeWindows.length > 0 && f.segments[0]) {
        const depDate = new Date(f.segments[0].departure_time)
        const hour = depDate.getHours()
        const matchesWindow = timeWindows.some((w) => {
          if (w === 'pagi') return hour >= 0 && hour < 11
          if (w === 'siang') return hour >= 11 && hour < 15
          if (w === 'sore') return hour >= 15 && hour < 18.5
          if (w === 'malam') return hour >= 18.5 && hour < 24
          return false
        })
        if (!matchesWindow) return false
      }

      return true
    })
  }, [flights, filterTypes, filterAirlines, maxPrice, timeWindows, cabinClass])

  // Sort change handler
  const handleSortChange = (newSort: string) => {
    setIsSortDropdownOpen(false)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('sort', newSort)
    setSearchParams(nextParams)
  }

  // Date selection in 7-day strip
  const handleDateSelect = (selectedDay: string) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('date', selectedDay)
    setSearchParams(nextParams)
  }

  // Submit inline search update
  const handleApplySearchEdit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsEditSearchOpen(false)
    const nextParams = new URLSearchParams({
      origin: editOrigin.trim().toUpperCase(),
      destination: editDestination.trim().toUpperCase(),
      date: editDate,
      passengers: String(editPassengers),
      class: editClass,
      sort,
    })
    setSearchParams(nextParams)
  }

  // Handle select flight CTA
  const handleChooseFlight = (flightId: number) => {
    if (!user) {
      navigate(
        `/login?redirect=${encodeURIComponent(
          `/flights/${flightId}?passengers=${passengers}&class=${cabinClass}`
        )}`
      )
    } else {
      navigate(`/flights/${flightId}?passengers=${passengers}&class=${cabinClass}`)
    }
  }

  // Format Helper: Day Abbreviation
  const formatDayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
    } catch {
      return dateStr
    }
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}.${m}`
    } catch {
      return '--:--'
    }
  }

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0 && m > 0) return `${h}j ${m}m`
    if (h > 0) return `${h} jam`
    return `${m} menit`
  }

  const formatRupiah = (val?: number | null) => {
    if (!val) return 'Rp 0'
    return `Rp ${val.toLocaleString('id-ID')}`
  }

  // Reset all client filters
  const handleResetFilters = () => {
    setFilterTypes([])
    setFilterAirlines([])
    setMaxPrice(maxSliderPrice)
    setTimeWindows([])
    setFilterBaggageIncluded(false)
  }

  const isAnyFilterActive =
    filterTypes.length > 0 ||
    filterAirlines.length > 0 ||
    timeWindows.length > 0 ||
    filterBaggageIncluded ||
    maxPrice < maxSliderPrice

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between antialiased">
      <Navbar />

      <main className="w-full pt-[72px] flex-1 pb-16">
        {/* ─── 1. Top Horizon Search Summary Bar ─── */}
        <section className="bg-raised border-b border-line shadow-xs">
          <div className="max-w-content mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg md:text-xl text-ink font-sans tracking-tight">
                  {origin}
                </span>
                <span className="material-symbols-outlined text-brand-fg text-[18px]">east</span>
                <span className="font-bold text-lg md:text-xl text-ink font-sans tracking-tight">
                  {destination}
                </span>
              </div>
              <span className="text-line hidden sm:inline">•</span>
              <span className="text-sm font-medium text-subtle">
                {formatDayName(date)}
              </span>
              <span className="text-line hidden sm:inline">•</span>
              <span className="text-sm text-subtle font-medium">
                {passengers} Penumpang
              </span>
              <span className="text-line hidden sm:inline">•</span>
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-tint text-brand-fg">
                {cabinClass === 'business' ? 'Bisnis' : 'Ekonomi'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditSearchOpen(!isEditSearchOpen)}
                className="h-10 px-4 rounded-control border border-line bg-panel hover:bg-tint text-ink text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px] text-brand-fg">
                  edit_calendar
                </span>
                <span>{isEditSearchOpen ? 'Tutup form' : 'Ubah pencarian'}</span>
              </button>
            </div>
          </div>

          {/* Inline Search Panel Drawer */}
          {isEditSearchOpen && (
            <div className="border-t border-line bg-page/70 p-4 md:p-6 animate-in slide-in-from-top-2 duration-150">
              <form
                onSubmit={handleApplySearchEdit}
                className="max-w-content mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
              >
                <div>
                  <label className="text-xs font-bold text-subtle uppercase">Dari (IATA)</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={editOrigin}
                    onChange={(e) => setEditOrigin(e.target.value.toUpperCase())}
                    placeholder="CGK"
                    className="w-full h-11 px-3 mt-1 bg-raised border border-line rounded-control text-ink font-bold text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-fg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-subtle uppercase">Ke (IATA)</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={editDestination}
                    onChange={(e) => setEditDestination(e.target.value.toUpperCase())}
                    placeholder="DPS"
                    className="w-full h-11 px-3 mt-1 bg-raised border border-line rounded-control text-ink font-bold text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-fg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-subtle uppercase">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full h-11 px-3 mt-1 bg-raised border border-line rounded-control text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-fg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-subtle uppercase">Penumpang & Kelas</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <select
                      value={editPassengers}
                      onChange={(e) => setEditPassengers(Number(e.target.value))}
                      className="h-11 px-2 bg-raised border border-line rounded-control text-ink text-xs font-semibold focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <option key={n} value={n}>
                          {n} org
                        </option>
                      ))}
                    </select>
                    <select
                      value={editClass}
                      onChange={(e) => setEditClass(e.target.value as any)}
                      className="h-11 px-2 bg-raised border border-line rounded-control text-ink text-xs font-semibold focus:outline-none"
                    >
                      <option value="economy">Ekonomi</option>
                      <option value="business">Bisnis</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="h-11 px-6 bg-brand hover:bg-brand-hover text-white rounded-control text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  <span>Cari Tiket</span>
                </button>
              </form>
            </div>
          )}
        </section>

        {/* ─── 2. 7-Day Price Calendar Date Strip (CAL-01 & Stitch B4) ─── */}
        <section className="bg-raised border-b border-line">
          <div className="max-w-content mx-auto px-4 md:px-6">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1 md:gap-2 py-2 overflow-x-auto">
              {calendarDays.map((cd) => {
                const isSelected = cd.date === date
                const hasFlight = cd.lowest_price !== null && cd.lowest_price > 0

                return (
                  <button
                    key={cd.date}
                    type="button"
                    disabled={!hasFlight}
                    onClick={() => handleDateSelect(cd.date)}
                    className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-control text-center transition-all ${
                      isSelected
                        ? 'bg-tint text-ink'
                        : hasFlight
                        ? 'hover:bg-page text-ink cursor-pointer'
                        : 'opacity-40 cursor-not-allowed text-subtle'
                    }`}
                  >
                    {/* Active Underline Indicator */}
                    {isSelected && (
                      <div className="absolute bottom-0 left-3 right-3 h-[3px] bg-brand-fg rounded-t-full" />
                    )}
                    <span
                      className={`text-xs ${
                        isSelected ? 'font-bold text-brand-fg' : 'text-subtle font-medium'
                      }`}
                    >
                      {formatDayName(cd.date)}
                    </span>
                    <span className="text-xs font-bold tabular-nums mt-0.5">
                      {hasFlight ? formatRupiah(cd.lowest_price) : '-'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── 3. Main Search Canvas: Sidebar Filter (280px) + Results List ─── */}
        <div className="max-w-content mx-auto px-4 md:px-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ════ LEFT COLUMN: Filter Sidebar (280px visual scale) ════ */}
            <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 bg-raised border border-line rounded-ticket p-5 shadow-xs space-y-5">
              {/* Filter Header */}
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="font-bold text-ink text-base">Filter</span>
                {isAnyFilterActive && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs text-brand-fg hover:underline font-semibold"
                  >
                    Reset filter
                  </button>
                )}
              </div>

              {/* 1. Tipe Penerbangan */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider block">
                  Tipe penerbangan
                </span>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={filterTypes.includes('direct')}
                        onChange={(e) => {
                          setFilterTypes(
                            e.target.checked
                              ? [...filterTypes, 'direct']
                              : filterTypes.filter((t) => t !== 'direct')
                          )
                        }}
                        className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                      />
                      <span className="text-ink group-hover:text-brand-fg transition-colors">
                        Langsung
                      </span>
                    </div>
                    <span className="text-xs text-subtle font-medium">({typeCounts.direct})</span>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={filterTypes.includes('transit')}
                        onChange={(e) => {
                          setFilterTypes(
                            e.target.checked
                              ? [...filterTypes, 'transit']
                              : filterTypes.filter((t) => t !== 'transit')
                          )
                        }}
                        className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                      />
                      <span className="text-ink group-hover:text-brand-fg transition-colors">
                        Transit
                      </span>
                    </div>
                    <span className="text-xs text-subtle font-medium">({typeCounts.transit})</span>
                  </label>
                </div>
              </div>

              <div className="h-px bg-line" />

              {/* 2. Rentang Harga dengan Histogram (Stitch B4) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                    Rentang harga
                  </span>
                  <span className="text-xs font-bold text-brand-fg tabular-nums">
                    Maks {formatRupiah(maxPrice)}
                  </span>
                </div>

                {/* 12-bar price distribution histogram visualizer */}
                <div className="pt-2">
                  <div className="h-9 w-full flex items-end gap-1 px-1">
                    {[20, 35, 75, 100, 85, 60, 90, 40, 50, 30, 15, 10].map((height, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-xs transition-all ${
                          i < (maxPrice / maxSliderPrice) * 12 ? 'bg-brand' : 'bg-line'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    min="500000"
                    max={maxSliderPrice}
                    step="100000"
                    value={Math.min(maxPrice, maxSliderPrice)}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-brand mt-2"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-subtle tabular-nums font-medium">
                  <span>Rp 500.000</span>
                  <span>{formatRupiah(maxSliderPrice)}</span>
                </div>
              </div>

              <div className="h-px bg-line" />

              {/* 3. Maskapai */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider block">
                  Maskapai
                </span>
                <div className="space-y-2 text-sm">
                  {availableAirlines.map((airline) => (
                    <label
                      key={airline.name}
                      className="flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filterAirlines.includes(airline.name)}
                          onChange={(e) => {
                            setFilterAirlines(
                              e.target.checked
                                ? [...filterAirlines, airline.name]
                                : filterAirlines.filter((a) => a !== airline.name)
                            )
                          }}
                          className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                        />
                        <span className="text-ink group-hover:text-brand-fg transition-colors">
                          {airline.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-subtle tabular-nums">
                        {formatRupiah(airline.minPrice)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-line" />

              {/* 4. Waktu Berangkat */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider block">
                  Waktu berangkat
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'pagi', label: 'Pagi', hours: '00.00 - 11.00' },
                    { id: 'siang', label: 'Siang', hours: '11.00 - 15.00' },
                    { id: 'sore', label: 'Sore', hours: '15.00 - 18.30' },
                    { id: 'malam', label: 'Malam', hours: '18.30 - 24.00' },
                  ].map((tw) => {
                    const isSelected = timeWindows.includes(tw.id)
                    return (
                      <button
                        key={tw.id}
                        type="button"
                        onClick={() => {
                          setTimeWindows(
                            isSelected
                              ? timeWindows.filter((w) => w !== tw.id)
                              : [...timeWindows, tw.id]
                          )
                        }}
                        className={`p-2.5 rounded-control text-left border transition-all ${
                          isSelected
                            ? 'bg-tint border-brand-fg text-ink font-semibold'
                            : 'bg-page border-line text-ink hover:bg-tint/50'
                        }`}
                      >
                        <span className="block font-bold">{tw.label}</span>
                        <span className="block text-[10px] text-subtle mt-0.5">{tw.hours}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="h-px bg-line" />

              {/* 5. Fasilitas */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider block">
                  Fasilitas
                </span>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterBaggageIncluded}
                      onChange={(e) => setFilterBaggageIncluded(e.target.checked)}
                      className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                    />
                    <span className="text-ink">Termasuk bagasi kabin 7kg</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                    />
                    <span className="text-ink">Pilihan kursi mandiri</span>
                  </label>
                </div>
              </div>
            </aside>

            {/* ════ RIGHT COLUMN: Results List & Toolbar ════ */}
            <section className="lg:col-span-8 xl:col-span-9 space-y-4">
              {/* Toolbar: Count, Chips, and Sort Dropdown */}
              <div className="bg-raised border border-line rounded-ticket p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink text-sm sm:text-base mr-1">
                    {filteredFlights.length} penerbangan ditemukan
                  </span>

                  {/* Active filter chips */}
                  {filterTypes.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tint text-brand-fg text-xs font-semibold"
                    >
                      <span>{t === 'direct' ? 'Langsung' : 'Transit'}</span>
                      <button
                        onClick={() => setFilterTypes(filterTypes.filter((item) => item !== t))}
                        className="hover:text-danger leading-none text-xs"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {filterAirlines.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tint text-brand-fg text-xs font-semibold"
                    >
                      <span>{a}</span>
                      <button
                        onClick={() => setFilterAirlines(filterAirlines.filter((item) => item !== a))}
                        className="hover:text-danger leading-none text-xs"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {/* Sort Selector */}
                <div ref={sortRef} className="relative self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                    className="h-10 px-3.5 rounded-control bg-panel border border-line text-ink text-xs font-medium hover:bg-tint transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <span>
                      Urutkan:{' '}
                      <strong className="text-ink font-bold">
                        {sort === 'duration' ? 'Tercepat' : sort === 'value' ? 'Terbaik' : 'Termurah'}
                      </strong>
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-subtle">
                      keyboard_arrow_down
                    </span>
                  </button>

                  {isSortDropdownOpen && (
                    <div className="absolute right-0 top-11 z-30 w-44 bg-raised border border-line rounded-control shadow-xl p-1 flex flex-col gap-0.5 animate-in fade-in duration-100">
                      {[
                        { id: 'price', label: 'Termurah' },
                        { id: 'duration', label: 'Tercepat' },
                        { id: 'value', label: 'Terbaik (Value Score)' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSortChange(item.id)}
                          className={`w-full text-left px-3 py-2 rounded-control text-xs font-medium transition-colors ${
                            sort === item.id
                              ? 'bg-tint text-brand-fg font-bold'
                              : 'text-ink hover:bg-page'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Result Rows List ─── */}
              {loading ? (
                // Skeletons
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div
                      key={s}
                      className="w-full bg-raised border border-line rounded-ticket p-6 shadow-xs animate-pulse flex flex-col md:flex-row items-center justify-between gap-4"
                    >
                      <div className="w-40 h-10 bg-line/60 rounded" />
                      <div className="w-56 h-10 bg-line/60 rounded" />
                      <div className="w-32 h-10 bg-line/60 rounded" />
                    </div>
                  ))}
                </div>
              ) : errorMsg ? (
                // Error State
                <div className="w-full bg-raised border border-line rounded-ticket p-12 text-center shadow-xs flex flex-col items-center justify-center gap-3">
                  <span className="material-symbols-outlined text-danger text-[40px]">
                    error_outline
                  </span>
                  <h3 className="font-bold text-ink text-lg">Pencarian Tidak Dapat Dimuat</h3>
                  <p className="text-sm text-subtle max-w-md">{errorMsg}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-2 h-10 px-5 rounded-control bg-brand text-white font-semibold text-xs shadow-sm hover:bg-brand-hover"
                  >
                    Muat Ulang
                  </button>
                </div>
              ) : filteredFlights.length === 0 ? (
                // Empty State
                <div className="w-full bg-raised border border-line rounded-ticket p-12 text-center shadow-xs flex flex-col items-center justify-center gap-3">
                  <span className="material-symbols-outlined text-subtle/50 text-[48px]">
                    flight_takeoff
                  </span>
                  <h3 className="font-bold text-ink text-lg">
                    Tidak ada penerbangan di tanggal ini
                  </h3>
                  <p className="text-sm text-subtle max-w-md">
                    Coba pilih tanggal lain pada bilah tanggal 7-hari di atas, atau atur ulang filter
                    pencarian Anda.
                  </p>
                  {isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-2 h-10 px-5 rounded-control border border-line bg-panel text-ink hover:bg-tint text-xs font-semibold"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              ) : (
                // Flight List Rows
                <div className="space-y-3">
                  {filteredFlights.map((flight) => {
                    const isExpanded = expandedRowId === flight.id
                    const currentTab = activeTabByRow[flight.id] || 'flight'
                    const firstSeg = flight.segments[0]
                    const lastSeg = flight.segments[flight.segments.length - 1]
                    const isTransit = flight.flight_type === 'transit' || flight.segments.length > 1
                    const seatRemain =
                      cabinClass === 'business'
                        ? flight.available_seats_business
                        : flight.available_seats_economy

                    const finalPrice =
                      cabinClass === 'business' && flight.price_business
                        ? flight.price_business
                        : flight.price_economy

                    return (
                      <div
                        key={flight.id}
                        className={`w-full bg-raised border rounded-ticket overflow-hidden transition-all duration-150 ${
                          isExpanded
                            ? 'border-brand-fg ring-2 ring-brand-fg/20 shadow-md'
                            : 'border-line hover:border-brand-fg/50 hover:bg-tint/30 shadow-xs'
                        }`}
                      >
                        {/* Primary Row Content */}
                        <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Left: Airline & Flight Code */}
                          <div className="w-full md:w-48 shrink-0 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-control bg-tint text-brand-fg font-bold flex items-center justify-center text-sm shrink-0">
                              {flight.airline?.code || 'SB'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-ink text-sm">
                                {flight.airline?.name || 'SkyBook Air'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-bold bg-page border border-line px-1.5 py-0.5 rounded text-subtle">
                                  {flight.flight_number}
                                </span>
                                {seatRemain <= 5 && seatRemain > 0 && (
                                  <span className="text-[10px] font-bold text-danger">
                                    Sisa {seatRemain} kursi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Center: RouteLine & Duration Timeline */}
                          <div className="flex-1 flex items-center justify-center gap-4 px-2">
                            {/* Departure */}
                            <div className="text-right">
                              <div className="font-bold text-base md:text-lg tabular-nums text-ink">
                                {formatTime(firstSeg?.departure_time)}
                              </div>
                              <div className="text-xs font-semibold text-subtle">
                                {firstSeg?.origin?.code || origin}
                              </div>
                              {/* Revisi data real: Keterlambatan */}
                              {flight.delay_minutes > 0 && (
                                <div className="text-[10px] text-danger font-semibold flex items-center gap-0.5 justify-end mt-0.5">
                                  <span className="material-symbols-outlined text-[12px]">
                                    schedule
                                  </span>
                                  <span>Tertunda {flight.delay_minutes}m</span>
                                </div>
                              )}
                            </div>

                            {/* Middle Route Line */}
                            <div className="flex-1 max-w-[200px] flex flex-col items-center">
                              <span className="text-[11px] font-medium text-subtle mb-1">
                                {formatDuration(flight.total_duration_minutes)}
                              </span>
                              <div className="w-full relative flex items-center justify-center">
                                <div className="w-full h-[2px] bg-brand-fg/40" />
                                <span className="material-symbols-outlined absolute text-[16px] text-brand-fg bg-raised px-1">
                                  flight
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    isTransit
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                      : 'bg-tint text-brand-fg'
                                  }`}
                                >
                                  {isTransit
                                    ? `1 transit di ${flight.segments[0].destination?.code || 'SUB'}`
                                    : 'Langsung'}
                                </span>
                                {/* Revisi data real: layover warning */}
                                {flight.layover_warning === 'short' && (
                                  <span className="text-[9px] font-bold text-danger flex items-center">
                                    • Transit singkat
                                  </span>
                                )}
                                {flight.layover_warning === 'long' && (
                                  <span className="text-[9px] font-medium text-subtle flex items-center">
                                    • Transit lama
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Arrival */}
                            <div className="text-left">
                              <div className="font-bold text-base md:text-lg tabular-nums text-ink">
                                {formatTime(lastSeg?.arrival_time)}
                              </div>
                              <div className="text-xs font-semibold text-subtle">
                                {lastSeg?.destination?.code || destination}
                              </div>
                            </div>
                          </div>

                          {/* Right: Price & CTA */}
                          <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line">
                            <div className="text-left md:text-right">
                              <div className="text-base md:text-lg font-bold text-ink tabular-nums">
                                {formatRupiah(finalPrice)}
                              </div>
                              <div className="text-[11px] text-subtle">per orang</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleChooseFlight(flight.id)}
                              className="h-11 px-6 rounded-control bg-brand hover:bg-brand-hover text-white font-semibold text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center"
                            >
                              Pilih
                            </button>
                          </div>
                        </div>

                        {/* Inline Expand Button */}
                        <div className="bg-page/40 border-t border-line/60 px-4 md:px-6 py-2 flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => setExpandedRowId(isExpanded ? null : flight.id)}
                            className="text-brand-fg hover:underline font-semibold flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Sembunyikan rincian' : 'Rincian penerbangan'}</span>
                            <span
                              className={`material-symbols-outlined text-[16px] transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            >
                              expand_more
                            </span>
                          </button>
                          <span className="text-subtle text-[11px]">
                            {flight.airplane?.model || 'Pesawat Jet Modern'}
                          </span>
                        </div>

                        {/* Expanded Tray with Tabs */}
                        {isExpanded && (
                          <div className="bg-page border-t border-line px-4 md:px-6 py-4 animate-in slide-in-from-top-1 duration-150">
                            {/* Tray Tabs */}
                            <div className="flex items-center gap-6 border-b border-line pb-2 mb-4 text-xs font-semibold">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveTabByRow({ ...activeTabByRow, [flight.id]: 'flight' })
                                }
                                className={`pb-1 border-b-2 transition-colors ${
                                  currentTab === 'flight'
                                    ? 'border-brand-fg text-brand-fg font-bold'
                                    : 'border-transparent text-subtle hover:text-ink'
                                }`}
                              >
                                Penerbangan
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveTabByRow({ ...activeTabByRow, [flight.id]: 'baggage' })
                                }
                                className={`pb-1 border-b-2 transition-colors ${
                                  currentTab === 'baggage'
                                    ? 'border-brand-fg text-brand-fg font-bold'
                                    : 'border-transparent text-subtle hover:text-ink'
                                }`}
                              >
                                Bagasi
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveTabByRow({ ...activeTabByRow, [flight.id]: 'refund' })
                                }
                                className={`pb-1 border-b-2 transition-colors ${
                                  currentTab === 'refund'
                                    ? 'border-brand-fg text-brand-fg font-bold'
                                    : 'border-transparent text-subtle hover:text-ink'
                                }`}
                              >
                                Refund & Reschedule
                              </button>
                            </div>

                            {/* Tab 1: Penerbangan Segments */}
                            {currentTab === 'flight' && (
                              <div className="space-y-4">
                                {flight.segments.map((seg) => (
                                  <div key={seg.id} className="flex items-start gap-3">
                                    <div className="flex flex-col items-center mt-1">
                                      <div className="w-2.5 h-2.5 rounded-full bg-brand-fg" />
                                      <div className="w-0.5 h-12 bg-line my-1" />
                                      <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                                    </div>
                                    <div className="flex-1 space-y-1 text-xs">
                                      <div>
                                        <span className="font-bold tabular-nums text-ink">
                                          {formatTime(seg.departure_time)}
                                        </span>{' '}
                                        •{' '}
                                        <span className="font-semibold text-ink">
                                          {seg.origin?.name} ({seg.origin?.code})
                                        </span>
                                        <span className="text-subtle block">
                                          {seg.origin?.city}, Indonesia
                                        </span>
                                      </div>

                                      <div className="bg-raised p-2 rounded-control text-subtle flex items-center justify-between text-[11px]">
                                        <span>
                                          {flight.airline?.name} ({flight.flight_number}) •{' '}
                                          {flight.airplane?.model}
                                        </span>
                                        <span className="font-semibold text-ink">
                                          {formatDuration(
                                            Math.round(
                                              (new Date(seg.arrival_time).getTime() -
                                                new Date(seg.departure_time).getTime()) /
                                                (1000 * 60)
                                            )
                                          )}
                                        </span>
                                      </div>

                                      <div>
                                        <span className="font-bold tabular-nums text-ink">
                                          {formatTime(seg.arrival_time)}
                                        </span>{' '}
                                        •{' '}
                                        <span className="font-semibold text-ink">
                                          {seg.destination?.name} ({seg.destination?.code})
                                        </span>
                                        <span className="text-subtle block">
                                          {seg.destination?.city}, Indonesia
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Tab 2: Bagasi */}
                            {currentTab === 'baggage' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="bg-raised p-3 rounded-control border border-line flex items-start gap-2.5">
                                  <span className="material-symbols-outlined text-[20px] text-brand-fg shrink-0">
                                    luggage
                                  </span>
                                  <div>
                                    <span className="font-bold text-ink block">Bagasi Kabin</span>
                                    <span className="text-subtle">
                                      Gratis 7 kg per penumpang. Dimensi maksimal 56 x 36 x 23 cm.
                                    </span>
                                  </div>
                                </div>
                                <div className="bg-raised p-3 rounded-control border border-line flex items-start gap-2.5">
                                  <span className="material-symbols-outlined text-[20px] text-brand-fg shrink-0">
                                    add_shopping_cart
                                  </span>
                                  <div>
                                    <span className="font-bold text-ink block">Bagasi Tercatat</span>
                                    <span className="text-subtle">
                                      Pilihan bagasi tambahan 5kg s.d. 40kg tersedia saat mengisi
                                      data pemesanan.
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Tab 3: Refund & Reschedule */}
                            {currentTab === 'refund' && (
                              <div className="bg-raised p-3 rounded-control border border-line text-xs space-y-1.5">
                                <span className="font-bold text-ink block">Kebijakan Pembatalan</span>
                                <p className="text-subtle">
                                  Pengajuan refund dapat dilakukan langsung dari halaman pesanan
                                  paling lambat 6 jam sebelum waktu keberangkatan.
                                </p>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold block text-[11px]">
                                  • Jika penerbangan dibatalkan maskapai, Anda berhak menerima
                                  pengembalian dana 100%.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
