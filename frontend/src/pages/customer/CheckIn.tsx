import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'

interface Passenger {
  id: string
  name: string
  type: string
  nik: string
  baggage: string
  seat: string
  seatPosition: string
}

export default function CheckIn() {
  const bookingCode = 'K7QM4X'

  // Passenger state
  const [passengers, setPassengers] = useState<Passenger[]>([
    {
      id: 'p1',
      name: 'Rina Wulandari',
      type: 'Dewasa',
      nik: 'NIK 3171********0002',
      baggage: 'Kabin 7 kg',
      seat: '14A',
      seatPosition: 'Jendela',
    },
    {
      id: 'p2',
      name: 'Dimas Pratama',
      type: 'Dewasa',
      nik: 'NIK 3171********0008',
      baggage: 'Kabin 7 kg + Bagasi 20 kg',
      seat: '14B',
      seatPosition: 'Tengah',
    },
  ])

  // Seat map expansion state
  const [editingPassengerId, setEditingPassengerId] = useState<string | null>('p1')
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null)
  const [isAgreed, setIsAgreed] = useState(true)
  const [isCheckedInSuccess, setIsCheckedInSuccess] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>('Kursi 14A tersimpan otomatis')

  // Seat map data (rows 13 - 15)
  const seatConfig = [
    {
      row: 13,
      seats: [
        { id: '13A', status: 'occupied' },
        { id: '13B', status: 'available' },
        { id: '13C', status: 'available' },
        { id: '13D', status: 'occupied' },
        { id: '13E', status: 'available' },
        { id: '13F', status: 'available' },
      ],
    },
    {
      row: 14,
      seats: [
        { id: '14A', status: 'available' },
        { id: '14B', status: 'available' },
        { id: '14C', status: 'available' },
        { id: '14D', status: 'occupied' },
        { id: '14E', status: 'occupied' },
        { id: '14F', status: 'available' },
      ],
    },
    {
      row: 15,
      seats: [
        { id: '15A', status: 'available' },
        { id: '15B', status: 'available' },
        { id: '15C', status: 'available' },
        { id: '15D', status: 'available' },
        { id: '15E', status: 'occupied' },
        { id: '15F', status: 'occupied' },
      ],
    },
  ]

  const handleSeatSelect = (seatId: string) => {
    if (!editingPassengerId) return

    setPassengers((prev) =>
      prev.map((p) => {
        if (p.id === editingPassengerId) {
          const col = seatId.slice(-1)
          const pos = col === 'A' || col === 'F' ? 'Jendela' : col === 'B' || col === 'E' ? 'Tengah' : 'Lorong'
          return { ...p, seat: seatId, seatPosition: pos }
        }
        return p
      })
    )

    setToastMessage(`Kursi ${seatId} berhasil dipilih`)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  const handleCompleteCheckIn = () => {
    if (!isAgreed) return
    setIsCheckedInSuccess(true)
    setToastMessage('Check-in online berhasil diselesaikan!')
  }

  return (
    <div className="min-h-screen bg-page font-sans text-ink">
      <Navbar />

      <main className="w-full pt-[72px] pb-16">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-10">
          {/* Top Bar Navigation */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-subtle hover:text-brand-fg text-xs md:text-sm font-medium transition-colors group"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
                  arrow_back
                </span>
                <span>Kembali ke beranda</span>
              </Link>

              <div className="flex items-center gap-2 text-subtle text-[11px] uppercase tracking-wider font-semibold">
                <span className="w-2 h-2 rounded-full bg-brand-fg animate-pulse" />
                <span>Sistem Check-in Terbuka</span>
              </div>
            </div>

            {/* Flight Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink font-sans">
                    Check-in online
                  </h1>
                  <span className="bg-panel border border-line text-ink px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                    Kenari Air KA 412
                  </span>
                  <span className="text-xs font-mono bg-tint text-brand-fg font-bold px-2 py-0.5 rounded">
                    PNR: {bookingCode}
                  </span>
                </div>
                <p className="text-sm md:text-base text-subtle flex items-center gap-2 font-sans">
                  <span className="font-bold text-ink">Jakarta (CGK)</span>
                  <span className="material-symbols-outlined text-brand-fg text-[18px]">
                    arrow_forward
                  </span>
                  <span className="font-bold text-ink">Denpasar (DPS)</span>
                </p>
              </div>

              <div className="bg-raised border border-line px-4 py-2.5 rounded-ticket shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                    Jadwal Keberangkatan
                  </div>
                  <div className="text-sm font-bold text-ink tabular-nums">
                    Rabu, 14 Okt 2026 • 07.40 WIB
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isCheckedInSuccess ? (
            /* ─── SUCCESS BOARDING PASS VIEW ─── */
            <div className="bg-raised rounded-ticket border border-line p-6 md:p-10 shadow-lg max-w-2xl mx-auto my-8 text-center animate-fadeInUp">
              <div className="w-16 h-16 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>
              <h2 className="text-2xl font-bold text-ink mb-2">Check-in Online Berhasil!</h2>
              <p className="text-subtle text-sm mb-6 leading-relaxed">
                Boarding pass digital resmi telah terbit untuk seluruh penumpang penerbangan{' '}
                <strong className="text-ink">KA 412</strong>. Silakan unduh atau tunjukkan saat boarding.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left">
                {passengers.map((p) => (
                  <div key={p.id} className="bg-panel border border-line p-4 rounded-ticket relative">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs uppercase font-bold text-brand-fg">BOARDING PASS</span>
                      <span className="text-xs font-mono font-bold bg-tint px-2 py-0.5 rounded">
                        {p.seat}
                      </span>
                    </div>
                    <div className="text-base font-bold text-ink">{p.name}</div>
                    <div className="text-xs text-subtle">{p.nik}</div>
                    <div className="mt-3 pt-3 border-t border-dashed border-line flex justify-between text-xs">
                      <div>
                        <span className="text-subtle block text-[10px] uppercase">Rute</span>
                        <span className="font-bold text-ink">CGK &rarr; DPS</span>
                      </div>
                      <div className="text-right">
                        <span className="text-subtle block text-[10px] uppercase">Waktu</span>
                        <span className="font-bold text-ink">07.40 WIB</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => alert('Mengunduh e-boarding pass PDF (IATA Standard)...')}
                  className="w-full sm:w-auto h-12 px-6 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  <span>Unduh Semua Boarding Pass (PDF)</span>
                </button>
                <Link
                  to="/"
                  className="w-full sm:w-auto h-12 px-6 border border-line bg-panel hover:bg-tint text-ink rounded-control font-semibold text-sm flex items-center justify-center transition-colors"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          ) : (
            /* ─── MAIN WORKSPACE (8 cols Left / 4 cols Right) ─── */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* Left Column (8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Urgent Flight Timing Progress Card */}
                <div className="bg-raised rounded-ticket border border-line p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 text-brand-fg">
                      <span className="material-symbols-outlined text-[20px]">schedule</span>
                      <span className="font-bold text-base font-sans">
                        Check-in ditutup dalam{' '}
                        <span className="tabular-nums font-mono">18j 05m</span>
                      </span>
                    </div>
                    <span className="text-xs text-subtle font-medium">Batas 06.40 WIB</span>
                  </div>
                  <p className="text-xs md:text-sm text-subtle mb-3 leading-relaxed">
                    Check-in online mandiri ditutup tepat 60 menit sebelum keberangkatan sesuai regulasi penerbangan sipil.
                  </p>
                  <div className="w-full bg-page h-2 rounded-full overflow-hidden border border-line/40">
                    <div
                      className="bg-brand-fg h-full rounded-full transition-all duration-500"
                      style={{ width: '72%' }}
                    />
                  </div>
                </div>

                {/* Passenger Selection Area */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-ink font-sans">
                      Pilih Penumpang &amp; Konfigurasi Kursi
                    </h2>
                    <span className="text-xs text-subtle">
                      {passengers.length} dari {passengers.length} Penumpang terverifikasi
                    </span>
                  </div>

                  {passengers.map((passenger) => {
                    const isEditing = editingPassengerId === passenger.id

                    return (
                      <div
                        key={passenger.id}
                        className={`bg-raised rounded-ticket border transition-all p-5 shadow-sm ${
                          isEditing ? 'border-brand-fg ring-1 ring-brand-fg/30' : 'border-line'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              <div className="w-5 h-5 rounded bg-brand text-white flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-[16px]">check</span>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-ink font-sans">
                                  {passenger.name}
                                </span>
                                <span className="bg-tint text-brand-fg text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                  {passenger.type}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-subtle">
                                <span className="font-mono">{passenger.nik}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[15px]">luggage</span>
                                  <span>{passenger.baggage}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end md:self-auto">
                            <div className="flex items-center gap-1.5 bg-panel border border-line px-3 py-1.5 rounded-control shadow-sm">
                              <span className="material-symbols-outlined text-brand-fg text-[18px]">
                                airline_seat_recline_extra
                              </span>
                              <span className="font-bold text-ink tabular-nums text-sm">
                                {passenger.seat}
                              </span>
                              <span className="text-xs text-subtle">({passenger.seatPosition})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingPassengerId(isEditing ? null : passenger.id)
                              }
                              className="text-brand-fg hover:underline text-xs md:text-sm font-semibold transition-colors"
                            >
                              {isEditing ? 'Tutup kursi' : 'Ganti kursi'}
                            </button>
                          </div>
                        </div>

                        {/* Inline Compact Seat Map Module when open */}
                        {isEditing && (
                          <div className="mt-4 pt-4 border-t border-line bg-panel p-4 rounded-control animate-fadeIn">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 mb-3 border-b border-line/60">
                              <div>
                                <div className="text-sm font-bold text-ink">
                                  Pilih Kursi Penerbangan ({passenger.name})
                                </div>
                                <p className="text-xs text-subtle">
                                  Klik salah satu kursi tersedia untuk mengubah posisi.
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-subtle">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3.5 h-3.5 rounded bg-signal" />
                                  <span>Terpilih</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3.5 h-3.5 rounded bg-panel border border-line" />
                                  <span>Tersedia</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3.5 h-3.5 rounded bg-page flex items-center justify-center text-[10px]">
                                    ×
                                  </div>
                                  <span>Terisi</span>
                                </div>
                              </div>
                            </div>

                            {/* Matrix Layout (Rows 13 to 15) */}
                            <div className="relative max-w-sm mx-auto py-2">
                              {/* Hovered Seat Floating Tooltip */}
                              {hoveredSeat && (
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-ink text-panel text-[11px] font-semibold py-1 px-3 rounded-lg shadow-lg pointer-events-none z-20 whitespace-nowrap animate-fadeIn">
                                  Kursi {hoveredSeat} • Bebas Biaya
                                </div>
                              )}

                              {/* Column Labels */}
                              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-subtle mb-2">
                                <div>A</div>
                                <div>B</div>
                                <div>C</div>
                                <div className="text-[9px] uppercase tracking-wider text-subtle flex items-center justify-center">
                                  Lorong
                                </div>
                                <div>D</div>
                                <div>E</div>
                                <div>F</div>
                              </div>

                              {/* Rows */}
                              <div className="space-y-2">
                                {seatConfig.map((row) => (
                                  <div key={row.row} className="grid grid-cols-7 gap-2 items-center">
                                    {row.seats.slice(0, 3).map((seat) => {
                                      const isCurrent = passenger.seat === seat.id
                                      const isOccupied =
                                        seat.status === 'occupied' ||
                                        passengers.some((p) => p.id !== passenger.id && p.seat === seat.id)

                                      return (
                                        <button
                                          key={seat.id}
                                          type="button"
                                          disabled={isOccupied}
                                          onClick={() => handleSeatSelect(seat.id)}
                                          onMouseEnter={() => setHoveredSeat(seat.id)}
                                          onMouseLeave={() => setHoveredSeat(null)}
                                          className={`h-9 rounded-control flex items-center justify-center text-xs font-bold transition-all relative select-none ${
                                            isCurrent
                                              ? 'bg-signal text-white shadow-sm ring-2 ring-signal/30'
                                              : isOccupied
                                              ? 'bg-page text-subtle/40 cursor-not-allowed'
                                              : 'bg-panel border border-line hover:border-brand-fg hover:bg-tint text-ink'
                                          }`}
                                        >
                                          {isCurrent ? (
                                            <span className="material-symbols-outlined text-[16px]">
                                              check
                                            </span>
                                          ) : isOccupied ? (
                                            '×'
                                          ) : (
                                            seat.id
                                          )}
                                        </button>
                                      )
                                    })}

                                    {/* Aisle Row Number */}
                                    <div className="text-center text-xs font-bold text-subtle tabular-nums">
                                      {row.row}
                                    </div>

                                    {row.seats.slice(3, 6).map((seat) => {
                                      const isCurrent = passenger.seat === seat.id
                                      const isOccupied =
                                        seat.status === 'occupied' ||
                                        passengers.some((p) => p.id !== passenger.id && p.seat === seat.id)

                                      return (
                                        <button
                                          key={seat.id}
                                          type="button"
                                          disabled={isOccupied}
                                          onClick={() => handleSeatSelect(seat.id)}
                                          onMouseEnter={() => setHoveredSeat(seat.id)}
                                          onMouseLeave={() => setHoveredSeat(null)}
                                          className={`h-9 rounded-control flex items-center justify-center text-xs font-bold transition-all relative select-none ${
                                            isCurrent
                                              ? 'bg-signal text-white shadow-sm ring-2 ring-signal/30'
                                              : isOccupied
                                              ? 'bg-page text-subtle/40 cursor-not-allowed'
                                              : 'bg-panel border border-line hover:border-brand-fg hover:bg-tint text-ink'
                                          }`}
                                        >
                                          {isCurrent ? (
                                            <span className="material-symbols-outlined text-[16px]">
                                              check
                                            </span>
                                          ) : isOccupied ? (
                                            '×'
                                          ) : (
                                            seat.id
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 text-center text-[11px] text-subtle">
                                Standard Economy • Jarak Antar Kursi 30" (76 cm) • Recline 3"
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Confirmation & Regulatory Declaration Panel */}
                <div className="bg-raised rounded-ticket border border-line p-5 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center gap-3 bg-panel border border-line p-3 rounded-control text-ink">
                    <span className="material-symbols-outlined text-brand-fg text-[20px]">
                      airline_seat_recline_normal
                    </span>
                    <span className="text-xs md:text-sm font-sans">
                      Kursi berdampingan —{' '}
                      <strong>{passengers.length} penumpang</strong> terverifikasi untuk kursi{' '}
                      <strong>{passengers.map((p) => p.seat).join(' dan ')}</strong>.
                    </span>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAgreed}
                      onChange={(e) => setIsAgreed(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-brand border-line focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs md:text-sm text-subtle leading-relaxed">
                      Saya menyatakan bahwa seluruh data penumpang sesuai dengan identitas resmi
                      (KTP/Paspor) yang sah dan saya menyetujui ketentuan keselamatan barang bawaan
                      berbahaya (<em>Dangerous Goods Regulation</em>).
                    </span>
                  </label>
                </div>

                {/* Primary Action Button */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={!isAgreed}
                    onClick={handleCompleteCheckIn}
                    className="w-full h-12 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-base shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>Selesaikan check-in</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                  <div className="flex items-center justify-center gap-1.5 text-subtle text-xs py-1">
                    <span className="material-symbols-outlined text-[16px]">verified_user</span>
                    <span>Enkripsi sertifikat boarding pass IATA standar aviasi internasional</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Rules & Flight Requirements (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-5 sticky top-[92px]">
                {/* Info Rules Panel */}
                <div className="bg-raised rounded-ticket border border-line p-5 shadow-sm">
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-line text-ink">
                    <span className="material-symbols-outlined text-brand-fg text-[20px]">info</span>
                    <h3 className="font-bold text-base font-sans">Aturan Check-in Online</h3>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="font-bold text-subtle uppercase text-[10px] tracking-wider block">
                        Batas Waktu
                      </span>
                      <p className="text-ink mt-0.5 leading-relaxed">
                        Check-in dibuka hingga 1 jam sebelum jadwal terbang (
                        <strong className="tabular-nums">Rabu, 14 Okt, 06.40 WIB</strong>).
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-subtle uppercase text-[10px] tracking-wider block">
                        Boarding Pass
                      </span>
                      <p className="text-ink mt-0.5 leading-relaxed">
                        Langsung terbit seketika setelah check-in berhasil dan dapat diunduh format PDF.
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-subtle uppercase text-[10px] tracking-wider block">
                        Pemeriksaan Gerbang
                      </span>
                      <p className="text-ink mt-0.5 leading-relaxed">
                        Tunjukkan boarding pass digital dan kartu identitas fisik di Terminal 3 Domestik.
                      </p>
                    </div>

                    <div className="bg-panel border border-line p-3 rounded-control">
                      <span className="font-bold text-brand-fg uppercase text-[10px] tracking-wider block">
                        Bagasi Tercatat
                      </span>
                      <p className="text-ink mt-0.5 leading-relaxed">
                        Bagi penumpang dengan bagasi tercatat (<strong>Dimas Pratama</strong>), lapor
                        di drop counter KA 18-22 sebelum <strong>06.50 WIB</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dangerous Goods Warning */}
                <div className="bg-raised rounded-ticket border border-line p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-danger">
                    <span className="material-symbols-outlined text-[20px]">warning</span>
                    <h4 className="font-bold text-sm font-sans text-ink">Ketentuan Bagasi Aman</h4>
                  </div>
                  <p className="text-xs text-subtle mb-3 leading-relaxed">
                    Dilarang membawa barang berbahaya dalam kabin maupun tercatat sesuai standar ICAO:
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-panel border border-line p-2 rounded-control flex flex-col items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-subtle text-[20px]">
                        battery_alert
                      </span>
                      <span className="text-[10px] text-ink font-semibold leading-tight">
                        Powerbank &gt;20k mAh
                      </span>
                    </div>

                    <div className="bg-panel border border-line p-2 rounded-control flex flex-col items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-subtle text-[20px]">
                        propane_tank
                      </span>
                      <span className="text-[10px] text-ink font-semibold leading-tight">
                        Gas Kompresi
                      </span>
                    </div>

                    <div className="bg-panel border border-line p-2 rounded-control flex flex-col items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-subtle text-[20px]">
                        water_drop
                      </span>
                      <span className="text-[10px] text-ink font-semibold leading-tight">
                        Cairan &gt;100 ml
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aircraft Type Card */}
                <div className="bg-panel border border-line rounded-ticket p-4 flex items-center justify-between text-ink shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-brand-fg text-[24px]">
                      flight
                    </span>
                    <div>
                      <div className="text-sm font-bold">Boeing 737-800NG</div>
                      <div className="text-xs text-subtle">Konfigurasi Kabin 3-3</div>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase bg-tint text-brand-fg px-2.5 py-0.5 rounded-full font-bold">
                    On Time
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Operational Toast Notification */}
        {toastMessage && (
          <aside
            aria-label="Notifikasi sistem"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-raised border border-line text-ink px-4 py-3 rounded-ticket shadow-2xl animate-fadeIn"
          >
            <div className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[16px]">check</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-ink">{toastMessage}</span>
              <span className="text-[10px] text-subtle">Sinkronisasi data langsung</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-subtle hover:text-ink ml-2 p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </main>

      <Footer />
    </div>
  )
}
