import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  AirportItem,
  POPULAR_AIRPORTS,
  searchAirports,
  getAirportByCode,
} from '../../lib/airports'

export type TripType = 'oneway' | 'roundtrip' | 'group'

interface RecentSearch {
  origin: string
  originCity: string
  destination: string
  destinationCity: string
  date: string
  returnDate?: string
  tripType: TripType
  passengers: number
  cabinClass: string
}

export default function SearchPanel() {
  const navigate = useNavigate()
  const todayStr = new Date().toISOString().slice(0, 10)
  const defaultReturnDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // Trip Mode
  const [tripType, setTripType] = useState<TripType>('oneway')

  // Form states
  const [origin, setOrigin] = useState<AirportItem>(
    getAirportByCode('CGK') || POPULAR_AIRPORTS[0]
  )
  const [destination, setDestination] = useState<AirportItem>(
    getAirportByCode('DPS') || POPULAR_AIRPORTS[1]
  )
  const [departureDate, setDepartureDate] = useState(todayStr)
  const [returnDate, setReturnDate] = useState(defaultReturnDate)
  const [passengers, setPassengers] = useState(1)
  const [cabinClass, setCabinClass] = useState<'economy' | 'business'>('economy')

  // Dropdown & Search state
  const [activeDropdown, setActiveDropdown] = useState<'origin' | 'destination' | 'passengers' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [apiAirports, setApiAirports] = useState<AirportItem[]>([])
  const [isSearchingApi, setIsSearchingApi] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])

  const panelRef = useRef<HTMLDivElement>(null)

  // Live search from API to supplement local comprehensive list
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setApiAirports([])
      setIsSearchingApi(false)
      return
    }

    setIsSearchingApi(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: any[] }>(`/airports?q=${encodeURIComponent(q)}`)
        const items = (res.data?.data || []).map((a: any) => ({
          code: a.code,
          city: a.city,
          primaryCity: a.city,
          name: a.name,
          country: a.country || 'Indonesia',
          aliases: [a.code.toLowerCase(), a.city.toLowerCase()],
        }))
        setApiAirports(items)
      } catch (err) {
        console.error('Failed to search airports:', err)
      } finally {
        setIsSearchingApi(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('skybook_recent_searches')
      if (saved) {
        setRecentSearches(JSON.parse(saved))
      }
    } catch {
      // ignore
    }
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Smart city-first search results (merges local dictionary + API)
  const displayedAirports = searchAirports(searchQuery, apiAirports)

  const [isSwapping, setIsSwapping] = useState(false)

  const handleSwap = () => {
    setIsSwapping(true)
    setTimeout(() => setIsSwapping(false), 300)
    const temp = origin
    setOrigin(destination)
    setDestination(temp)
    setErrorMsg('')
  }

  // Handle trip type switch
  const handleSelectTripType = (type: TripType) => {
    setTripType(type)
    if (type === 'group' && passengers < 3) {
      setPassengers(4) // default group squad
    }
    setErrorMsg('')
  }

  // Calculate Group Discount Tier
  const groupDiscount =
    passengers >= 5 ? 15 : passengers >= 3 ? 10 : passengers >= 2 ? 5 : 0

  const handleSearch = () => {
    if (origin.code === destination.code) {
      setErrorMsg('Kota asal dan kota tujuan tidak boleh sama.')
      return
    }

    if (tripType === 'roundtrip' && returnDate < departureDate) {
      setErrorMsg('Tanggal pulang tidak boleh lebih awal dari tanggal berangkat.')
      return
    }

    setErrorMsg('')

    // Save recent search
    const newEntry: RecentSearch = {
      origin: origin.code,
      originCity: origin.primaryCity,
      destination: destination.code,
      destinationCity: destination.primaryCity,
      date: departureDate,
      returnDate: tripType === 'roundtrip' ? returnDate : undefined,
      tripType,
      passengers,
      cabinClass,
    }

    const updated = [
      newEntry,
      ...recentSearches.filter(
        (s) => !(s.origin === newEntry.origin && s.destination === newEntry.destination)
      ),
    ].slice(0, 5)

    try {
      localStorage.setItem('skybook_recent_searches', JSON.stringify(updated))
      setRecentSearches(updated)
    } catch {
      // ignore
    }

    const params = new URLSearchParams({
      origin: origin.code,
      destination: destination.code,
      date: departureDate,
      passengers: String(passengers),
      class: cabinClass,
    })

    if (tripType === 'roundtrip') {
      params.set('trip', 'roundtrip')
      params.set('returnDate', returnDate)
    }

    if (tripType === 'group' || passengers >= 2) {
      params.set('group', 'true')
    }

    navigate(`/search?${params.toString()}`)
  }

  const selectRecent = (r: RecentSearch) => {
    const orig = getAirportByCode(r.origin) || {
      code: r.origin,
      city: r.originCity,
      primaryCity: r.originCity,
      name: '',
      country: 'Indonesia',
      aliases: [],
    }
    const dest = getAirportByCode(r.destination) || {
      code: r.destination,
      city: r.destinationCity,
      primaryCity: r.destinationCity,
      name: '',
      country: 'Indonesia',
      aliases: [],
    }
    setOrigin(orig)
    setDestination(dest)
    const validDepDate = r.date < todayStr ? todayStr : r.date
    setDepartureDate(validDepDate)
    if (r.returnDate) {
      const validRetDate = r.returnDate < validDepDate ? validDepDate : r.returnDate
      setReturnDate(validRetDate)
    }
    setTripType(r.tripType || 'oneway')
    setPassengers(r.passengers)
    setCabinClass(r.cabinClass as any)
  }

  return (
    <div ref={panelRef} className="w-full">
      {/* Boarding Pass Style Search Panel */}
      <div className="relative w-full bg-raised rounded-ticket border border-line shadow-[0_16px_32px_-8px_rgba(11,37,69,0.08)] dark:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.5)] p-4 md:p-6 z-20">
        {/* Ticket Notches */}
        <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-page border-r border-line" />
        <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-page border-l border-line" />

        {/* ─── Top Trip Type Switcher & Promo Badges ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-line/60">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleSelectTripType('oneway')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tripType === 'oneway'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel hover:bg-tint text-subtle hover:text-ink'
              }`}
            >
              Sekali Jalan
            </button>

            <button
              type="button"
              onClick={() => handleSelectTripType('roundtrip')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                tripType === 'roundtrip'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel hover:bg-tint text-subtle hover:text-ink'
              }`}
            >
              <span>Pulang-Pergi (PP)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  tripType === 'roundtrip'
                    ? 'bg-emerald-400 text-[#0B2545]'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                Hemat 10%
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTripType('group')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                tripType === 'group'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel hover:bg-tint text-subtle hover:text-ink'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">group</span>
              <span>Berangkat Bareng</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  tripType === 'group'
                    ? 'bg-amber-400 text-[#0B2545]'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                }`}
              >
                Diskon s/d 15%
              </span>
            </button>
          </div>

          {/* Dynamic Promo Banner */}
          {(tripType === 'group' || passengers >= 2) && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[14px]">local_activity</span>
              <span>
                {passengers >= 5
                  ? `Super Group Diskon 15% Aktif (${passengers} Penumpang)`
                  : passengers >= 3
                  ? `Squad Promo Diskon 10% Aktif (${passengers} Penumpang)`
                  : `Promo Duo Diskon 5% Aktif (${passengers} Penumpang)`}
              </span>
            </div>
          )}
        </div>

        {/* ─── Search Fields Grid ─── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
          {/* Field 1: Dari (Origin City-First) */}
          <div className="md:col-span-3 relative">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveDropdown(activeDropdown === 'origin' ? null : 'origin')
              }}
              className={`w-full flex flex-col text-left px-3.5 py-2.5 rounded-control transition-all border ${
                activeDropdown === 'origin'
                  ? 'border-brand-fg bg-panel shadow-sm ring-2 ring-brand-fg/20'
                  : 'bg-page/70 hover:bg-page border-transparent'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider text-subtle font-bold">
                Dari (Kota Asal)
              </span>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <span className="text-base sm:text-lg font-bold text-ink truncate">
                  {origin.primaryCity || origin.city}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-tint text-brand-fg font-mono text-[11px] font-bold shrink-0">
                  {origin.code}
                </span>
              </div>
              <span className="text-[11px] text-subtle truncate mt-0.5">{origin.name}</span>
            </button>

            {/* Origin Autocomplete Popover */}
            {activeDropdown === 'origin' && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[320px] bg-white dark:bg-[#112038] rounded-xl border border-line shadow-2xl p-2.5 z-[100] ring-1 ring-black/10 dark:ring-white/10 opacity-100 animate-fadeIn">
                <div className="p-1 mb-1.5 relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-subtle">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama kota (cth: Bali, Jogja, Surabaya)..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-xs bg-panel border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-brand-fg/30 font-medium"
                  />
                </div>
                <div className="text-[10px] uppercase font-bold text-subtle px-2 py-1 border-b border-line flex items-center justify-between">
                  <span>{searchQuery.trim().length >= 1 ? 'Hasil Pencarian Kota' : 'Kota & Bandara Populer'}</span>
                  {isSearchingApi && <span className="text-[10px] lowercase text-subtle italic">mencari...</span>}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 mt-1">
                  {displayedAirports.length === 0 && !isSearchingApi ? (
                    <div className="p-4 text-center text-xs text-subtle">
                      Tidak menemukan kota &quot;{searchQuery}&quot;. Coba nama lain atau kode bandara.
                    </div>
                  ) : (
                    displayedAirports.map((airport) => (
                      <div
                        key={airport.code}
                        onClick={() => {
                          setOrigin(airport)
                          setActiveDropdown(null)
                          setErrorMsg('')
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                          origin.code === airport.code
                            ? 'bg-tint text-ink'
                            : 'hover:bg-page text-ink'
                        }`}
                      >
                        <div className="text-left min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-ink">
                              {airport.primaryCity || airport.city}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-panel border border-line text-brand-fg font-mono text-[10px] font-bold">
                              {airport.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-subtle truncate mt-0.5">{airport.name}</p>
                        </div>
                        {origin.code === airport.code && (
                          <span className="material-symbols-outlined text-brand-fg text-[18px]">
                            check
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Swap Button with 180deg Spin Animation */}
          <div className="hidden md:flex md:col-span-1 justify-center items-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Tukar rute asal dan tujuan"
              title="Tukar rute"
              className={`w-9 h-9 rounded-full border border-line bg-panel hover:bg-tint hover:border-brand-fg text-brand-fg flex items-center justify-center transition-all duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-fg active:scale-90 ${
                isSwapping ? 'rotate-180 scale-110' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px] select-none">
                swap_horiz
              </span>
            </button>
          </div>

          {/* Field 2: Ke (Destination City-First) */}
          <div className="md:col-span-3 relative">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveDropdown(activeDropdown === 'destination' ? null : 'destination')
              }}
              className={`w-full flex flex-col text-left px-3.5 py-2.5 rounded-control transition-all border ${
                activeDropdown === 'destination'
                  ? 'border-brand-fg bg-panel shadow-sm ring-2 ring-brand-fg/20'
                  : 'bg-page/70 hover:bg-page border-transparent'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider text-subtle font-bold">
                Ke (Kota Tujuan)
              </span>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <span className="text-base sm:text-lg font-bold text-ink truncate">
                  {destination.primaryCity || destination.city}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-tint text-brand-fg font-mono text-[11px] font-bold shrink-0">
                  {destination.code}
                </span>
              </div>
              <span className="text-[11px] text-subtle truncate mt-0.5">{destination.name}</span>
            </button>

            {/* Destination Autocomplete Popover */}
            {activeDropdown === 'destination' && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[320px] bg-white dark:bg-[#112038] rounded-xl border border-line shadow-2xl p-2.5 z-[100] ring-1 ring-black/10 dark:ring-white/10 opacity-100 animate-fadeIn">
                <div className="p-1 mb-1.5 relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-subtle">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama kota (cth: Bali, Jogja, Surabaya)..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-xs bg-panel border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-brand-fg/30 font-medium"
                  />
                </div>
                <div className="text-[10px] uppercase font-bold text-subtle px-2 py-1 border-b border-line flex items-center justify-between">
                  <span>{searchQuery.trim().length >= 1 ? 'Hasil Pencarian Kota' : 'Kota & Bandara Populer'}</span>
                  {isSearchingApi && <span className="text-[10px] lowercase text-subtle italic">mencari...</span>}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 mt-1">
                  {displayedAirports.length === 0 && !isSearchingApi ? (
                    <div className="p-4 text-center text-xs text-subtle">
                      Tidak menemukan kota &quot;{searchQuery}&quot;. Coba nama lain atau kode bandara.
                    </div>
                  ) : (
                    displayedAirports.map((airport) => (
                      <div
                        key={airport.code}
                        onClick={() => {
                          setDestination(airport)
                          setActiveDropdown(null)
                          setErrorMsg('')
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                          destination.code === airport.code
                            ? 'bg-tint text-ink'
                            : 'hover:bg-page text-ink'
                        }`}
                      >
                        <div className="text-left min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-ink">
                              {airport.primaryCity || airport.city}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-panel border border-line text-brand-fg font-mono text-[10px] font-bold">
                              {airport.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-subtle truncate mt-0.5">{airport.name}</p>
                        </div>
                        {destination.code === airport.code && (
                          <span className="material-symbols-outlined text-brand-fg text-[18px]">
                            check
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Field 3: Tanggal (Berangkat / Pulang) */}
          <div className={`${tripType === 'roundtrip' ? 'md:col-span-3' : 'md:col-span-2'} relative`}>
            {tripType === 'roundtrip' ? (
              <div className="grid grid-cols-2 gap-2">
                {/* Tanggal Pergi */}
                <div className="w-full flex flex-col text-left px-2.5 py-2 rounded-control bg-page/70 hover:bg-page border border-transparent transition-colors">
                  <span className="text-[10px] uppercase tracking-wider text-subtle font-bold">
                    Pergi
                  </span>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => {
                      setDepartureDate(e.target.value)
                      if (e.target.value > returnDate) {
                        setReturnDate(e.target.value)
                      }
                    }}
                    min={todayStr}
                    className="bg-transparent text-xs sm:text-sm font-bold text-ink mt-0.5 focus:outline-none cursor-pointer"
                  />
                </div>
                {/* Tanggal Pulang */}
                <div className="w-full flex flex-col text-left px-2.5 py-2 rounded-control bg-page/70 hover:bg-page border border-transparent transition-colors">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                    Pulang (PP)
                  </span>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    min={departureDate}
                    className="bg-transparent text-xs sm:text-sm font-bold text-ink mt-0.5 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col text-left px-3 py-2.5 rounded-control bg-page/70 hover:bg-page border border-transparent transition-colors">
                <span className="text-[10px] uppercase tracking-wider text-subtle font-bold">
                  Tanggal Berangkat
                </span>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  min={todayStr}
                  className="bg-transparent text-sm font-bold text-ink mt-0.5 focus:outline-none cursor-pointer"
                />
                <span className="text-[11px] text-subtle">Sekali jalan</span>
              </div>
            )}
          </div>

          {/* Field 4: Penumpang & Kelas */}
          <div className={`${tripType === 'roundtrip' ? 'md:col-span-1' : 'md:col-span-1'} relative`}>
            <button
              type="button"
              onClick={() =>
                setActiveDropdown(activeDropdown === 'passengers' ? null : 'passengers')
              }
              className={`w-full flex flex-col text-left px-2.5 py-2.5 rounded-control transition-all border ${
                activeDropdown === 'passengers'
                  ? 'border-brand-fg bg-panel shadow-sm ring-2 ring-brand-fg/20'
                  : 'bg-page/70 hover:bg-page border-transparent'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider text-subtle font-bold">
                Penumpang
              </span>
              <div className="text-sm font-bold text-ink mt-0.5 truncate tabular-nums flex items-center gap-1">
                <span>{passengers} Org</span>
                {groupDiscount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title={`Diskon ${groupDiscount}%`} />
                )}
              </div>
              <span className="text-[10px] text-subtle capitalize truncate">
                {cabinClass === 'economy' ? 'Ekonomi' : 'Bisnis'}
              </span>
            </button>

            {/* Passengers & Class Popover */}
            {activeDropdown === 'passengers' && (
              <div className="absolute top-[calc(100%+8px)] right-0 w-72 bg-raised rounded-xl border border-line shadow-2xl p-4 z-50 animate-fadeIn">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink block">
                      Jumlah Penumpang
                    </span>
                    {passengers >= 2 && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Diskon {groupDiscount}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-subtle mb-3">
                    Pesan $\ge$ 2 orang otomatis dapat diskon rombongan &quot;Berangkat Bareng&quot;.
                  </p>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-panel border border-line">
                    <button
                      type="button"
                      disabled={passengers <= 1}
                      onClick={() => setPassengers(Math.max(1, passengers - 1))}
                      className="w-8 h-8 rounded-full border border-line bg-raised flex items-center justify-center text-ink disabled:opacity-30 hover:bg-tint transition-colors active:scale-90"
                    >
                      <span className="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <span className="font-extrabold text-lg text-ink tabular-nums">
                      {passengers} Penumpang
                    </span>
                    <button
                      type="button"
                      disabled={passengers >= 9}
                      onClick={() => setPassengers(Math.min(9, passengers + 1))}
                      className="w-8 h-8 rounded-full border border-line bg-raised flex items-center justify-center text-ink disabled:opacity-30 hover:bg-tint transition-colors active:scale-90"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-ink block mb-2">Kelas Kabin</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCabinClass('economy')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        cabinClass === 'economy'
                          ? 'bg-brand text-white shadow-xs'
                          : 'bg-page text-ink hover:bg-tint'
                      }`}
                    >
                      Ekonomi
                    </button>
                    <button
                      type="button"
                      onClick={() => setCabinClass('business')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        cabinClass === 'business'
                          ? 'bg-brand text-white shadow-xs'
                          : 'bg-page text-ink hover:bg-tint'
                      }`}
                    >
                      Bisnis
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search Button */}
          <div className={`${tripType === 'roundtrip' ? 'md:col-span-1' : 'md:col-span-2'} flex items-center justify-end pl-0 md:pl-2 md:border-l md:border-dashed md:border-line h-auto md:h-12 mt-2 md:mt-0`}>
            <button
              type="button"
              onClick={handleSearch}
              className="w-full h-12 bg-brand hover:bg-brand-hover text-white text-xs sm:text-sm font-bold rounded-control flex items-center justify-center gap-1.5 shadow-md transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-fg"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] select-none">
                search
              </span>
              <span>Cari Tiket</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 text-xs text-danger flex items-center gap-1.5 font-medium animate-fadeIn">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Recent Searches Chips */}
        {recentSearches.length > 0 && (
          <div className="mt-4 pt-3 border-t border-line/60 flex items-center gap-2 overflow-x-auto text-xs text-subtle">
            <span className="font-semibold shrink-0">Pencarian terakhir:</span>
            <div className="flex items-center gap-2">
              {recentSearches.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectRecent(r)}
                  className="px-2.5 py-1 rounded-full bg-panel hover:bg-tint border border-line text-ink text-[11px] font-medium shrink-0 flex items-center gap-1 transition-colors"
                >
                  <span className="font-bold">{r.originCity || r.origin}</span>
                  <span className="material-symbols-outlined text-[12px] text-brand-fg">
                    arrow_forward
                  </span>
                  <span className="font-bold">{r.destinationCity || r.destination}</span>
                  {r.tripType === 'roundtrip' && (
                    <span className="text-[9px] bg-tint px-1 rounded text-brand-fg font-bold">PP</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
