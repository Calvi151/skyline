import { useState } from 'react'
import { showcaseSeats, SeatItem } from '../../content/seatShowcase'

export default function SeatShowcase() {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(['14A', '14B'])
  const [hoveredSeat, setHoveredSeat] = useState<SeatItem | null>(
    showcaseSeats.find((s) => s.id === '15C') || null
  )

  const handleSeatClick = (seat: SeatItem) => {
    if (seat.status === 'occupied') return

    if (selectedSeatIds.includes(seat.id)) {
      setSelectedSeatIds(selectedSeatIds.filter((id) => id !== seat.id))
    } else {
      if (selectedSeatIds.length >= 2) {
        // Max 2 seats: replace the first one
        setSelectedSeatIds([selectedSeatIds[1], seat.id])
      } else {
        setSelectedSeatIds([...selectedSeatIds, seat.id])
      }
    }
  }

  // Calculate extra legroom total
  const extraTotal = selectedSeatIds.reduce((sum, id) => {
    const s = showcaseSeats.find((item) => item.id === id)
    return sum + (s?.extraPrice || 0)
  }, 0)

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    })
      .format(val)
      .replace('IDR', 'Rp')
      .trim()
  }

  const rows = [14, 15, 16]

  return (
    <section className="w-full bg-chrome text-on-chrome rounded-ticket p-6 md:p-12 my-12 md:my-20 overflow-hidden shadow-xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Heading & Key Points */}
        <div className="lg:col-span-6 flex flex-col text-left">
          <span className="text-[11px] uppercase tracking-wider text-tint font-bold">
            Kontrol Penuh Penumpang
          </span>
          <h2 className="text-2xl md:text-4xl font-bold text-on-chrome mt-2 leading-tight font-sans">
            Pilih kursi sendiri, harga langsung terlihat.
          </h2>
          <p className="text-sm md:text-base text-on-chrome/70 mt-3 mb-6 font-sans leading-relaxed">
            Transparan sejak awal tanpa biaya siluman saat check-in di bandara. Kebebasan
            memilih posisi jendela, lorong, atau ruang kaki ekstra.
          </p>

          <div className="flex flex-col gap-4 border-t border-on-chrome/15 pt-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-control bg-on-chrome/10 flex items-center justify-center text-on-chrome shrink-0">
                <span className="material-symbols-outlined text-[22px]">view_column</span>
              </div>
              <div className="text-sm text-on-chrome font-sans">
                Peta kursi konfigurasi 3-3 dengan penanda lorong dan pintu darurat.
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-control bg-on-chrome/10 flex items-center justify-center text-on-chrome shrink-0">
                <span className="material-symbols-outlined text-[22px]">luggage</span>
              </div>
              <div className="text-sm text-on-chrome font-sans">
                Bagasi tambahan dipilih per penumpang dengan tarif maskapai resmi.
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-control bg-on-chrome/10 flex items-center justify-center text-on-chrome shrink-0">
                <span className="material-symbols-outlined text-[22px]">qr_code_2</span>
              </div>
              <div className="text-sm text-on-chrome font-sans">
                E-tiket PDF instan dan boarding pass dengan barcode siap pakai di ponsel.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Seat Matrix Simulation */}
        <div className="lg:col-span-6 relative flex justify-center py-4">
          {/* Floating Ticket / Seat Panel */}
          <div className="relative bg-panel text-ink p-5 md:p-6 rounded-ticket shadow-[0_20px_35px_rgba(0,0,0,0.35)] w-full max-w-md border border-line z-10">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                  Kabin Ekonomi Boeing 737-800
                </span>
                <div className="text-base font-bold text-ink font-sans">
                  Pilih Kursi Baris 14 - 16
                </div>
              </div>
              <span className="text-[10px] uppercase px-2 py-0.5 bg-tint text-brand-fg font-semibold rounded-full">
                Depan Kabin
              </span>
            </div>

            {/* Column Header Indicators */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-subtle font-bold mb-2">
              <div>A</div>
              <div>B</div>
              <div>C</div>
              <div className="text-[9px] uppercase tracking-tighter text-subtle flex items-center justify-center">
                LORONG
              </div>
              <div>D</div>
              <div>E</div>
              <div>F</div>
            </div>

            {/* Seat Rows Matrix */}
            <div className="space-y-3">
              {rows.map((rowNum) => {
                const rowSeats = showcaseSeats.filter((s) => s.row === rowNum)
                const seatA = rowSeats.find((s) => s.col === 'A')!
                const seatB = rowSeats.find((s) => s.col === 'B')!
                const seatC = rowSeats.find((s) => s.col === 'C')!
                const seatD = rowSeats.find((s) => s.col === 'D')!
                const seatE = rowSeats.find((s) => s.col === 'E')!
                const seatF = rowSeats.find((s) => s.col === 'F')!

                const renderSeatBtn = (seat: SeatItem) => {
                  const isSelected = selectedSeatIds.includes(seat.id)
                  const isOccupied = seat.status === 'occupied'
                  const isHovered = hoveredSeat?.id === seat.id

                  return (
                    <div key={seat.id} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSeatClick(seat)}
                        onMouseEnter={() => setHoveredSeat(seat)}
                        onFocus={() => setHoveredSeat(seat)}
                        disabled={isOccupied}
                        aria-label={`Kursi ${seat.id} ${
                          isSelected ? 'Terpilih' : isOccupied ? 'Terisi' : 'Tersedia'
                        }`}
                        className={`w-full h-10 rounded-md flex items-center justify-center text-xs font-bold transition-all relative select-none active:scale-90 ${
                          isSelected
                            ? 'bg-signal text-white shadow-[0_0_0_3px_rgba(232,83,47,0.3)] animate-seat-pop'
                            : isOccupied
                            ? 'bg-page text-subtle/50 cursor-not-allowed'
                            : 'border border-line bg-panel text-ink hover:border-brand-fg hover:bg-tint hover:scale-105'
                        }`}
                      >
                        {isSelected ? (
                          <span className="material-symbols-outlined text-[16px] animate-scaleIn">check</span>
                        ) : isOccupied ? (
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        ) : (
                          seat.id
                        )}
                      </button>

                      {/* Tooltip on active hover */}
                      {isHovered && (
                        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-ink text-panel text-[11px] py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-30 pointer-events-none flex items-center gap-1 animate-fadeIn">
                          <span>
                            Kursi {seat.id}, {seat.description}
                          </span>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-ink" />
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <div key={rowNum} className="grid grid-cols-7 gap-2 items-center">
                    {renderSeatBtn(seatA)}
                    {renderSeatBtn(seatB)}
                    {renderSeatBtn(seatC)}

                    {/* Row Number in Aisle */}
                    <div className="text-center text-[11px] text-subtle font-bold tabular-nums">
                      {rowNum}
                    </div>

                    {renderSeatBtn(seatD)}
                    {renderSeatBtn(seatE)}
                    {renderSeatBtn(seatF)}
                  </div>
                )
              })}
            </div>

            {/* Summary Line */}
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
              <div>
                <span className="text-[11px] text-subtle block">Status Pilihan</span>
                <span className="text-sm font-bold text-ink font-sans">
                  {selectedSeatIds.length > 0
                    ? `${selectedSeatIds.length} kursi (${selectedSeatIds.join(', ')})`
                    : 'Belum ada kursi dipilih'}
                </span>
              </div>
              {extraTotal > 0 ? (
                <span className="px-2.5 py-1 rounded-full bg-tint text-brand-fg text-xs font-bold uppercase tracking-wider">
                  + {formatRupiah(extraTotal)} ekstra legroom
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-page text-subtle text-xs font-semibold">
                  Gratis standar
                </span>
              )}
            </div>
          </div>

          {/* Offset QR Boarding Pass Stub */}
          <div className="hidden sm:flex absolute -bottom-6 -right-4 w-48 bg-raised rounded-xl p-3 border border-line shadow-2xl flex-col items-center rotate-6 z-0 pointer-events-none">
            <div className="w-full border-b border-dashed border-line pb-1.5 mb-2 flex items-center justify-between text-ink">
              <span className="text-[10px] text-subtle uppercase font-semibold">
                BOARDING PASS
              </span>
              <span className="text-[10px] text-brand-fg font-bold">14A</span>
            </div>
            {/* SVG QR Code */}
            <svg className="w-20 h-20" fill="none" viewBox="0 0 100 100">
              <rect width="100" height="100" className="fill-panel" />
              <rect x="10" y="10" width="25" height="25" className="fill-ink" />
              <rect x="15" y="15" width="15" height="15" className="fill-panel" />
              <rect x="65" y="10" width="25" height="25" className="fill-ink" />
              <rect x="70" y="15" width="15" height="15" className="fill-panel" />
              <rect x="10" y="65" width="25" height="25" className="fill-ink" />
              <rect x="15" y="70" width="15" height="15" className="fill-panel" />
              <rect x="45" y="15" width="10" height="20" className="fill-ink" />
              <rect x="40" y="45" width="20" height="10" className="fill-ink" />
              <rect x="45" y="65" width="30" height="10" className="fill-ink" />
              <rect x="65" y="45" width="15" height="15" className="fill-ink" />
            </svg>
            <span className="text-[9px] text-subtle mt-1 font-mono tracking-wider">
              E-TICKET VERIFIED
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
