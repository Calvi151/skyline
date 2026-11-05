import { useState, useRef, useEffect, useMemo } from 'react'
import { AirlineLogo } from './AirlineLogo'
import { AVAILABLE_GATES, getGateForFlight } from '../../store/staffStore'

export interface ComboboxFlightItem {
  id: number
  flight_number: string
  airline: { name: string; code: string; logo?: string | null } | null
  origin: { code: string; city: string; name?: string } | null
  destination: { code: string; city: string; name?: string } | null
  departure_time: string | null
  status?: string
  gate?: string
}

interface FlightSearchComboboxProps {
  flights: ComboboxFlightItem[]
  selectedFlightId: string | number | null
  selectedGate?: string
  onSelectFlight: (flightId: string) => void
  onSelectGate?: (gate: string) => void
  allowUniversalOption?: boolean
  className?: string
}

export function FlightSearchCombobox({
  flights,
  selectedFlightId,
  selectedGate = 'all',
  onSelectFlight,
  onSelectGate,
  allowUniversalOption = false,
  className = '',
}: FlightSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [gateFilter, setGateFilter] = useState<string>(selectedGate)
  const [activeIndex, setActiveIndex] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Sinkronisasi filter gerbang saat prop berubah
  useEffect(() => {
    setGateFilter(selectedGate)
  }, [selectedGate])

  // Menutup popup saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Fokus input pencarian saat popup dibuka
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchQuery('')
      setActiveIndex(0)
    }
  }, [isOpen])

  // Format jam keberangkatan
  const formatTimeOnly = (iso?: string | null) => {
    if (!iso) return '08:00'
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      })
    } catch {
      return '08:00'
    }
  }

  const isFlightCompleted = (f: ComboboxFlightItem) => {
    if (!f.departure_time) return false
    const dep = new Date(f.departure_time).getTime()
    return Date.now() - dep > 3 * 3600 * 1000
  }

  // Cari objek penerbangan yang sedang aktif
  const currentFlight = useMemo(() => {
    if (selectedFlightId === 'all') return null
    return flights.find((f) => String(f.id) === String(selectedFlightId)) || null
  }, [flights, selectedFlightId])

  // Filter daftar penerbangan berdasarkan kata kunci pencarian & filter gerbang
  const filteredFlights = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return flights.filter((f) => {
      const gate = f.gate || getGateForFlight(f.id)

      // Filter gerbang (jika filter aktif bukan 'all')
      if (gateFilter !== 'all' && gate !== gateFilter) {
        return false
      }

      if (!q) return true

      // Cocokkan nomor penerbangan (misal: "GA 1079", "GA-1079", "1079")
      const numMatch =
        f.flight_number.toLowerCase().includes(q) ||
        f.flight_number.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(q.replace(/[^a-zA-Z0-9]/g, ''))

      // Cocokkan maskapai
      const airlineMatch =
        f.airline?.name?.toLowerCase().includes(q) || f.airline?.code?.toLowerCase().includes(q)

      // Cocokkan asal dan tujuan (kode atau nama kota)
      const origMatch =
        f.origin?.code?.toLowerCase().includes(q) || f.origin?.city?.toLowerCase().includes(q)
      const destMatch =
        f.destination?.code?.toLowerCase().includes(q) || f.destination?.city?.toLowerCase().includes(q)

      // Cocokkan nama gerbang (misal: "Gate 14", "14")
      const gateMatch = gate.toLowerCase().includes(q)

      return numMatch || airlineMatch || origMatch || destMatch || gateMatch
    })
  }, [flights, searchQuery, gateFilter])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    const totalItems = (allowUniversalOption ? 1 : 0) + filteredFlights.length

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % Math.max(1, totalItems))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allowUniversalOption && activeIndex === 0) {
        onSelectFlight('all')
        setIsOpen(false)
        return
      }
      const actualIndex = allowUniversalOption ? activeIndex - 1 : activeIndex
      const chosen = filteredFlights[actualIndex]
      if (chosen) {
        onSelectFlight(String(chosen.id))
        const gate = chosen.gate || getGateForFlight(chosen.id)
        if (onSelectGate && gate) onSelectGate(gate)
        setIsOpen(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* ── Trigger Button (Tampilan Menyerupai Command Bar / Search Input) ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="h-10 px-3.5 rounded-full bg-panel border border-line/80 hover:border-brand-fg text-xs font-semibold text-ink shadow-sm flex items-center gap-2.5 transition-all text-left max-w-[360px] sm:max-w-[420px] cursor-pointer group"
        title="Klik untuk mencari penerbangan (Ketik nomor penerbangan, rute, atau maskapai)"
      >
        <span className="material-symbols-outlined text-brand-fg text-[18px] group-hover:scale-110 transition-transform shrink-0">
          search
        </span>

        <div className="flex-1 min-w-0 truncate">
          {selectedFlightId === 'all' || !currentFlight ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-ink truncate">Semua Penerbangan</span>
              <span className="text-[11px] text-subtle font-normal shrink-0">
                (Universal Auto-Detect)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-ink shrink-0">
                {currentFlight.flight_number}
              </span>
              <span className="text-subtle shrink-0">•</span>
              <span className="font-semibold text-ink truncate">
                {currentFlight.origin?.code} → {currentFlight.destination?.code}
              </span>
              <span className="text-[11px] text-brand-fg font-mono shrink-0">
                ({currentFlight.gate || getGateForFlight(currentFlight.id)})
              </span>
            </div>
          )}
        </div>

        <span className="material-symbols-outlined text-subtle text-[16px] shrink-0 transition-transform duration-200">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* ── Popover Pencarian Interaktif ── */}
      {isOpen && (
        <div className="absolute left-0 sm:right-auto top-full mt-2 w-[95vw] sm:w-[480px] max-w-[500px] bg-panel border border-line rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header Input Pencarian */}
          <div className="p-3 border-b border-line bg-raised/50 flex items-center gap-2.5">
            <span className="material-symbols-outlined text-brand-fg text-[20px] shrink-0">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Cari penerbangan (misal: GA-402, DPS, Bali, Lion)..."
              className="flex-1 bg-transparent border-0 text-xs sm:text-sm font-semibold text-ink placeholder:text-subtle focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  searchInputRef.current?.focus()
                }}
                className="p-1 rounded-full text-subtle hover:text-ink hover:bg-tint"
                title="Hapus pencarian"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Filter Pills Gerbang Cepat */}
          <div className="px-3 py-2 border-b border-line/60 bg-raised/20 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-subtle tracking-wider shrink-0 mr-1">
              Pos:
            </span>
            <button
              type="button"
              onClick={() => {
                setGateFilter('all')
                if (onSelectGate) onSelectGate('all')
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-colors ${
                gateFilter === 'all'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-panel border border-line text-subtle hover:text-ink'
              }`}
            >
              Semua Gerbang
            </button>
            {AVAILABLE_GATES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGateFilter(g)
                  if (onSelectGate) onSelectGate(g)
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-colors ${
                  gateFilter === g
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-panel border border-line text-subtle hover:text-ink'
                }`}
              >
                📍 {g}
              </button>
            ))}
          </div>

          {/* List Hasil Pencarian */}
          <div ref={listRef} className="max-h-[340px] overflow-y-auto p-1.5 flex flex-col gap-1">
            {/* Opsi Universal (Khusus Boarding Scanner) */}
            {allowUniversalOption && (
              <button
                type="button"
                onClick={() => {
                  onSelectFlight('all')
                  setIsOpen(false)
                }}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                  selectedFlightId === 'all'
                    ? 'bg-brand/10 border border-brand/30 text-brand-fg font-bold'
                    : activeIndex === 0
                    ? 'bg-raised text-ink'
                    : 'hover:bg-raised text-subtle hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand-fg flex items-center justify-center font-bold text-sm shrink-0">
                    🌐
                  </div>
                  <div>
                    <span className="text-xs font-bold text-ink block">
                      Mode Scanner Universal
                    </span>
                    <span className="text-[11px] text-subtle block">
                      Auto-Detect semua maskapai &amp; tiket penerbangan secara otomatis
                    </span>
                  </div>
                </div>
                {selectedFlightId === 'all' && (
                  <span className="material-symbols-outlined text-brand-fg text-[18px]">
                    check
                  </span>
                )}
              </button>
            )}

            {/* List Penerbangan Hasil Filter */}
            {filteredFlights.length > 0 ? (
              filteredFlights.map((flight, idx) => {
                const itemIndex = allowUniversalOption ? idx + 1 : idx
                const isSelected = String(flight.id) === String(selectedFlightId)
                const isFocused = activeIndex === itemIndex
                const isDone = isFlightCompleted(flight)
                const isCancelled = flight.status === 'cancelled'
                const gate = flight.gate || getGateForFlight(flight.id)
                const depTimeStr = formatTimeOnly(flight.departure_time)

                return (
                  <button
                    key={flight.id}
                    type="button"
                    onClick={() => {
                      onSelectFlight(String(flight.id))
                      if (onSelectGate && gate) onSelectGate(gate)
                      setIsOpen(false)
                    }}
                    className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand/10 border border-brand/40 text-ink'
                        : isFocused
                        ? 'bg-raised border border-line text-ink'
                        : 'hover:bg-raised text-ink border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo Maskapai */}
                      <AirlineLogo
                        code={flight.airline?.code || flight.flight_number.split('-')[0]}
                        name={flight.airline?.name}
                        logo={flight.airline?.logo}
                        size="sm"
                        className="rounded-lg shrink-0 shadow-2xs"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-xs font-bold text-ink">
                            {flight.flight_number}
                          </strong>
                          <span className="text-[11px] text-subtle font-medium truncate">
                            {flight.airline?.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-subtle font-mono">
                          <span>
                            {flight.origin?.code} ({flight.origin?.city}) →{' '}
                            {flight.destination?.code} ({flight.destination?.city})
                          </span>
                          <span>•</span>
                          <span className="text-ink font-semibold">{depTimeStr} WIB</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge Gerbang & Status */}
                    <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                      <span className="px-2 py-0.5 rounded-md bg-tint text-brand-fg font-bold text-[10px] tracking-wide border border-line/60">
                        {gate}
                      </span>
                      {isCancelled ? (
                        <span className="text-[10px] font-semibold text-danger">Batal</span>
                      ) : isDone ? (
                        <span className="text-[10px] font-semibold text-subtle">Selesai</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-success flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          Aktif
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="py-8 px-4 text-center">
                <span className="material-symbols-outlined text-subtle text-[32px] block mb-1">
                  search_off
                </span>
                <p className="text-xs font-semibold text-ink">
                  Tidak ditemukan penerbangan untuk "{searchQuery}"
                </p>
                <p className="text-[11px] text-subtle mt-0.5">
                  Coba cari berdasarkan kode maskapai, nomor jadwal, atau kota tujuan.
                </p>
                {gateFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setGateFilter('all')}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs text-brand-fg hover:underline font-bold"
                  >
                    Tampilkan semua gerbang
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer Petunjuk Cepat */}
          <div className="px-3 py-2 bg-raised/60 border-t border-line text-[10px] text-subtle flex items-center justify-between">
            <span>
              Tekan <kbd className="px-1 py-0.5 rounded bg-panel border border-line font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-panel border border-line font-mono">↓</kbd> untuk memilih, <kbd className="px-1 py-0.5 rounded bg-panel border border-line font-mono">Enter</kbd> untuk konfirmasi
            </span>
            <span className="font-semibold text-ink font-mono">
              {filteredFlights.length} penerbangan
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

