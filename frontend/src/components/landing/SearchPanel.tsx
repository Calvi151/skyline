import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

interface Airport {
  code: string
  city: string
  name: string
}

const POPULAR_AIRPORTS: Airport[] = [
  { code: 'CGK', city: 'Jakarta', name: 'Bandara Internasional Soekarno-Hatta' },
  { code: 'DPS', city: 'Denpasar', name: 'Bandara Internasional I Gusti Ngurah Rai' },
  { code: 'SUB', city: 'Surabaya', name: 'Bandara Internasional Juanda' },
  { code: 'SIN', city: 'Singapura', name: 'Singapore Changi International Airport' },
  { code: 'DOH', city: 'Doha', name: 'Hamad International Airport' },
  { code: 'KNO', city: 'Medan', name: 'Bandara Internasional Kualanamu' },
  { code: 'YIA', city: 'Yogyakarta', name: 'Bandara Internasional Yogyakarta' },
  { code: 'UPG', city: 'Makassar', name: 'Bandara Internasional Sultan Hasanuddin' },
]

interface RecentSearch {
  origin: string
  originCity: string
  destination: string
  destinationCity: string
  date: string
  passengers: number
  cabinClass: string
}

export default function SearchPanel() {
  const navigate = useNavigate()
  const todayStr = new Date().toISOString().slice(0, 10)

  // Form states
  const [origin, setOrigin] = useState<Airport>(POPULAR_AIRPORTS[0]) // CGK
  const [destination, setDestination] = useState<Airport>(POPULAR_AIRPORTS[1]) // DPS
  const [departureDate, setDepartureDate] = useState(todayStr)
  const [passengers, setPassengers] = useState(1)
  const [cabinClass, setCabinClass] = useState<'economy' | 'business'>('economy')

  // UI state for dropdowns
  const [activeDropdown, setActiveDropdown] = useState<'origin' | 'destination' | 'passengers' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchedAirports, setSearchedAirports] = useState<Airport[]>([])
  const [isSearchingAirports, setIsSearchingAirports] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])

  const panelRef = useRef<HTMLDivElement>(null)

  // Live search airports from API when typing
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchedAirports([])
      setIsSearchingAirports(false)
      return
    }

    setIsSearchingAirports(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: any[] }>(`/airports?q=${encodeURIComponent(q)}`)
        const items = (res.data?.data || []).map((a: any) => ({
          code: a.code,
          city: a.city,
          name: a.name,
        }))
        setSearchedAirports(items)
      } catch (err) {
        console.error('Failed to search airports:', err)
      } finally {
        setIsSearchingAirports(false)
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

  const filteredPopular = POPULAR_AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const displayedAirports = searchQuery.trim().length >= 2 ? searchedAirports : filteredPopular

  const [isSwapping, setIsSwapping] = useState(false)

  const handleSwap = () => {
    setIsSwapping(true)
    setTimeout(() => setIsSwapping(false), 300)
    const temp = origin
    setOrigin(destination)
    setDestination(temp)
    setErrorMsg('')
  }

  const handleSearch = () => {
    if (origin.code === destination.code) {
      setErrorMsg('Bandara asal dan tujuan tidak boleh sama.')
      return
    }

    setErrorMsg('')

    // Save recent search
    const newEntry: RecentSearch = {
      origin: origin.code,
      originCity: origin.city,
      destination: destination.code,
      destinationCity: destination.city,
      date: departureDate,
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

    const searchUrl = `/search?origin=${origin.code}&destination=${destination.code}&date=${departureDate}&passengers=${passengers}&class=${cabinClass}`
    navigate(searchUrl)
  }

  const selectRecent = (r: RecentSearch) => {
    const orig = POPULAR_AIRPORTS.find((a) => a.code === r.origin) || {
      code: r.origin,
      city: r.originCity,
      name: '',
    }
    const dest = POPULAR_AIRPORTS.find((a) => a.code === r.destination) || {
      code: r.destination,
      city: r.destinationCity,
      name: '',
    }
    setOrigin(orig)
    setDestination(dest)
    setDepartureDate(r.date)
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
          {/* Field 1: Dari (Origin) */}
          <div className="md:col-span-3 relative">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveDropdown(activeDropdown === 'origin' ? null : 'origin')
              }}
              className={`w-full flex flex-col text-left px-3 py-2.5 rounded-control transition-all border ${
                activeDropdown === 'origin'
                  ? 'border-brand-fg bg-panel shadow-sm ring-2 ring-brand-fg/20'
                  : 'bg-page/70 hover:bg-page border-transparent'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider text-subtle font-semibold">
                Dari (Asal)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-ink tabular-nums">{origin.code}</span>
                <span className="text-sm font-semibold text-ink truncate">{origin.city}</span>
              </div>
              <span className="text-[11px] text-subtle truncate mt-0.5">{origin.name}</span>
            </button>

            {/* Origin Autocomplete Popover */}
            {activeDropdown === 'origin' && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[280px] bg-raised rounded-xl border border-line shadow-[0_16px_28px_rgba(11,37,69,0.12)] p-2 z-50 animate-fadeIn">
                <div className="p-1 mb-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik kota atau kode bandara..."
                    autoFocus
                    className="w-full px-3 py-1.5 text-xs bg-panel border border-line rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-brand-fg"
                  />
                </div>
                <div className="text-[10px] uppercase font-semibold text-subtle px-2 py-1 border-b border-line flex items-center justify-between">
                  <span>{searchQuery.trim().length >= 2 ? 'Hasil Pencarian' : 'Bandara Populer'}</span>
                  {isSearchingAirports && <span className="text-[10px] lowercase text-subtle italic">mencari...</span>}
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 mt-1">
                  {displayedAirports.length === 0 && !isSearchingAirports ? (
                    <div className="p-3 text-center text-xs text-subtle">
                      Tidak ada bandara yang cocok
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
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          origin.code === airport.code
                            ? 'bg-tint text-ink'
                            : 'hover:bg-page text-ink'
                        }`}
                      >
                        <div className="text-left min-w-0 pr-2">
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-sm text-brand-fg tabular-nums">
                              {airport.code}
                            </span>
                            <span className="text-xs font-semibold text-ink">{airport.city}</span>
                          </div>
                          <p className="text-[11px] text-subtle truncate">{airport.name}</p>
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
              className={`w-10 h-10 rounded-full border border-line bg-panel hover:bg-tint hover:border-brand-fg text-brand-fg flex items-center justify-center transition-all duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-fg active:scale-90 ${
                isSwapping ? 'rotate-180 scale-110' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[20px] select-none">
                swap_horiz
              </span>
            </button>
          </div>

          {/* Field 2: Ke (Destination) */}
          <div className="md:col-span-3 relative">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveDropdown(activeDropdown === 'destination' ? null : 'destination')
              }}
              className={`w-full flex flex-col text-left px-3 py-2.5 rounded-control transition-all border ${
                activeDropdown === 'destination'
                  ? 'border-brand-fg bg-panel shadow-sm ring-2 ring-brand-fg/20'
                  : 'bg-page/70 hover:bg-page border-transparent'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider text-subtle font-semibold">
                Ke (Tujuan)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-ink tabular-nums">
                  {destination.code}
                </span>
                <span className="text-sm font-semibold text-ink truncate">
                  {destination.city}
                </span>
              </div>
              <span className="text-[11px] text-subtle truncate mt-0.5">{destination.name}</span>
            </button>

            {/* Destination Autocomplete Popover */}
            {activeDropdown === 'destination' && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[280px] bg-raised rounded-xl border border-line shadow-[0_16px_28px_rgba(11,37,69,0.12)] p-2 z-50 animate-fadeIn">
                <div className="p-1 mb-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik kota atau kode bandara..."
                    autoFocus
                    className="w-full px-3 py-1.5 text-xs bg-panel border border-line rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-brand-fg"
                  />
                </div>
                <div className="text-[10px] uppercase font-semibold text-subtle px-2 py-1 border-b border-line flex items-center justify-between">
                  <span>{searchQuery.trim().length >= 2 ? 'Hasil Pencarian' : 'Bandara Populer'}</span>
                  {isSearchingAirports && <span className="text-[10px] lowercase text-subtle italic">mencari...</span>}
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 mt-1">
                  {displayedAirports.length === 0 && !isSearchingAirports ? (
                    <div className="p-3 text-center text-xs text-subtle">
                      Tidak ada bandara yang cocok
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
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          destination.code === airport.code
                            ? 'bg-tint text-ink'
                            : 'hover:bg-page text-ink'
                        }`}
                      >
                        <div className="text-left min-w-0 pr-2">
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-sm text-brand-fg tabular-nums">
                              {airport.code}
                            </span>
                            <span className="text-xs font-semibold text-ink">{airport.city}</span>
                          </div>
                          <p className="text-[11px] text-subtle truncate">{airport.name}</p>
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

          {/* Field 3: Tanggal Berangkat */}
          <div className="md:col-span-2 relative">
            <div className="w-full flex flex-col text-left px-3 py-2.5 rounded-control bg-page/70 hover:bg-page border border-transparent transition-colors">
              <span className="text-[11px] uppercase tracking-wider text-subtle font-semibold">
                Berangkat
              </span>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={todayStr}
                className="bg-transparent text-sm font-bold text-ink mt-0.5 focus:outline-none cursor-pointer"
              />
              <span className="text-[11px] text-subtle">Satu arah</span>
            </div>
          </div>

          {/* Field 4: Penumpang & Kelas */}
          <div className="md:col-span-1 relative">
            <button
              type="button"
              onClick={() =>
                setActiveDropdown(activeDropdown === 'passengers' ? null : 'passengers')
              }
              className={`w-full flex flex-col text-left px-3 py-2.5 rounded-control transition-all border ${
                activeDropdown === 'passengers'
                  ? 'border-brand-fg bg-panel shadow-sm'
                  : 'bg-page/70 hover:bg-page border-transparent'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider text-subtle font-semibold">
                Kabin
              </span>
              <div className="text-sm font-bold text-ink mt-0.5 truncate tabular-nums">
                {passengers} Org
              </div>
              <span className="text-[11px] text-subtle capitalize truncate">
                {cabinClass === 'economy' ? 'Ekonomi' : 'Bisnis'}
              </span>
            </button>

            {/* Passengers & Class Popover */}
            {activeDropdown === 'passengers' && (
              <div className="absolute top-[calc(100%+8px)] right-0 w-64 bg-raised rounded-xl border border-line shadow-[0_16px_28px_rgba(11,37,69,0.12)] p-4 z-50 animate-fadeIn">
                <div className="mb-4">
                  <span className="text-xs font-semibold text-ink block mb-2">
                    Jumlah Penumpang
                  </span>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={passengers <= 1}
                      onClick={() => setPassengers(Math.max(1, passengers - 1))}
                      className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-ink disabled:opacity-30 hover:bg-tint transition-colors active:scale-90"
                    >
                      -
                    </button>
                    <span className="font-bold text-base text-ink tabular-nums">
                      {passengers} Penumpang
                    </span>
                    <button
                      type="button"
                      disabled={passengers >= 9}
                      onClick={() => setPassengers(Math.min(9, passengers + 1))}
                      className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-ink disabled:opacity-30 hover:bg-tint transition-colors active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-ink block mb-2">Kelas Kabin</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCabinClass('economy')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                        cabinClass === 'economy'
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-page text-ink hover:bg-tint'
                      }`}
                    >
                      Ekonomi
                    </button>
                    <button
                      type="button"
                      onClick={() => setCabinClass('business')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                        cabinClass === 'business'
                          ? 'bg-brand text-white shadow-sm'
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

          {/* Search Button (with vertical perforation divider on Desktop) */}
          <div className="md:col-span-2 flex items-center justify-end pl-0 md:pl-2 md:border-l md:border-dashed md:border-line h-auto md:h-12 mt-2 md:mt-0">
            <button
              type="button"
              onClick={handleSearch}
              className="w-full h-12 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-control flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-fg"
            >
              <span className="material-symbols-outlined text-[20px] select-none">
                search
              </span>
              <span>Cari penerbangan</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 text-xs text-danger flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Recent Searches (Simpan 5 pencarian terakhir di bawah SearchPanel) */}
      {recentSearches.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-subtle font-semibold uppercase tracking-wider">
            Pencarian Terakhir:
          </span>
          {recentSearches.map((r, idx) => (
            <button
              key={`${r.origin}-${r.destination}-${idx}`}
              type="button"
              onClick={() => selectRecent(r)}
              className="text-xs px-2.5 py-1 rounded-full bg-raised hover:bg-tint border border-line text-ink flex items-center gap-1.5 transition-colors"
            >
              <span className="font-bold text-brand-fg">{r.origin}</span>
              <span className="text-subtle">→</span>
              <span className="font-bold text-brand-fg">{r.destination}</span>
              <span className="text-subtle text-[11px]">({r.date})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
