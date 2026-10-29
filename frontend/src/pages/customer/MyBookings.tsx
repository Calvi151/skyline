import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface BookingItem {
  id: number
  booking_code: string
  total_price: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  created_at: string
  expires_at: string
  passenger_count: number
  flight?: {
    id: number
    flight_number: string
    airline?: { name: string; code: string; logo?: string | null } | null
    status: 'scheduled' | 'delayed' | 'cancelled'
    delay_minutes: number
    departure_time: string | null
    arrival_time: string | null
    origin?: { code: string; city: string; name: string } | null
    destination?: { code: string; city: string; name: string } | null
  } | null
}

export default function MyBookings() {
  const { user } = useAuthStore()

  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Fetch current user's bookings
  const fetchMyBookings = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await api.get<{ data: BookingItem[] }>('/bookings/my')
      if (Array.isArray(res?.data)) {
        setBookings(res.data)
      } else if (Array.isArray((res as any)?.data?.data)) {
        setBookings((res as any).data.data)
      } else {
        setBookings([])
      }
    } catch (err: any) {
      console.error('Failed to load my bookings:', err)
      setErrorMsg(err?.message || 'Gagal memuat daftar pesanan Anda.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyBookings()
  }, [])

  // Classify bookings into 'upcoming' and 'history'
  const { upcomingBookings, historyBookings } = useMemo(() => {
    const now = new Date().getTime()
    const upcoming: BookingItem[] = []
    const history: BookingItem[] = []

    bookings.forEach((b) => {
      const depTime = b.flight?.departure_time ? new Date(b.flight.departure_time).getTime() : 0
      const isPast = depTime > 0 && depTime < now

      if (b.status === 'cancelled' || b.status === 'refunded' || isPast) {
        history.push(b)
      } else {
        upcoming.push(b)
      }
    })

    return { upcomingBookings: upcoming, historyBookings: history }
  }, [bookings])

  // Filter based on active tab and search query
  const displayedBookings = useMemo(() => {
    const list = activeTab === 'upcoming' ? upcomingBookings : historyBookings
    if (!searchQuery.trim()) return list

    const q = searchQuery.toLowerCase().trim()
    return list.filter((b) => {
      const codeMatch = b.booking_code?.toLowerCase().includes(q)
      const origMatch = b.flight?.origin?.city?.toLowerCase().includes(q) || b.flight?.origin?.code?.toLowerCase().includes(q)
      const destMatch = b.flight?.destination?.city?.toLowerCase().includes(q) || b.flight?.destination?.code?.toLowerCase().includes(q)
      const flightNumMatch = b.flight?.flight_number?.toLowerCase().includes(q)
      const airlineMatch = b.flight?.airline?.name?.toLowerCase().includes(q)
      return codeMatch || origMatch || destMatch || flightNumMatch || airlineMatch
    })
  }, [activeTab, upcomingBookings, historyBookings, searchQuery])

  // Helpers
  const formatRupiah = (val?: number | string | null) => {
    if (!val) return 'Rp 0'
    return `Rp ${Number(val).toLocaleString('id-ID')}`
  }

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return '--:--'
    }
  }

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '---'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return '---'
    }
  }

  // Calculate minutes remaining for pending bookings (1-hour window)
  const getMinutesRemaining = (createdAtIso?: string) => {
    if (!createdAtIso) return 0
    const createdTime = new Date(createdAtIso).getTime()
    const expiresTime = createdTime + 60 * 60 * 1000
    const now = Date.now()
    return Math.max(0, Math.floor((expiresTime - now) / (1000 * 60)))
  }

  // Check if check-in is currently open (24 hours before flight)
  const isCheckinAvailable = (departureTimeIso?: string | null, status?: string) => {
    if (status !== 'paid' || !departureTimeIso) return false
    const dep = new Date(departureTimeIso).getTime()
    const now = Date.now()
    const diffHours = (dep - now) / (1000 * 60 * 60)
    return diffHours <= 24 && diffHours > 0
  }

  // Download PDF e-ticket
  const handleDownloadPDF = async (b: BookingItem) => {
    setDownloadingId(b.id)
    try {
      const res = await api.get(`/bookings/${b.id}/e-ticket`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `eticket-${b.booking_code}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setToastMessage(`E-tiket PDF ${b.booking_code} berhasil diunduh.`)
      setTimeout(() => setToastMessage(null), 4000)
    } catch (err: any) {
      console.error('Download error:', err)
      setToastMessage('Gagal mengunduh e-tiket PDF.')
      setTimeout(() => setToastMessage(null), 4000)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between antialiased">
      <Navbar />

      <main className="w-full pt-[72px] flex-1 pb-20">
        <div className="w-full max-w-content mx-auto px-4 md:px-6 py-6 sm:py-10">
          {/* ─── Header Context & User Badge (Stitch B9) ─── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-subtle mb-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-brand-fg">
                  Portal Penumpang
                </span>
                <span className="inline-block w-1 h-1 rounded-full bg-subtle"></span>
                <span className="uppercase tracking-wider font-medium">
                  {user?.name || 'Pelanggan'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                Pesanan saya
              </h1>
            </div>

            {/* Quick Action / Status Digest */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-panel border border-line px-3 py-1.5 rounded-control text-xs text-subtle font-medium">
                <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">
                  shield
                </span>
                <span>Perlindungan tiket aktif</span>
              </div>
              <div className="text-right hidden sm:block text-xs">
                <span className="block font-bold text-[10px] text-subtle uppercase">Zona Waktu</span>
                <span className="font-semibold tabular-nums text-ink">WIB / GMT+7</span>
              </div>
            </div>
          </div>

          {/* ─── Informational Banner ─── */}
          <div className="flex items-center justify-between gap-4 bg-tint/60 border border-brand-fg/20 p-4 rounded-ticket mb-8">
            <div className="flex items-center gap-3 text-ink text-xs sm:text-sm">
              <span className="material-symbols-outlined text-brand-fg text-[22px] shrink-0">
                info
              </span>
              <p>
                Check-in online dibuka 24 jam sebelum jadwal keberangkatan untuk seluruh penerbangan yang sudah dibayar lunas.
              </p>
            </div>
            <Link
              to="/check-in"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-brand-fg hover:underline whitespace-nowrap"
            >
              <span>Panduan check-in</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          {/* ─── Tabs and Filter Toolbar (Stitch B9) ─── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-6 border-b border-line">
            {/* Tabs Segment */}
            <div className="flex items-center gap-6">
              {/* Tab 1: Akan Datang */}
              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`relative pb-2 flex items-center gap-2 text-sm font-bold transition-colors ${
                  activeTab === 'upcoming'
                    ? 'text-brand-fg'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span>Akan datang</span>
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeTab === 'upcoming'
                      ? 'bg-brand text-white'
                      : 'bg-panel border border-line text-subtle'
                  }`}
                >
                  {upcomingBookings.length}
                </span>
                {activeTab === 'upcoming' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-fg rounded-full"></span>
                )}
              </button>

              {/* Tab 2: Riwayat */}
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`relative pb-2 flex items-center gap-2 text-sm font-bold transition-colors ${
                  activeTab === 'history'
                    ? 'text-brand-fg'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span>Riwayat</span>
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeTab === 'history'
                      ? 'bg-brand text-white'
                      : 'bg-panel border border-line text-subtle'
                  }`}
                >
                  {historyBookings.length}
                </span>
                {activeTab === 'history' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-fg rounded-full"></span>
                )}
              </button>
            </div>

            {/* Search Input Toolbar */}
            <div className="relative w-full lg:w-80">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode booking atau kota tujuan"
                className="w-full h-10 pl-9 pr-4 bg-raised border border-line rounded-control text-ink placeholder:text-subtle text-xs focus:outline-none focus:ring-2 focus:ring-brand-fg/30 transition-all"
              />
            </div>
          </div>

          {/* ─── Loading State ─── */}
          {loading && (
            <div className="py-16 text-center">
              <div className="w-9 h-9 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-subtle text-xs">Memuat pesanan tiket Anda...</p>
            </div>
          )}

          {/* ─── Error State ─── */}
          {errorMsg && (
            <div className="p-4 bg-danger/10 border border-danger/30 rounded-ticket text-danger text-sm flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={fetchMyBookings}
                className="text-xs font-semibold underline hover:no-underline"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* ─── Empty State ─── */}
          {!loading && !errorMsg && displayedBookings.length === 0 && (
            <div className="bg-raised border border-line rounded-ticket p-12 text-center max-w-md mx-auto space-y-4 my-8 shadow-xs">
              <div className="w-14 h-14 rounded-full bg-tint text-brand-fg flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[32px]">
                  {activeTab === 'upcoming' ? 'flight_takeoff' : 'history'}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-ink text-base">
                  {searchQuery
                    ? 'Tidak ada pesanan yang cocok'
                    : activeTab === 'upcoming'
                    ? 'Belum ada pesanan aktif'
                    : 'Belum ada riwayat pesanan'}
                </h3>
                <p className="text-xs text-subtle mt-1 leading-relaxed">
                  {searchQuery
                    ? `Tidak ditemukan tiket dengan kata kunci "${searchQuery}". Periksa kembali kode reservasi atau kota.`
                    : activeTab === 'upcoming'
                    ? 'Mulai rencanakan penerbangan liburan atau perjalanan bisnis Anda bersama SkyBook.'
                    : 'Tiket penerbangan yang telah selesai digunakan atau dibatalkan akan tersimpan di sini.'}
                </p>
              </div>
              {activeTab === 'upcoming' && !searchQuery && (
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand text-white font-semibold text-xs shadow-sm hover:bg-brand-hover transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                  <span>Cari Penerbangan Sekarang</span>
                </Link>
              )}
            </div>
          )}

          {/* ─── Bookings List Rows (Stitch B9 Design) ─── */}
          {!loading && !errorMsg && displayedBookings.length > 0 && (
            <div className="space-y-4">
              {displayedBookings.map((b) => {
                const flight = b.flight
                const isPaid = b.status === 'paid'
                const isPending = b.status === 'pending'
                const isCancelled = b.status === 'cancelled' || flight?.status === 'cancelled'
                const isDelayed = flight?.status === 'delayed' && (flight.delay_minutes || 0) > 0
                const checkinActive = isCheckinAvailable(flight?.departure_time, b.status)
                const minsLeft = isPending ? getMinutesRemaining(b.created_at) : 0
                const progressPct = Math.min(100, Math.max(0, (minsLeft / 60) * 100))

                return (
                  <div
                    key={b.id}
                    className={`group relative bg-raised hover:bg-tint/30 border border-line rounded-ticket p-5 sm:p-6 transition-all duration-200 shadow-xs ${
                      isCancelled ? 'opacity-85' : ''
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      {/* Flight Segment Main (Cols 1-8) */}
                      <div className="lg:col-span-8 flex flex-col gap-4">
                        {/* Top Metadata Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {/* Airline Brand Tag */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-panel border border-line rounded-control shadow-2xs">
                              <span className="material-symbols-outlined text-[16px] text-brand-fg">
                                airlines
                              </span>
                              <span className="font-bold text-xs uppercase tracking-wider text-ink">
                                {flight?.airline?.name || 'SkyBook Air'}
                              </span>
                              <span className="text-subtle text-xs">•</span>
                              <span className="text-xs font-mono font-bold text-subtle">
                                {flight?.flight_number || 'KA 412'}
                              </span>
                            </div>
                            <span className="text-xs text-subtle">
                              {formatDate(flight?.departure_time)}
                            </span>
                          </div>

                          {/* Status Badge */}
                          {isPaid && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold uppercase">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              <span>{checkinActive ? 'Check-in Dibuka' : 'Dibayar'}</span>
                            </div>
                          )}

                          {isPending && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold uppercase">
                              <span className="material-symbols-outlined text-[14px]">timer</span>
                              <span>Menunggu pembayaran • Sisa {minsLeft} mnt</span>
                            </div>
                          )}

                          {isCancelled && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-danger/10 text-danger text-[11px] font-bold uppercase">
                              <span className="material-symbols-outlined text-[14px]">cancel</span>
                              <span>
                                {flight?.status === 'cancelled'
                                  ? 'Dibatalkan maskapai'
                                  : 'Dibatalkan • Batas bayar lewat'}
                              </span>
                            </div>
                          )}

                          {b.status === 'refunded' && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-subtle/15 text-subtle text-[11px] font-bold uppercase">
                              <span className="material-symbols-outlined text-[14px]">remove_circle_outline</span>
                              <span>Dana Dikembalikan</span>
                            </div>
                          )}
                        </div>

                        {/* Revisi Data Real: Peringatan Keterlambatan */}
                        {isDelayed && (
                          <div className="flex items-center gap-1.5 text-danger text-xs font-semibold">
                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                            <span>
                              Tertunda {flight?.delay_minutes} menit • Perkiraan waktu diperbarui
                            </span>
                          </div>
                        )}

                        {/* Visual Route & IATA Layout */}
                        <div className="grid grid-cols-12 items-center gap-2 py-1">
                          {/* Origin */}
                          <div className="col-span-4 flex flex-col">
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl sm:text-3xl font-bold text-ink leading-none">
                                {flight?.origin?.code || 'CGK'}
                              </span>
                              <span className="text-sm sm:text-base font-bold tabular-nums text-ink">
                                {formatTime(flight?.departure_time)}
                              </span>
                            </div>
                            <span className="text-xs text-subtle truncate mt-0.5">
                              {flight?.origin?.city || 'Jakarta'} ({flight?.origin?.name || 'Soekarno-Hatta'})
                            </span>
                          </div>

                          {/* Flight Duration & Vector */}
                          <div className="col-span-4 flex flex-col items-center px-2">
                            <span className="text-[10px] font-bold uppercase text-subtle mb-1">
                              Langsung
                            </span>
                            <div className="w-full flex items-center relative py-1">
                              <div className="w-full h-[2px] bg-brand-fg/30 rounded-full"></div>
                              <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-fg text-[16px] bg-raised rounded-full p-0.5 shadow-2xs">
                                flight
                              </span>
                            </div>
                            <span className="text-[11px] text-brand-fg font-medium mt-1">
                              Kelas Ekonomi
                            </span>
                          </div>

                          {/* Destination */}
                          <div className="col-span-4 flex flex-col items-end text-right">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm sm:text-base font-bold tabular-nums text-ink">
                                {formatTime(flight?.arrival_time)}
                              </span>
                              <span className="text-2xl sm:text-3xl font-bold text-ink leading-none">
                                {flight?.destination?.code || 'DPS'}
                              </span>
                            </div>
                            <span className="text-xs text-subtle truncate mt-0.5">
                              {flight?.destination?.city || 'Denpasar'} ({flight?.destination?.name || 'Ngurah Rai'})
                            </span>
                          </div>
                        </div>

                        {/* Passenger Details & Time limit countdown */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-subtle">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-subtle">group</span>
                            <span className="font-semibold text-ink">
                              {b.passenger_count || 1} Penumpang
                            </span>
                          </div>

                          {/* Live Countdown for Pending Payment */}
                          {isPending && (
                            <div className="flex items-center gap-2 min-w-[180px]">
                              <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-fg rounded-full transition-all duration-1000"
                                  style={{ width: `${progressPct}%` }}
                                ></div>
                              </div>
                              <span className="text-[11px] font-bold text-brand-fg tabular-nums whitespace-nowrap">
                                {minsLeft} mnt
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ticket Stub & Action Column (Cols 9-12) */}
                      <div className="lg:col-span-4 flex flex-col justify-between items-start lg:items-end lg:pl-6 lg:border-l lg:border-line gap-4">
                        <div className="w-full flex lg:flex-col justify-between items-start lg:items-end">
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-subtle">
                              Kode Booking
                            </span>
                            <span className="text-lg sm:text-xl font-bold font-mono tracking-wider text-ink">
                              {b.booking_code}
                            </span>
                          </div>
                          <div className="text-right lg:mt-1.5">
                            <span className="block text-[10px] font-bold uppercase text-subtle">
                              {isPending ? 'Total Tagihan' : 'Total Biaya'}
                            </span>
                            <span className="text-sm sm:text-base font-bold tabular-nums text-brand-fg">
                              {formatRupiah(b.total_price)}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons Group */}
                        <div className="w-full flex flex-col sm:flex-row lg:flex-col gap-2">
                          {isPaid && (
                            <>
                              {checkinActive ? (
                                <Link
                                  to={`/check-in?booking=${b.booking_code}`}
                                  className="w-full h-10 inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold shadow-sm transition-all"
                                >
                                  <span className="material-symbols-outlined text-[16px]">airplane_ticket</span>
                                  <span>Check-in online</span>
                                </Link>
                              ) : (
                                <Link
                                  to={`/bookings/${b.id}`}
                                  className="w-full h-10 inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold shadow-sm transition-all"
                                >
                                  <span className="material-symbols-outlined text-[16px]">confirmation_number</span>
                                  <span>Lihat e-tiket</span>
                                </Link>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDownloadPDF(b)}
                                disabled={downloadingId === b.id}
                                className="w-full h-9 inline-flex items-center justify-center gap-1.5 bg-panel border border-line hover:bg-tint text-ink rounded-control text-xs font-medium transition-colors"
                              >
                                <span className="material-symbols-outlined text-[15px] text-subtle">
                                  {downloadingId === b.id ? 'hourglass_top' : 'download'}
                                </span>
                                <span>{downloadingId === b.id ? 'Mengunduh...' : 'Unduh PDF'}</span>
                              </button>
                            </>
                          )}

                          {isPending && (
                            <Link
                              to={`/checkout/${b.id}`}
                              className="w-full h-11 inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
                            >
                              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                              <span>Bayar sekarang</span>
                            </Link>
                          )}

                          {isCancelled && (
                            <Link
                              to={`/bookings/${b.id}`}
                              className="w-full h-10 inline-flex items-center justify-center gap-1.5 bg-panel border border-line hover:bg-tint text-ink rounded-control text-xs font-semibold transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                              <span>Detail &amp; Refund</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ─── Editorial Logistics Footer Note ─── */}
          <div className="mt-12 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between text-xs text-subtle gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-brand-fg">support_agent</span>
              <span>Butuh perubahan jadwal atau pembatalan darurat? Hubungi Layanan Tiket 24 Jam SkyBook.</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/#faq" className="hover:text-ink transition-colors">
                Ketentuan Bagasi
              </Link>
              <span>•</span>
              <Link to="/#faq" className="hover:text-ink transition-colors">
                Kebijakan Refund
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Floating Toast Alert ─── */}
      {toastMessage && (
        <aside className="fixed bottom-6 right-6 z-40 max-w-md bg-raised text-ink border border-line p-4 rounded-ticket shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-tint flex items-center justify-center text-brand-fg shrink-0">
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            </div>
            <p className="text-xs font-medium text-ink">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-subtle hover:text-ink p-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </aside>
      )}

      <Footer />
    </div>
  )
}
