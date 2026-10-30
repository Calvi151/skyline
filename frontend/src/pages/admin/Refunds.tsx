import { useState, useEffect, useMemo } from 'react'
import AdminLayout from '../../components/layout/AdminLayout'
import { api } from '../../lib/api'

interface AdminRefundItem {
  id: number
  booking_id: number
  booking_code: string
  passenger: string
  route: string
  reason: string
  refund_amount: number
  status: 'pending' | 'approved' | 'rejected' | 'refunded'
  kind?: string
  requested_at: string | null
  processed_at: string | null
  departure_time: string | null
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<AdminRefundItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRefund, setSelectedRefund] = useState<AdminRefundItem | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Fetch refunds
  const fetchRefunds = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ error: boolean; data: AdminRefundItem[] }>('/admin/refunds')
      if (res.data?.data) {
        setRefunds(res.data.data)
        // Auto-select first pending refund if none selected
        if (!selectedRefund && res.data.data.length > 0) {
          const firstPending = res.data.data.find((r) => r.status === 'pending') || res.data.data[0]
          setSelectedRefund(firstPending)
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data pengajuan refund:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRefunds()
  }, [])

  // Format currency
  const formatIDR = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID')
  }

  // Format dates
  const formatDateStr = (iso?: string | null) => {
    if (!iso) return '---'
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Calculate hours until flight
  const getHoursUntilFlight = (depIso?: string | null, reqIso?: string | null) => {
    if (!depIso) return { hours: 40, label: 'Sisa 40 jam sebelum keberangkatan', pct: 40 }
    const depTime = new Date(depIso).getTime()
    const reqTime = reqIso ? new Date(reqIso).getTime() : Date.now()
    const diffHours = Math.max(0, Math.round((depTime - reqTime) / (1000 * 3600)))
    const pct = Math.min(100, Math.max(10, Math.round((diffHours / 72) * 100)))
    return {
      hours: diffHours,
      label: `Sisa ${diffHours} jam sebelum keberangkatan`,
      pct,
    }
  }

  // Counts
  const pendingCount = refunds.filter((r) => r.status === 'pending').length
  const approvedCount = refunds.filter((r) => r.status === 'approved' || r.status === 'refunded').length
  const rejectedCount = refunds.filter((r) => r.status === 'rejected').length

  const pendingAmountSum = refunds
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.refund_amount || 0), 0)

  // Filtered List
  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (activeTab === 'pending' && r.status !== 'pending') return false
      if (activeTab === 'approved' && r.status !== 'approved' && r.status !== 'refunded') return false
      if (activeTab === 'rejected' && r.status !== 'rejected') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchCode = r.booking_code.toLowerCase().includes(q)
        const matchPax = r.passenger.toLowerCase().includes(q)
        const matchRoute = r.route.toLowerCase().includes(q)
        if (!matchCode && !matchPax && !matchRoute) return false
      }

      return true
    })
  }, [refunds, activeTab, searchQuery])

  // Handle Approve / Reject
  const handleProcessRefund = async (status: 'approved' | 'rejected') => {
    if (!selectedRefund) return
    if (status === 'rejected' && rejectNotes.trim().length < 10) {
      alert('Catatan penolakan wajib diisi minimal 10 karakter.')
      return
    }

    setProcessing(true)
    try {
      await api.put(`/admin/refunds/${selectedRefund.id}`, { status })

      // Optimistic state update
      setRefunds((prev) =>
        prev.map((r) => (r.id === selectedRefund.id ? { ...r, status } : r))
      )
      setSelectedRefund((prev) => (prev ? { ...prev, status } : null))

      setToastMessage(
        status === 'approved'
          ? `Refund untuk ${selectedRefund.booking_code} (${selectedRefund.passenger}) berhasil disetujui.`
          : `Refund untuk ${selectedRefund.booking_code} ditolak.`
      )
      setRejectNotes('')
    } catch (err: any) {
      console.error('Gagal memproses refund:', err)
      alert(err.response?.data?.message || 'Gagal memproses refund')
    } finally {
      setProcessing(false)
    }
  }

  // Copy booking code
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
    setToastMessage(`Kode booking ${code} disalin ke clipboard!`)
  }

  return (
    <AdminLayout currentSection="Refund">
      <div className="w-full px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-6 max-w-[1440px] mx-auto">
        {/* ─── TOP AREA: BREADCRUMB & TITLE SECTION ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1 max-w-2xl">
            <div className="flex items-center gap-1.5 text-subtle text-xs uppercase tracking-wider font-semibold">
              <span>Operasional Armada</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span>Transaksi</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-brand-fg font-bold">Protokol Refund</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Manajemen Refund &amp; Pembatalan
            </h1>
            <p className="text-xs sm:text-sm text-subtle leading-relaxed mt-0.5">
              Tinjau dan proses permohonan pengembalian dana tiket penumpang sesuai regulasi aviasi CASR 185 dan batas waktu jendela keberangkatan armada.
            </p>
          </div>

          {/* Quick Metrics Summary */}
          <div className="flex items-center gap-4 bg-panel border border-line p-3 px-4 rounded-ticket shadow-xs shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-subtle">
                Beban Tertunda
              </span>
              <span className="tabular-nums font-bold text-sm text-ink">
                {formatIDR(pendingAmountSum)}
              </span>
            </div>
            <div className="w-px h-8 bg-line" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-subtle">
                SLA Rata-rata
              </span>
              <span className="tabular-nums font-bold text-sm text-brand-fg">
                1j 42m
              </span>
            </div>
          </div>
        </div>

        {/* ─── FILTERS, TABS, & CONTROLS ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-raised border border-line p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'bg-panel text-brand-fg shadow-xs'
                  : 'text-subtle hover:text-ink'
              }`}
            >
              <span>Menunggu</span>
              <span className="px-1.5 py-0.2 rounded-full bg-tint text-brand-fg text-[10px] tabular-nums">
                {pendingCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'approved'
                  ? 'bg-panel text-brand-fg shadow-xs'
                  : 'text-subtle hover:text-ink'
              }`}
            >
              <span>Disetujui</span>
              <span className="px-1.5 py-0.2 rounded-full bg-raised text-subtle text-[10px] tabular-nums">
                {approvedCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rejected')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'rejected'
                  ? 'bg-panel text-brand-fg shadow-xs'
                  : 'text-subtle hover:text-ink'
              }`}
            >
              <span>Ditolak</span>
              <span className="px-1.5 py-0.2 rounded-full bg-raised text-subtle text-[10px] tabular-nums">
                {rejectedCount}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode booking atau nama penumpang..."
              className="w-full h-10 pl-9 pr-8 rounded-control bg-panel border border-line text-ink placeholder:text-subtle text-xs focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-xs"
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

        {/* ─── TWO-COLUMN SPLIT TABLE AND PERSISTENT RIGHT DETAIL PANEL ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* ── LEFT COLUMN: REFUND CLAIMS TABLE (7 COLS) ── */}
          <div className="xl:col-span-7 bg-panel border border-line rounded-ticket shadow-xs overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-raised border-b border-line text-subtle font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input type="checkbox" className="rounded accent-brand cursor-pointer" />
                    </th>
                    <th className="py-3 px-3">Kode Booking</th>
                    <th className="py-3 px-3">Penumpang</th>
                    <th className="py-3 px-3">Rute</th>
                    <th className="py-3 px-3">Alasan</th>
                    <th className="py-3 px-3 text-right">Nilai Refund</th>
                    <th className="py-3 px-3">Diajukan</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium">
                  {loading && refunds.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-subtle">
                        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Memuat data pengajuan refund...
                      </td>
                    </tr>
                  ) : filteredRefunds.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-subtle">
                        Tidak ada pengajuan refund dalam kategori ini.
                      </td>
                    </tr>
                  ) : (
                    filteredRefunds.map((refund) => {
                      const isSelected = selectedRefund?.id === refund.id
                      const isPending = refund.status === 'pending'
                      const isApproved = refund.status === 'approved' || refund.status === 'refunded'

                      return (
                        <tr
                          key={refund.id}
                          onClick={() => setSelectedRefund(refund)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-tint/70 text-ink'
                              : 'hover:bg-tint/25 text-ink'
                          }`}
                        >
                          <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => setSelectedRefund(refund)}
                              className="rounded accent-brand cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-fg">
                            {refund.booking_code}
                          </td>
                          <td className="py-3 px-3 font-semibold truncate max-w-[120px]">
                            {refund.passenger}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-semibold">{refund.route}</span>
                          </td>
                          <td className="py-3 px-3 text-subtle max-w-[130px] truncate" title={refund.reason}>
                            {refund.reason || 'Tidak ada keterangan'}
                          </td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                            {formatIDR(refund.refund_amount)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-subtle text-[11px]">
                            {formatDateStr(refund.requested_at)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isPending ? (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase bg-tint text-brand-fg">
                                Menunggu
                              </span>
                            ) : isApproved ? (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase bg-success/15 text-success">
                                Disetujui
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase bg-danger/15 text-danger">
                                Ditolak
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-raised border-t border-line flex items-center justify-between text-xs text-subtle">
              <span>Menampilkan {filteredRefunds.length} dari {refunds.length} pengajuan</span>
              <span className="tabular-nums">Halaman 1 dari 1</span>
            </div>
          </div>

          {/* ── RIGHT COLUMN: DETAIL PANEL (5 COLS - 420PX+) ── */}
          <div className="xl:col-span-5 bg-panel border border-line rounded-ticket shadow-xs p-5 flex flex-col gap-4">
            {selectedRefund ? (
              <>
                {/* Panel Header */}
                <div className="flex items-start justify-between pb-3 border-b border-line">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                      Detail Permohonan Refund
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xl font-bold font-mono text-ink tracking-tight">
                        {selectedRefund.booking_code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(selectedRefund.booking_code)}
                        className="text-brand-fg hover:underline text-xs font-semibold flex items-center gap-0.5"
                        title="Salin Kode PNR"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        <span>Salin</span>
                      </button>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedRefund.status === 'pending'
                        ? 'bg-tint text-brand-fg'
                        : selectedRefund.status === 'approved' || selectedRefund.status === 'refunded'
                        ? 'bg-success/15 text-success'
                        : 'bg-danger/15 text-danger'
                    }`}
                  >
                    {selectedRefund.status === 'pending'
                      ? 'Menunggu Persetujuan'
                      : selectedRefund.status === 'approved' || selectedRefund.status === 'refunded'
                      ? 'Disetujui'
                      : 'Ditolak'}
                  </span>
                </div>

                {/* Timeline & Operational Aviation Window */}
                <div className="bg-raised border border-line p-3.5 rounded-control flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-subtle block">
                        Diajukan Penumpang
                      </span>
                      <strong className="text-ink font-semibold">
                        {formatDateStr(selectedRefund.requested_at)}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-subtle block">
                        Jadwal Terbang
                      </span>
                      <strong className="text-ink font-semibold">
                        {formatDateStr(selectedRefund.departure_time)}
                      </strong>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {(() => {
                    const windowInfo = getHoursUntilFlight(
                      selectedRefund.departure_time,
                      selectedRefund.requested_at
                    )
                    return (
                      <>
                        <div className="relative w-full h-2 bg-line/50 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-brand rounded-full transition-all"
                            style={{ width: `${windowInfo.pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <div className="flex items-center gap-1 text-brand-fg font-medium">
                            <span className="material-symbols-outlined text-[14px]">timer</span>
                            <span>{windowInfo.label}</span>
                          </div>
                          <span className="text-subtle uppercase text-[10px] font-semibold">
                            Batas Min: 6 Jam
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Passenger & Flight Specs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-raised border border-line rounded-control">
                    <span className="text-[10px] uppercase font-semibold text-subtle block">
                      Identitas Penumpang
                    </span>
                    <strong className="text-ink text-sm block mt-0.5">
                      {selectedRefund.passenger}
                    </strong>
                    <span className="text-subtle text-[11px]">
                      Rute: {selectedRefund.route}
                    </span>
                  </div>
                  <div className="p-3 bg-raised border border-line rounded-control">
                    <span className="text-[10px] uppercase font-semibold text-subtle block">
                      Status Transaksi
                    </span>
                    <strong className="text-ink text-sm block mt-0.5">
                      Lunas (Paid)
                    </strong>
                    <span className="text-subtle text-[11px]">
                      Kategori: {selectedRefund.kind || 'Sukarela'}
                    </span>
                  </div>
                </div>

                {/* Reason */}
                <div className="flex flex-col gap-1 text-xs">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                    Alasan Pengajuan Penumpang
                  </span>
                  <div className="p-3 bg-raised border border-line rounded-control text-ink leading-relaxed">
                    “{selectedRefund.reason || 'Tidak ada alasan yang disertakan.'}”
                  </div>
                </div>

                {/* Refund Calculation Breakdown */}
                <div className="flex flex-col gap-1.5 bg-raised border border-line p-3.5 rounded-control text-xs">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                    Kalkulasi Pengembalian Dana (CASR 185)
                  </span>
                  <div className="flex justify-between text-subtle pt-1">
                    <span>Harga Tiket Dasar (Nett)</span>
                    <span className="tabular-nums text-ink">
                      {formatIDR(selectedRefund.refund_amount * 1.1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-danger">
                    <span>Biaya Administrasi Pembatalan</span>
                    <span className="tabular-nums font-semibold">
                      - {formatIDR(selectedRefund.refund_amount * 0.1)}
                    </span>
                  </div>
                  <div className="w-full h-px bg-line my-0.5" />
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="font-bold text-ink">Total Pengembalian Dana</span>
                    <span className="text-base font-bold text-brand-fg tabular-nums">
                      {formatIDR(selectedRefund.refund_amount)}
                    </span>
                  </div>
                </div>

                {/* Action Workflow */}
                {selectedRefund.status === 'pending' ? (
                  <div className="flex flex-col gap-3 pt-1">
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleProcessRefund('approved')}
                      className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-xs tracking-wide shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Setujui Refund ({formatIDR(selectedRefund.refund_amount)})</span>
                    </button>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <label htmlFor="reject-notes" className="font-semibold text-subtle">
                          Catatan Penolakan (Wajib Jika Ditolak)
                        </label>
                        <span className="text-subtle tabular-nums">{rejectNotes.length} / 300</span>
                      </div>
                      <textarea
                        id="reject-notes"
                        rows={2}
                        maxLength={300}
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        placeholder="Berikan alasan penolakan (minimal 10 karakter)..."
                        className="w-full p-2.5 bg-panel border border-line rounded-control text-xs text-ink placeholder:text-subtle focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-all resize-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleProcessRefund('rejected')}
                      className="w-full h-10 bg-raised hover:bg-danger/10 text-danger border border-line rounded-control font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                      <span>Tolak Permohonan</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-control bg-raised border border-line text-xs text-subtle text-center">
                    Permohonan ini telah selesai diproses (Status:{' '}
                    <strong className="text-ink uppercase">{selectedRefund.status}</strong>).
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 text-center text-subtle text-xs">
                Pilih salah satu baris pengajuan refund di tabel untuk melihat rincian dan kalkulasi.
              </div>
            )}
          </div>
        </div>

        {/* ─── FLOATING TOAST FEEDBACK ─── */}
        {toastMessage && (
          <aside className="fixed bottom-6 right-6 z-50 bg-panel border border-line rounded-ticket p-4 shadow-xl flex items-center gap-3 max-w-md animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">task_alt</span>
            </div>
            <div className="flex-1 text-xs text-ink font-medium pr-2">
              {toastMessage}
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-subtle hover:text-ink p-1 rounded"
              aria-label="Tutup notifikasi"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </div>
    </AdminLayout>
  )
}

