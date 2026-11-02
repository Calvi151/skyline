import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface RefundItem {
  id: number
  booking_id: number
  booking_code: string | null
  flight_number: string | null
  route: string | null
  departure_time: string | null
  reason: string
  refund_amount: number
  status: 'pending' | 'approved' | 'rejected' | 'refunded'
  kind?: string
  requested_at: string | null
  processed_at: string | null
  is_auto_approved?: boolean
}

interface EligibleBooking {
  booking_id: number
  booking_code: string
  total_price: number
  flight_number: string
  airline_name: string
  route: string
  departure_time: string
  hours_remaining: number
  is_flight_cancelled: boolean
  is_cooling_off: boolean
  cancellation_fee: number
  admin_fee: number
  estimated_refund_amount: number
}

export default function MyRefunds() {
  const { user } = useAuthStore()

  const [refunds, setRefunds] = useState<RefundItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Modal State for New Refund Request
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [eligibleBookings, setEligibleBookings] = useState<EligibleBooking[]>([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Fetch customer's refunds
  const fetchRefunds = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ error: boolean; data: RefundItem[] }>('/refunds/my')
      if (Array.isArray(res.data?.data)) {
        setRefunds(res.data.data)
      } else if (Array.isArray((res as any).data)) {
        setRefunds((res as any).data)
      } else {
        setRefunds([])
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat refund:', err)
      setRefunds([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch bookings eligible for refund
  const fetchEligibleBookings = async () => {
    setLoadingEligible(true)
    setModalError(null)
    try {
      const res = await api.get<{ error: boolean; data: EligibleBooking[] }>('/refunds/eligible')
      const items = res.data?.data || []
      setEligibleBookings(items)
      if (items.length > 0) {
        setSelectedBookingId(items[0].booking_id)
        if (items[0].is_flight_cancelled) {
          setRefundReason('Penerbangan dibatalkan oleh pihak maskapai.')
        } else {
          setRefundReason('')
        }
      } else {
        setSelectedBookingId(null)
      }
    } catch (err: any) {
      console.error('Gagal memuat tiket yang memenuhi syarat:', err)
      setModalError('Gagal memuat tiket aktif yang dapat diajukan refund.')
    } finally {
      setLoadingEligible(false)
    }
  }

  useEffect(() => {
    fetchRefunds()
  }, [])

  // Open Request Modal
  const handleOpenModal = () => {
    setIsModalOpen(true)
    fetchEligibleBookings()
  }

  const handleCloseModal = () => {
    if (submitting) return
    setIsModalOpen(false)
    setSelectedBookingId(null)
    setRefundReason('')
    setModalError(null)
  }

  // Handle selected booking change
  const handleSelectBooking = (bId: number) => {
    setSelectedBookingId(bId)
    const found = eligibleBookings.find((b) => b.booking_id === bId)
    if (found?.is_flight_cancelled) {
      setRefundReason('Penerbangan dibatalkan oleh pihak maskapai.')
    } else if (refundReason === 'Penerbangan dibatalkan oleh pihak maskapai.') {
      setRefundReason('')
    }
  }

  // Currently selected booking in modal
  const selectedBooking = useMemo(() => {
    return eligibleBookings.find((b) => b.booking_id === selectedBookingId) || null
  }, [eligibleBookings, selectedBookingId])

  // Submit Refund Request
  const handleSubmitRefund = async () => {
    if (!selectedBooking) {
      setModalError('Pilih pesanan yang ingin diajukan refund.')
      return
    }

    if (!selectedBooking.is_flight_cancelled && refundReason.trim().length < 10) {
      setModalError('Harap berikan alasan refund yang jelas (minimal 10 karakter).')
      return
    }

    setSubmitting(true)
    setModalError(null)

    try {
      const res = await api.post<{
        error: boolean
        message: string
        data: any
      }>('/refunds', {
        booking_id: selectedBooking.booking_id,
        reason: refundReason.trim() || 'Penerbangan dibatalkan maskapai',
      })

      setIsModalOpen(false)
      setToastMessage(res.data?.message || 'Pengajuan refund Anda berhasil dikirim!')
      fetchRefunds()
    } catch (err: any) {
      console.error('Gagal mengajukan refund:', err)
      setModalError(
        err.response?.data?.message || 'Gagal mengajukan permohonan refund. Silakan coba kembali.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Copy PNR to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
    setCopiedCode(code)
    setToastMessage(`Kode booking ${code} berhasil disalin!`)
    setTimeout(() => setCopiedCode(null), 3000)
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Formatting helpers
  const formatIDR = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID')
  }

  const formatDate = (iso?: string | null) => {
    if (!iso) return '---'
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Metrics
  const pendingCount = refunds.filter((r) => r.status === 'pending').length
  const approvedCount = refunds.filter((r) => r.status === 'approved' || r.status === 'refunded').length
  const rejectedCount = refunds.filter((r) => r.status === 'rejected').length
  const totalAmountRefunded = refunds
    .filter((r) => r.status === 'approved' || r.status === 'refunded')
    .reduce((sum, r) => sum + Number(r.refund_amount || 0), 0)

  // Filtered List
  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (activeTab === 'pending' && r.status !== 'pending') return false
      if (activeTab === 'approved' && r.status !== 'approved' && r.status !== 'refunded') return false
      if (activeTab === 'rejected' && r.status !== 'rejected') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchCode = (r.booking_code || '').toLowerCase().includes(q)
        const matchFlight = (r.flight_number || '').toLowerCase().includes(q)
        const matchRoute = (r.route || '').toLowerCase().includes(q)
        if (!matchCode && !matchFlight && !matchRoute) return false
      }

      return true
    })
  }, [refunds, activeTab, searchQuery])

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col justify-between antialiased selection:bg-brand selection:text-white">
      <Navbar />

      <main className="w-full pt-[72px] flex-1 pb-20">
        <div className="w-full max-w-content mx-auto px-4 md:px-6 py-6 sm:py-10 flex flex-col gap-8">
          {/* ─── BREADCRUMB & HEADER ─── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-line">
            <div className="flex flex-col gap-1.5 max-w-2xl">
              <div className="flex items-center gap-1.5 text-xs text-subtle uppercase tracking-wider font-semibold">
                <Link to="/dashboard" className="hover:text-brand-fg transition-colors">
                  Pesanan Saya
                </Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-brand-fg font-bold">Pusat Refund</span>
                {user?.name && (
                  <>
                    <span className="inline-block w-1 h-1 rounded-full bg-subtle" />
                    <span className="text-ink lowercase font-medium">{user.name}</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-ink tracking-tight">
                Pusat Refund &amp; Pembatalan
              </h1>
              <p className="text-xs sm:text-sm text-subtle leading-relaxed">
                Kelola pengembalian dana tiket pesawat Anda secara mandiri dengan transparansi penuh status verifikasi maskapai dan kalkulasi dana sesuai regulasi aviasi.
              </p>
            </div>

            {/* Main Action Button */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleOpenModal}
                className="h-11 px-5 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-xs sm:text-sm tracking-wide shadow-sm hover:shadow transition-all flex items-center gap-2 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Ajukan Refund Baru</span>
              </button>
            </div>
          </div>

          {/* ─── QUICK METRICS STATS BAR ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-panel border border-line p-4 rounded-ticket shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand" />
                Total Diajukan
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-ink">
                  {refunds.length}
                </span>
                <span className="text-xs text-subtle font-medium">Permohonan</span>
              </div>
            </div>

            <div className="bg-panel border border-line p-4 rounded-ticket shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Menunggu Review
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {pendingCount}
                </span>
                <span className="text-xs text-subtle font-medium">Dalam Antrean</span>
              </div>
            </div>

            <div className="bg-panel border border-line p-4 rounded-ticket shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Disetujui / Selesai
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {approvedCount}
                </span>
                <span className="text-xs text-subtle font-medium">Pengembalian</span>
              </div>
            </div>

            <div className="bg-panel border border-line p-4 rounded-ticket shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-fg" />
                Total Dana Kembali
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold font-mono text-brand-fg truncate">
                  {formatIDR(totalAmountRefunded)}
                </span>
                <span className="text-xs text-subtle font-medium">Tercairkan</span>
              </div>
            </div>
          </div>

          {/* ─── FILTER TABS & SEARCH BAR ─── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-raised border border-line p-1 rounded-control overflow-x-auto shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-panel text-brand-fg shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span>Semua</span>
                <span className="px-1.5 py-0.2 rounded-full bg-tint text-[10px] tabular-nums font-bold">
                  {refunds.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'pending'
                    ? 'bg-panel text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span>Menunggu</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] tabular-nums font-bold">
                  {pendingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('approved')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'approved'
                    ? 'bg-panel text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span>Disetujui</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] tabular-nums font-bold">
                  {approvedCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rejected')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'rejected'
                    ? 'bg-panel text-danger shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                <span>Ditolak</span>
                <span className="px-1.5 py-0.2 rounded-full bg-danger/10 text-danger text-[10px] tabular-nums font-bold">
                  {rejectedCount}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode booking atau rute..."
                className="w-full h-10 pl-9 pr-8 rounded-control bg-panel border border-line text-ink placeholder:text-subtle text-xs focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* ─── REFUND LIST CARDS (Dribbble/Traveloka UX Standard) ─── */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-subtle">
              <div className="w-9 h-9 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Memuat riwayat pengajuan refund...</span>
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="bg-panel border border-line rounded-ticket p-10 sm:p-14 text-center flex flex-col items-center justify-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-tint text-brand-fg flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[32px]">assignment_turned_in</span>
              </div>
              <h3 className="text-lg font-bold text-ink">
                {searchQuery
                  ? 'Tidak ada pengajuan yang cocok dengan pencarian'
                  : activeTab !== 'all'
                  ? 'Tidak ada refund dalam kategori ini'
                  : 'Belum ada pengajuan refund'}
              </h3>
              <p className="text-xs sm:text-sm text-subtle max-w-md mt-1.5 mb-6 leading-relaxed">
                {searchQuery
                  ? 'Coba periksa kembali kata kunci pencarian kode booking atau rute Anda.'
                  : 'Semua tiket penerbangan Anda berjalan normal. Anda dapat mengajukan refund sewaktu-waktu jika ada perubahan rencana penerbangan.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="h-10 px-5 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold transition-all shadow-xs"
                >
                  Ajukan Refund Tiket
                </button>
                <Link
                  to="/dashboard"
                  className="h-10 px-5 border border-line bg-raised hover:bg-tint text-ink rounded-control text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">confirmation_number</span>
                  <span>Lihat Pesanan Saya</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {filteredRefunds.map((refund) => {
                const isPending = refund.status === 'pending'
                const isApproved = refund.status === 'approved' || refund.status === 'refunded'
                const isRejected = refund.status === 'rejected'

                return (
                  <div
                    key={refund.id}
                    className="bg-panel border border-line rounded-ticket shadow-xs hover:border-brand/40 transition-all overflow-hidden"
                  >
                    {/* Card Top: Flight & Status Header */}
                    <div className="p-4 sm:p-5 border-b border-line bg-raised/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-control bg-tint text-brand-fg flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm sm:text-base text-ink">
                              {refund.flight_number || 'Penerbangan Domestik'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-tint text-brand-fg">
                              {refund.route || '---'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-subtle">
                            <span>Kode Booking (PNR):</span>
                            <strong className="font-mono font-bold text-brand-fg">
                              {refund.booking_code || `BK-${refund.booking_id}`}
                            </strong>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(refund.booking_code || '')}
                              className="text-subtle hover:text-ink text-[11px] flex items-center gap-0.5"
                              title="Salin PNR"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {copiedCode === refund.booking_code ? 'check' : 'content_copy'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Menunggu Verifikasi</span>
                          </span>
                        )}
                        {isApproved && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              <span>Disetujui</span>
                            </span>
                            {refund.is_auto_approved && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-brand/10 text-brand-fg border border-brand/20">
                                <span>⚡ Auto</span>
                              </span>
                            )}
                          </div>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20">
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            <span>Permohonan Ditolak</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body: Interactive Stepper & Financial Breakdown */}
                    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      {/* Left: Visual Progress Stepper (7 Cols) */}
                      <div className="lg:col-span-7 flex flex-col gap-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                          Tahapan Proses Refund
                        </span>

                        {/* Progress Stepper Line */}
                        <div className="relative flex items-center justify-between">
                          {/* Background Connector Bar */}
                          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-line -z-0" />
                          <div
                            className={`absolute left-4 top-1/2 -translate-y-1/2 h-1 -z-0 transition-all ${
                              isApproved
                                ? 'right-4 bg-emerald-500'
                                : isRejected
                                ? 'right-4 bg-danger'
                                : 'right-1/2 bg-amber-500'
                            }`}
                          />

                          {/* Node 1: Diajukan */}
                          <div className="flex flex-col items-center gap-1.5 bg-panel px-1.5 z-10 text-center">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            </div>
                            <span className="text-[11px] font-semibold text-ink">Diajukan</span>
                            <span className="text-[10px] text-subtle tabular-nums">
                              {formatDate(refund.requested_at)}
                            </span>
                          </div>

                          {/* Node 2: Verifikasi Maskapai */}
                          <div className="flex flex-col items-center gap-1.5 bg-panel px-1.5 z-10 text-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                                isApproved
                                  ? 'bg-emerald-500 text-white'
                                  : isRejected
                                  ? 'bg-danger text-white'
                                  : 'bg-amber-500 text-white animate-pulse'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isApproved ? 'check' : isRejected ? 'close' : 'sync'}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-ink">Verifikasi Maskapai</span>
                            <span className="text-[10px] text-subtle">
                              {isPending
                                ? 'Sedang ditinjau'
                                : isApproved
                                ? 'Terverifikasi'
                                : 'Tidak disetujui'}
                            </span>
                          </div>

                          {/* Node 3: Pengembalian Dana */}
                          <div className="flex flex-col items-center gap-1.5 bg-panel px-1.5 z-10 text-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                                isApproved
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-raised text-subtle border border-line'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isApproved ? 'payments' : 'hourglass_empty'}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-ink">Pencairan Dana</span>
                            <span className="text-[10px] text-subtle">
                              {isApproved
                                ? 'Dana dikembalikan'
                                : isRejected
                                ? 'Dibatalkan'
                                : 'Menunggu persetujuan'}
                            </span>
                          </div>
                        </div>

                        {/* Customer Reason Box */}
                        <div className="mt-2 p-3 bg-raised rounded-control border border-line text-xs">
                          <span className="text-[10px] uppercase font-bold text-subtle block mb-0.5">
                            Alasan Permohonan:
                          </span>
                          <p className="text-ink leading-relaxed">
                            “{refund.reason || 'Tidak ada alasan yang disertakan.'}”
                          </p>
                        </div>

                        {/* Rejection Alert If Rejected */}
                        {isRejected && (
                          <div className="p-3 bg-danger/10 border border-danger/20 rounded-control text-xs text-danger flex items-start gap-2">
                            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                              info
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <strong className="font-bold">Permohonan Tidak Disetujui Maskapai</strong>
                              <p className="text-[11px] leading-relaxed text-danger/90">
                                Permohonan refund ini tidak dapat diproses karena tidak memenuhi ketentuan tarif tiket penerbangan atau regulasi batas waktu jendela keberangkatan armada (CASR 185). Tiket Anda tetap berlaku jika belum melewati jam terbang.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Financial Amount Box (5 Cols) */}
                      <div className="lg:col-span-5 bg-raised p-4 sm:p-5 rounded-ticket border border-line flex flex-col justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-subtle">
                            Nilai Pengembalian Bersih
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-bold font-mono text-brand-fg">
                              {formatIDR(refund.refund_amount)}
                            </span>
                          </div>
                          <span className="text-[11px] text-subtle">
                            {refund.kind === 'flight_cancelled'
                              ? 'Pengembalian 100% penuh tanpa potongan (Disrupsi Armada)'
                              : 'Telah dipotong biaya pembatalan 20% & biaya administrasi'}
                          </span>
                        </div>

                        <div className="pt-3 border-t border-line flex flex-col gap-1.5 text-xs text-subtle">
                          <div className="flex items-center justify-between">
                            <span>Metode Pengembalian:</span>
                            <strong className="text-ink font-semibold">Rekening / Saldo Awal</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Jadwal Keberangkatan:</span>
                            <strong className="text-ink font-semibold">
                              {formatDate(refund.departure_time)}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Waktu Selesai:</span>
                            <strong className="text-ink font-semibold">
                              {refund.processed_at ? formatDate(refund.processed_at) : 'Menunggu verifikasi'}
                            </strong>
                          </div>
                        </div>

                        {/* Action Link to Ticket */}
                        <div className="pt-2">
                          <Link
                            to={`/bookings/${refund.booking_id}`}
                            className="w-full h-9 rounded-control border border-line bg-panel hover:bg-tint text-ink text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            <span>Buka Detail Tiket</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ─── MODAL: AJUKAN REFUND BARU (Quick Request Modal) ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-panel border border-line rounded-ticket shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-line bg-raised flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand/10 text-brand-fg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">currency_exchange</span>
                </span>
                <h3 className="text-base sm:text-lg font-bold text-ink">
                  Ajukan Refund Tiket Penerbangan
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="w-8 h-8 rounded-full hover:bg-line/40 flex items-center justify-center text-subtle hover:text-ink transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-control text-danger text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                  <span>{modalError}</span>
                </div>
              )}

              {loadingEligible ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-subtle">
                  <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  <span>Memeriksa tiket yang memenuhi syarat refund...</span>
                </div>
              ) : eligibleBookings.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-subtle text-[40px]">
                    sentiment_dissatisfied
                  </span>
                  <strong className="text-sm font-semibold text-ink">
                    Tidak ada tiket yang dapat di-refund saat ini
                  </strong>
                  <p className="text-subtle text-xs max-w-xs leading-relaxed">
                    Hanya tiket berstatus lunas yang jadwal keberangkatannya minimal 6 jam ke depan atau mengalami pembatalan maskapai yang dapat diajukan refund.
                  </p>
                </div>
              ) : (
                <>
                  {/* Select Flight Order */}
                  <div className="space-y-1.5">
                    <label className="font-bold uppercase tracking-wider text-[10px] text-subtle block">
                      Pilih Tiket Pesanan Anda
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {eligibleBookings.map((b) => {
                        const isSelected = selectedBookingId === b.booking_id
                        return (
                          <div
                            key={b.booking_id}
                            onClick={() => handleSelectBooking(b.booking_id)}
                            className={`p-3 rounded-control border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'border-brand bg-tint/80 shadow-xs ring-1 ring-brand'
                                : 'border-line bg-raised hover:bg-tint/30'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-ink">
                                  {b.booking_code}
                                </span>
                                <span className="text-[11px] font-semibold text-brand-fg">
                                  {b.flight_number}
                                </span>
                                {b.is_flight_cancelled && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-danger/10 text-danger border border-danger/20">
                                    Dibatalkan Maskapai
                                  </span>
                                )}
                                {b.is_cooling_off && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    ⚡ Garansi 24 Jam
                                  </span>
                                )}
                              </div>
                              <span className="text-subtle text-[11px]">{b.route}</span>
                              <span className="text-[10px] text-subtle">
                                Berangkat: {formatDate(b.departure_time)}
                              </span>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-brand-fg text-xs block">
                                {formatIDR(b.estimated_refund_amount)}
                              </span>
                              <span className="text-[10px] text-subtle">Estimasi Kembali</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Refund Calculator Breakdown */}
                  {selectedBooking && (
                    <div className="p-3.5 bg-raised rounded-control border border-line space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-subtle">
                          Rincian Kalkulasi Pengembalian Dana
                        </span>
                        {selectedBooking.is_flight_cancelled ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                            Refund 100% Penuh
                          </span>
                        ) : selectedBooking.is_cooling_off ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                            Disetujui Instan (Cooling-off)
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-subtle">
                            Regulasi CASR 185
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-xs text-subtle pt-1">
                        <div className="flex justify-between">
                          <span>Harga Tiket Asli:</span>
                          <span className="tabular-nums font-medium text-ink">
                            {formatIDR(selectedBooking.total_price)}
                          </span>
                        </div>
                        {!selectedBooking.is_flight_cancelled && (
                          <>
                            <div className="flex justify-between text-danger">
                              <span>Biaya Pembatalan Tiket (20%):</span>
                              <span className="tabular-nums font-semibold">
                                - {formatIDR(selectedBooking.cancellation_fee)}
                              </span>
                            </div>
                            <div className="flex justify-between text-danger">
                              <span>Biaya Administrasi:</span>
                              <span className="tabular-nums font-semibold">
                                - {formatIDR(selectedBooking.admin_fee)}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="w-full h-px bg-line my-1" />
                        <div className="flex justify-between items-baseline pt-0.5 text-sm">
                          <strong className="text-ink font-bold">Total Dana Dikembalikan:</strong>
                          <strong className="text-brand-fg font-mono text-base font-bold">
                            {formatIDR(selectedBooking.estimated_refund_amount)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reason Textarea */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold uppercase tracking-wider text-[10px] text-subtle">
                        Alasan Pengajuan Pembatalan &amp; Refund
                      </label>
                      <span className="text-[10px] text-subtle tabular-nums">
                        {refundReason.length} / 300
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={300}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Jelaskan alasan mengapa Anda mengajukan pembatalan tiket (minimal 10 karakter)..."
                      className="w-full p-3 rounded-control bg-panel border border-line text-xs text-ink placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none transition-all"
                    />
                  </div>

                  {/* Warning Notice */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-control text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                      warning
                    </span>
                    <span>
                      Perhatian: Begitu pengajuan refund disetujui, reservasi kursi dan tiket penerbangan Anda akan langsung dibatalkan secara permanen dan tidak dapat dipulihkan.
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-line bg-raised flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="h-10 px-4 rounded-control border border-line bg-panel hover:bg-tint text-ink text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitRefund}
                disabled={submitting || !selectedBooking || eligibleBookings.length === 0}
                className="h-10 px-5 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>Kirim Pengajuan Refund</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <aside className="fixed bottom-6 right-6 z-50 bg-panel border border-line rounded-ticket p-4 shadow-xl flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">info</span>
          </div>
          <div className="flex-1 text-xs text-ink font-medium leading-relaxed">
            {toastMessage}
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-subtle hover:text-ink"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </aside>
      )}

      <Footer />
    </div>
  )
}
