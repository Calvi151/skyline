import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    airportsCount: 8,
    airlinesCount: 6,
    airplanesCount: 14,
    flightsCount: 0,
  })

  useEffect(() => {
    // Fetch counts from endpoints
    Promise.allSettled([
      api.get('/admin/airports'),
      api.get('/admin/airlines'),
      api.get('/admin/airplanes'),
      api.get('/admin/flights'),
    ]).then(([resAirports, resAirlines, resPlanes, resFlights]) => {
      let airportsCount = 0
      let airlinesCount = 0
      let airplanesCount = 0
      let flightsCount = 0

      if (resAirports.status === 'fulfilled') {
        const list = resAirports.value.data?.data ?? resAirports.value.data
        if (Array.isArray(list)) airportsCount = list.length
      }
      if (resAirlines.status === 'fulfilled') {
        const list = resAirlines.value.data?.data ?? resAirlines.value.data
        if (Array.isArray(list)) airlinesCount = list.length
      }
      if (resPlanes.status === 'fulfilled') {
        const list = resPlanes.value.data?.data ?? resPlanes.value.data
        if (Array.isArray(list)) airplanesCount = list.length
      }
      if (resFlights.status === 'fulfilled') {
        const list = resFlights.value.data?.data ?? resFlights.value.data
        if (Array.isArray(list)) flightsCount = list.length
      }

      setStats({
        airportsCount,
        airlinesCount,
        airplanesCount,
        flightsCount,
      })
    })
  }, [])

  return (
    <AdminLayout currentSection="Ringkasan Operasional">
      <div className="flex flex-col gap-6">
        {/* Horizon Top Header */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
              Pusat Komando Operasional
            </span>
            <span className="w-1 h-1 rounded-full bg-line" />
            <span className="text-[10px] font-bold tracking-wider text-brand-fg">
              SISTEM AKTIF
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ink tracking-tight font-sans">
            Ringkasan Admin
          </h1>
          <p className="text-xs md:text-sm text-subtle">
            Selamat datang kembali, <span className="font-semibold text-ink">{user?.name || 'Administrator'}</span>. Pantau dan kelola master data penerbangan nusantara.
          </p>
        </div>

        {/* Master Data Quick Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/admin/airports"
            className="bg-panel border border-line rounded-ticket p-5 hover:border-brand-fg hover:shadow-md transition-all group select-none"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                Total Bandara
              </span>
              <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">connecting_airports</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-ink tabular-nums">
              {stats.airportsCount}
            </div>
            <p className="text-[11px] text-subtle mt-1.5 flex items-center gap-1">
              <span>Kelola kode IATA &amp; wilayah</span>
              <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </p>
          </Link>

          <Link
            to="/admin/airlines"
            className="bg-panel border border-line rounded-ticket p-5 hover:border-brand-fg hover:shadow-md transition-all group select-none"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                Maskapai Rekanan
              </span>
              <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">airlines</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-ink tabular-nums">
              {stats.airlinesCount}
            </div>
            <p className="text-[11px] text-subtle mt-1.5 flex items-center gap-1">
              <span>Kelola lisensi maskapai &amp; logo</span>
              <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </p>
          </Link>

          <Link
            to="/admin/airplanes"
            className="bg-panel border border-line rounded-ticket p-5 hover:border-brand-fg hover:shadow-md transition-all group select-none"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                Armada Pesawat
              </span>
              <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">flight</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-ink tabular-nums">
              {stats.airplanesCount}
            </div>
            <p className="text-[11px] text-subtle mt-1.5 flex items-center gap-1">
              <span>Kelola registrasi PK &amp; kursi</span>
              <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </p>
          </Link>
        </div>

        {/* Operational Shortcuts & System Status */}
        <div className="bg-panel border border-line rounded-ticket p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-brand-fg">hub</span>
              <span>Modul Master Data (Phase 2 Selesai)</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success text-[11px] font-bold border border-success/30">
              CRUD UI Aktif
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link
              to="/admin/airports"
              className="p-4 rounded-control border border-line bg-page hover:bg-tint/40 transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded bg-brand text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Buka Data Bandara</p>
                <p className="text-[11px] text-subtle mt-0.5">
                  Tambah bandara baru atau sesuaikan kode IATA internasional.
                </p>
              </div>
            </Link>

            <Link
              to="/admin/airlines"
              className="p-4 rounded-control border border-line bg-page hover:bg-tint/40 transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded bg-brand text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">verified</span>
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Buka Data Maskapai</p>
                <p className="text-[11px] text-subtle mt-0.5">
                  Daftarkan operator penerbangan mitra dan logo resmi.
                </p>
              </div>
            </Link>

            <Link
              to="/admin/airplanes"
              className="p-4 rounded-control border border-line bg-page hover:bg-tint/40 transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded bg-brand text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">airline_seat_recline_normal</span>
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Buka Data Pesawat</p>
                <p className="text-[11px] text-subtle mt-0.5">
                  Atur nomor lambung PK dan konfigurasi kursi penumpang.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
