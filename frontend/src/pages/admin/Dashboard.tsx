import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import { AreaChart, Donut, Segmented, Sparkline } from '../../components/charts/Charts'

type Range = '7' | '30' | '90'
type Metric = 'count' | 'revenue'

interface DashboardData {
  today: { bookings: number; revenue: number; pending_refunds: number }
  bookings_by_day: Array<{ date: string; count: number; revenue?: number }>
  status_breakdown?: Record<string, number>
  upcoming_departures: Array<{
    flight_schedule_id: number
    flight_number: string
    route: string
    departure_time: string
    seats_sold: number
    seats_total: number
  }>
  pending_refunds: Array<{ id: number; booking_code: string; passenger: string; refund_amount: number }>
}

const rupiah = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`
const rupiahShort = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace('.0', '')} M`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '')} jt`
  if (v >= 1_000) return `${Math.round(v / 1_000)} rb`
  return String(Math.round(v))
}
const shortDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [range, setRange] = useState<Range>('30')
  const [metric, setMetric] = useState<Metric>('count')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [master, setMaster] = useState({ airports: 0, airlines: 0, airplanes: 0, flights: 0 })

  useEffect(() => {
    setLoading(true)
    api
      .get(`/admin/dashboard?range=${range}`)
      .then((res) => setData(res.data?.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [range])

  useEffect(() => {
    const len = (r: PromiseSettledResult<any>) => {
      if (r.status !== 'fulfilled') return 0
      const list = r.value.data?.data ?? r.value.data
      return Array.isArray(list) ? list.length : 0
    }
    Promise.allSettled([
      api.get('/admin/airports'),
      api.get('/admin/airlines'),
      api.get('/admin/airplanes'),
      api.get('/admin/flights'),
    ]).then(([a, b, c, d]) => setMaster({ airports: len(a), airlines: len(b), airplanes: len(c), flights: len(d) }))
  }, [])

  const series = useMemo(
    () =>
      (data?.bookings_by_day || []).map((d) => ({
        label: d.date,
        value: metric === 'count' ? d.count : d.revenue || 0,
      })),
    [data, metric],
  )

  const totals = useMemo(() => {
    const days = data?.bookings_by_day || []
    const half = Math.floor(days.length / 2)
    const sum = (arr: typeof days, k: 'count' | 'revenue') => arr.reduce((s, d) => s + (d[k] || 0), 0)
    const cur = days.slice(half)
    const prev = days.slice(0, half)
    const delta = (k: 'count' | 'revenue') => {
      const p = sum(prev, k)
      const c = sum(cur, k)
      if (!p) return c ? 100 : 0
      return Math.round(((c - p) / p) * 100)
    }
    return {
      count: sum(days, 'count'),
      revenue: sum(days, 'revenue'),
      countDelta: delta('count'),
      revenueDelta: delta('revenue'),
      countSpark: days.map((d) => d.count),
      revenueSpark: days.map((d) => d.revenue || 0),
    }
  }, [data])

  const sb = data?.status_breakdown || { pending: 0, paid: 0, cancelled: 0, refunded: 0 }
  const conversion = totals.count ? Math.round(((sb.paid || 0) / totals.count) * 100) : 0

  const kpis = [
    {
      label: 'Pendapatan',
      value: rupiah(totals.revenue),
      delta: totals.revenueDelta,
      spark: totals.revenueSpark,
      hint: `${range} hari terakhir`,
    },
    {
      label: 'Total pesanan',
      value: totals.count.toLocaleString('id-ID'),
      delta: totals.countDelta,
      spark: totals.countSpark,
      hint: `Hari ini: ${data?.today.bookings ?? 0}`,
    },
    {
      label: 'Konversi bayar',
      value: `${conversion}%`,
      delta: null,
      spark: null,
      hint: `${sb.paid || 0} dari ${totals.count} pesanan lunas`,
    },
    {
      label: 'Refund menunggu',
      value: String(data?.today.pending_refunds ?? 0),
      delta: null,
      spark: null,
      hint: 'Perlu ditinjau',
      href: '/admin/refunds',
    },
  ]

  return (
    <AdminLayout currentSection="Ringkasan">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">Ringkasan</h1>
            <p className="text-sm text-subtle mt-1">
              Selamat datang kembali, <span className="font-semibold text-ink">{user?.name || 'Administrator'}</span>. Berikut performa
              penjualan tiket.
            </p>
          </div>
          <Segmented<Range>
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 hari' },
              { value: '30', label: '30 hari' },
              { value: '90', label: '90 hari' },
            ]}
          />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((k) => {
            const body = (
              <div className="h-full p-5 rounded-ticket bg-raised border border-line shadow-xs hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-subtle">{k.label}</span>
                  {k.delta !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        k.delta >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">{k.delta >= 0 ? 'trending_up' : 'trending_down'}</span>
                      {Math.abs(k.delta)}%
                    </span>
                  )}
                  {k.href && <span className="material-symbols-outlined text-[16px] text-subtle">arrow_outward</span>}
                </div>
                <div className="flex items-end justify-between gap-3 mt-2">
                  {loading ? (
                    <span className="h-8 w-28 bg-line rounded animate-pulse" />
                  ) : (
                    <span className="text-2xl font-extrabold text-ink tabular-nums tracking-tight">{k.value}</span>
                  )}
                  {k.spark && !loading && <Sparkline values={k.spark} />}
                </div>
                <span className="text-[11px] text-subtle block mt-1.5">{k.hint}</span>
              </div>
            )
            return k.href ? (
              <Link key={k.label} to={k.href} className="block">
                {body}
              </Link>
            ) : (
              <div key={k.label}>{body}</div>
            )
          })}
        </div>

        {/* Main chart + donut */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 p-5 rounded-ticket bg-raised border border-line shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-ink">Tren {metric === 'count' ? 'pesanan' : 'pendapatan'}</h2>
                <p className="text-xs text-subtle mt-0.5">
                  {metric === 'count' ? `${totals.count} pesanan` : rupiah(totals.revenue)} dalam {range} hari terakhir
                </p>
              </div>
              <Segmented<Metric>
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'count', label: 'Pesanan' },
                  { value: 'revenue', label: 'Pendapatan' },
                ]}
              />
            </div>
            {loading ? (
              <div className="h-[240px] rounded-control bg-panel animate-pulse" />
            ) : (
              <AreaChart
                data={series}
                formatLabel={shortDate}
                formatValue={(v) => (metric === 'revenue' ? rupiahShort(v) : String(Math.round(v)))}
              />
            )}
          </div>

          <div className="p-5 rounded-ticket bg-raised border border-line shadow-xs">
            <h2 className="text-sm font-bold text-ink">Status pesanan</h2>
            <p className="text-xs text-subtle mt-0.5 mb-5">Distribusi {range} hari terakhir</p>
            <Donut
              centerLabel="pesanan"
              slices={[
                { label: 'Lunas', value: sb.paid || 0, color: 'stroke-emerald-500', dot: 'bg-emerald-500' },
                { label: 'Menunggu', value: sb.pending || 0, color: 'stroke-amber-400', dot: 'bg-amber-400' },
                { label: 'Dibatalkan', value: sb.cancelled || 0, color: 'stroke-rose-500', dot: 'bg-rose-500' },
                { label: 'Refund', value: sb.refunded || 0, color: 'stroke-sky-500', dot: 'bg-sky-500' },
              ]}
            />
          </div>
        </div>

        {/* Departures + refunds */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-ticket bg-raised border border-line shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink">Keterisian kursi</h2>
                <p className="text-xs text-subtle mt-0.5">Jadwal penerbangan terbaru</p>
              </div>
              <Link to="/admin/flights" className="text-xs font-semibold text-brand-fg hover:underline underline-offset-4">
                Semua jadwal
              </Link>
            </div>
            <div className="divide-y divide-line">
              {(data?.upcoming_departures || []).length === 0 && !loading && (
                <p className="px-5 py-8 text-center text-xs text-subtle">Belum ada jadwal penerbangan.</p>
              )}
              {(data?.upcoming_departures || []).map((f) => {
                const pct = f.seats_total ? Math.round((f.seats_sold / f.seats_total) * 100) : 0
                const bar = pct >= 85 ? 'bg-emerald-500' : pct >= 50 ? 'bg-brand-fg' : 'bg-amber-400'
                return (
                  <Link
                    key={f.flight_schedule_id}
                    to={`/staff/flights/${f.flight_schedule_id}/manifest`}
                    className="px-5 py-3.5 grid grid-cols-12 items-center gap-3 hover:bg-panel/50 transition-colors"
                  >
                    <div className="col-span-4 sm:col-span-3 min-w-0">
                      <span className="text-sm font-bold text-ink block">{f.route.replace('-', ' → ')}</span>
                      <span className="text-[11px] text-subtle font-mono">{f.flight_number}</span>
                    </div>
                    <div className="hidden sm:block col-span-3 text-xs text-subtle tabular-nums">
                      {new Date(f.departure_time).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="col-span-6 sm:col-span-5">
                      <div className="h-2 rounded-full bg-line/70 overflow-hidden">
                        <div className={`h-full rounded-full ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-subtle tabular-nums mt-1 block">
                        {f.seats_sold}/{f.seats_total} kursi
                      </span>
                    </div>
                    <span className="col-span-2 sm:col-span-1 text-right text-sm font-bold text-ink tabular-nums">{pct}%</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="rounded-ticket bg-raised border border-line shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Antrean refund</h2>
              <Link to="/admin/refunds" className="text-xs font-semibold text-brand-fg hover:underline underline-offset-4">
                Tinjau
              </Link>
            </div>
            <div className="divide-y divide-line flex-1">
              {(data?.pending_refunds || []).length === 0 && !loading && (
                <div className="px-5 py-10 text-center">
                  <span className="material-symbols-outlined text-[28px] text-emerald-500">task_alt</span>
                  <p className="text-xs text-subtle mt-1">Tidak ada refund yang menunggu.</p>
                </div>
              )}
              {(data?.pending_refunds || []).map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-panel border border-line flex items-center justify-center text-[11px] font-bold text-subtle shrink-0">
                    {r.passenger.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-ink block truncate">{r.passenger}</span>
                    <span className="text-[11px] text-subtle font-mono">{r.booking_code}</span>
                  </div>
                  <span className="text-xs font-bold text-ink tabular-nums">{rupiahShort(r.refund_amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Master data strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Jadwal', value: master.flights, icon: 'calendar_month', to: '/admin/flights' },
            { label: 'Bandara', value: master.airports, icon: 'connecting_airports', to: '/admin/airports' },
            { label: 'Maskapai', value: master.airlines, icon: 'airlines', to: '/admin/airlines' },
            { label: 'Pesawat', value: master.airplanes, icon: 'flight', to: '/admin/airplanes' },
          ].map((m) => (
            <Link
              key={m.label}
              to={m.to}
              className="group px-4 py-3.5 rounded-ticket bg-raised border border-line hover:border-brand-fg/40 transition-colors flex items-center gap-3"
            >
              <span className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
              </span>
              <div className="flex-1">
                <span className="text-lg font-extrabold text-ink tabular-nums block leading-tight">
                  {m.value.toLocaleString('id-ID')}
                </span>
                <span className="text-[11px] text-subtle">{m.label}</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-subtle group-hover:translate-x-0.5 transition-transform">
                chevron_right
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
