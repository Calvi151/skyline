import { useState, useMemo } from 'react'

export interface SeatItem {
  id: number
  seat_number: string
  seat_class: 'economy' | 'business'
  is_available: boolean
}

interface SeatMapProps {
  seats: SeatItem[]
  passengerIndex: number
  passengerName: string
  selectedSeatsByPassenger: { [pIndex: number]: { id: number; number: string; isEmergency?: boolean } | null }
  onSelectSeat: (seat: { id: number; number: string; isEmergency: boolean } | null) => void
}

export default function SeatMap({
  seats,
  passengerIndex,
  passengerName,
  selectedSeatsByPassenger,
  onSelectSeat,
}: SeatMapProps) {
  const [scale, setScale] = useState<number>(100)
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null)

  // Emergency exit rows typically 14 and 15
  const emergencyExitRows = useMemo(() => [14, 15], [])

  // Parse seats into rows
  const seatGrid = useMemo(() => {
    // If no seats from API, generate fallback 20 rows of 3-3 (A, B, C, D, E, F)
    if (!seats || seats.length === 0) {
      const generatedRows: { [row: number]: { [col: string]: SeatItem } } = {}
      let idCounter = 1
      for (let r = 1; r <= 24; r++) {
        generatedRows[r] = {}
        const cols = ['A', 'B', 'C', 'D', 'E', 'F']
        for (const col of cols) {
          const seatNum = `${r}${col}`
          // Mock some occupied seats (e.g. 14B, 15D, etc.)
          const isOcc = [
            '2A', '3B', '5C', '6D', '7E', '8F', '12A', '12B', '14C', '16E', '17F', '18A', '20B',
          ].includes(seatNum)
          generatedRows[r][col] = {
            id: idCounter++,
            seat_number: seatNum,
            seat_class: r <= 2 ? 'business' : 'economy',
            is_available: !isOcc,
          }
        }
      }
      return generatedRows
    }

    const rows: { [row: number]: { [col: string]: SeatItem } } = {}
    seats.forEach((seat) => {
      const match = seat.seat_number.match(/^(\d+)([A-Z])$/)
      if (match) {
        const rowNum = parseInt(match[1], 10)
        const colLetter = match[2]
        if (!rows[rowNum]) rows[rowNum] = {}
        rows[rowNum][colLetter] = seat
      }
    })
    return rows
  }, [seats])

  const sortedRowNumbers = useMemo(() => {
    return Object.keys(seatGrid)
      .map(Number)
      .sort((a, b) => a - b)
  }, [seatGrid])

  // Get currently selected seat for active passenger
  const activeSelected = selectedSeatsByPassenger[passengerIndex]

  // Map of all taken seat IDs across all passengers in current booking
  const takenSeatIdsMap = useMemo(() => {
    const map = new Map<number, number>() // seatId -> passengerIndex
    Object.entries(selectedSeatsByPassenger).forEach(([pIdxStr, seatObj]) => {
      if (seatObj) {
        map.set(seatObj.id, Number(pIdxStr))
      }
    })
    return map
  }, [selectedSeatsByPassenger])

  const handleSeatClick = (seat: SeatItem) => {
    if (!seat.is_available) return

    // If seat is taken by another passenger in this booking
    const takenByOtherIndex = takenSeatIdsMap.get(seat.id)
    if (takenByOtherIndex !== undefined && takenByOtherIndex !== passengerIndex) {
      return
    }

    // Toggle off if already selected by this passenger
    if (activeSelected?.id === seat.id) {
      onSelectSeat(null)
      return
    }

    // Select seat
    const rowNum = parseInt(seat.seat_number, 10)
    const isEmergency = emergencyExitRows.includes(rowNum)
    onSelectSeat({
      id: seat.id,
      number: seat.seat_number,
      isEmergency,
    })
  }

  const zoomIn = () => setScale((prev) => Math.min(125, prev + 10))
  const zoomOut = () => setScale((prev) => Math.max(80, prev - 10))

  return (
    <div className="bg-raised border border-line rounded-ticket shadow-sm p-4 md:p-6 relative overflow-hidden">
      {/* ─── Header & Zoom Horizon ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-line gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">flight_class</span>
          </div>
          <div>
            <h3 className="font-bold text-ink text-sm sm:text-base">Denah Kabin Pesawat</h3>
            <p className="text-xs text-subtle">Formasi 3-3 lorong tunggal (A B C — D E F)</p>
          </div>
        </div>

        {/* Legend and Scale */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Zoom widget */}
          <div className="flex items-center bg-page border border-line rounded-control p-1 text-xs">
            <button
              type="button"
              onClick={zoomOut}
              className="w-7 h-7 rounded bg-panel border border-line flex items-center justify-center text-ink hover:bg-tint transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <span className="px-2 font-bold tabular-nums text-ink">{scale}%</span>
            <button
              type="button"
              onClick={zoomIn}
              className="w-7 h-7 rounded bg-panel border border-line flex items-center justify-center text-ink hover:bg-tint transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Seat Status Legend Bar ─── */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 pb-4 mb-6 border-b border-line/60 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-line bg-panel shadow-2xs" />
          <span className="text-subtle font-medium">Tersedia</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-[#E8532F] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
            ✓
          </div>
          <span className="text-ink font-bold">Pilihanmu</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-brand text-white flex items-center justify-center text-[10px] font-bold">
            P
          </div>
          <span className="text-subtle font-medium">Penumpang Lain</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-line/80 text-subtle flex items-center justify-center text-[10px]">
            ✕
          </div>
          <span className="text-subtle font-medium">Terisi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-amber-500 bg-amber-500/10" />
          <span className="text-subtle font-medium">Pintu Darurat (+Rp 90k)</span>
        </div>
      </div>

      {/* ─── Fuselage Body & Architectural Frame ─── */}
      <div
        className="max-w-[480px] mx-auto relative pt-2 pb-6 transition-transform duration-200"
        style={{ transform: `scale(${scale / 100})`, transformOrigin: 'top center' }}
      >
        {/* Cockpit Nose Nosecone Outline Aesthetic */}
        <div className="w-full flex flex-col items-center mb-6 select-none">
          <svg className="w-56 h-12 text-line" fill="none" viewBox="0 0 240 60">
            <path
              d="M20 60 C30 20, 90 4, 120 4 C150 4, 210 20, 220 60"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
            <line stroke="currentColor" strokeDasharray="3 3" strokeWidth="1.5" x1="120" x2="120" y1="12" y2="34" />
          </svg>
          <div className="flex items-center gap-1 text-subtle text-[10px] font-bold uppercase tracking-widest mt-1">
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
            <span>Arah Kokpit / Depan Pesawat</span>
          </div>
        </div>

        {/* Fuselage Container */}
        <div className="relative px-6 sm:px-10 py-5 bg-page/60 border border-line rounded-3xl shadow-xs">
          {/* Emergency Exit Left & Right Door Badges (Rows 14-15) */}
          <div className="absolute -left-3 top-[370px] h-[80px] w-5 flex flex-col items-center justify-center">
            <div className="w-3 h-full rounded-r bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[10px] -rotate-90 font-bold">
                logout
              </span>
            </div>
          </div>

          <div className="absolute -right-3 top-[370px] h-[80px] w-5 flex flex-col items-center justify-center">
            <div className="w-3 h-full rounded-l bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[10px] rotate-90 font-bold">
                logout
              </span>
            </div>
          </div>

          {/* Seat Grid Headers (A B C | Aisle | D E F) */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-bold text-subtle pb-3 border-b border-line mb-3">
            <span>A</span>
            <span>B</span>
            <span>C</span>
            <span className="text-[10px] uppercase font-semibold text-subtle/60">Lorong</span>
            <span>D</span>
            <span>E</span>
            <span>F</span>
          </div>

          {/* Seat Rows */}
          <div className="space-y-2">
            {sortedRowNumbers.map((rowNum) => {
              const rowSeats = seatGrid[rowNum] || {}
              const isEmergency = emergencyExitRows.includes(rowNum)

              return (
                <div key={rowNum} className="relative">
                  {/* Emergency Row Label Pill */}
                  {isEmergency && rowNum === 14 && (
                    <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-center mb-1">
                      Pintu Darurat • Ekstra Ruang Kaki (+Rp 90.000)
                    </div>
                  )}

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 items-center">
                    {/* Left 3 seats (A, B, C) */}
                    {['A', 'B', 'C'].map((col) => {
                      const seat = rowSeats[col]
                      return renderSeatButton(seat, isEmergency)
                    })}

                    {/* Middle Row Number */}
                    <div className="text-center font-bold text-[11px] text-subtle font-sans tabular-nums select-none">
                      {rowNum}
                    </div>

                    {/* Right 3 seats (D, E, F) */}
                    {['D', 'E', 'F'].map((col) => {
                      const seat = rowSeats[col]
                      return renderSeatButton(seat, isEmergency)
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Floating Hover Seat Tooltip */}
      {hoveredSeat && (
        <div className="mt-4 p-2.5 bg-tint border border-brand-fg/30 rounded-control text-center text-xs text-ink animate-in fade-in duration-100">
          <span>{hoveredSeat}</span>
        </div>
      )}
    </div>
  )

  function renderSeatButton(seat?: SeatItem, isEmergencyRow?: boolean) {
    if (!seat) {
      return <div key={Math.random()} className="w-8 h-8 sm:w-9 sm:h-9" />
    }

    const isAvailable = seat.is_available
    const takenByOtherPassengerIndex = takenSeatIdsMap.get(seat.id)
    const isSelectedByActive = activeSelected?.id === seat.id
    const isSelectedByOther =
      takenByOtherPassengerIndex !== undefined && takenByOtherPassengerIndex !== passengerIndex

    let seatClasses =
      'w-8 h-8 sm:w-9 sm:h-9 rounded-control flex items-center justify-center text-xs font-bold transition-all relative select-none'

    if (isSelectedByActive) {
      // Coral signal color active
      seatClasses +=
        ' bg-[#E8532F] text-white shadow-md ring-2 ring-amber-400/50 scale-105 z-10'
    } else if (isSelectedByOther) {
      // Taken by other passenger in same booking
      seatClasses += ' bg-brand text-white shadow-xs cursor-not-allowed opacity-90'
    } else if (!isAvailable) {
      // Occupied by someone else in DB
      seatClasses += ' bg-line/80 text-subtle cursor-not-allowed'
    } else if (isEmergencyRow) {
      // Emergency row
      seatClasses +=
        ' bg-panel border-2 border-amber-500/70 text-ink hover:bg-amber-500/10 cursor-pointer shadow-2xs'
    } else {
      // Available standard
      seatClasses +=
        ' bg-panel border border-line text-ink hover:border-brand-fg hover:bg-tint cursor-pointer shadow-2xs'
    }

    return (
      <button
        key={seat.id}
        type="button"
        disabled={!isAvailable || isSelectedByOther}
        onClick={() => handleSeatClick(seat)}
        onMouseEnter={() => {
          let desc = `Kursi ${seat.seat_number} • ${seat.seat_class === 'business' ? 'Kelas Bisnis' : 'Kelas Ekonomi'}`
          if (isEmergencyRow) desc += ' (Pintu Darurat: +Rp 90.000)'
          if (!isAvailable) desc += ' (Sudah terisi)'
          else if (isSelectedByActive) desc += ` (Dipilih untuk ${passengerName})`
          else if (isSelectedByOther)
            desc += ` (Dipilih untuk Penumpang ${(takenByOtherPassengerIndex || 0) + 1})`
          setHoveredSeat(desc)
        }}
        onMouseLeave={() => setHoveredSeat(null)}
        className={seatClasses}
      >
        {isSelectedByActive ? (
          <span className="material-symbols-outlined text-[16px]">check</span>
        ) : isSelectedByOther ? (
          <span className="text-[10px]">P{(takenByOtherPassengerIndex || 0) + 1}</span>
        ) : !isAvailable ? (
          <span className="text-[10px] text-subtle">✕</span>
        ) : (
          <span className="text-[10px] opacity-80">{seat.seat_number.slice(-1)}</span>
        )}
      </button>
    )
  }
}
