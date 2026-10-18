import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Landing from '../pages/customer/Landing'
import CheckIn from '../pages/customer/CheckIn'
import CustomerDashboard from '../pages/customer/CustomerDashboard'
import AdminDashboard from '../pages/admin/Dashboard'
import AirportsPage from '../pages/admin/Airports'
import AirlinesPage from '../pages/admin/Airlines'
import AirplanesPage from '../pages/admin/Airplanes'
import StaffDashboard from '../pages/staff/Dashboard'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import CheckEmail from '../pages/auth/CheckEmail'
import VerifyEmail from '../pages/auth/VerifyEmail'
import ComponentsShowcase from '../pages/dev/ComponentsShowcase'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

/** Redirect kalau sudah login dan coba akses /login atau /register */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'staff') return <Navigate to="/staff" replace />
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function NotFound() {
  return (
    <div className="min-h-screen bg-page flex flex-col justify-between font-sans text-ink">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 pt-24 text-center">
        <div className="max-w-md bg-raised border border-line rounded-ticket p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-tint text-brand-fg flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[36px]">travel_explore</span>
          </div>
          <span className="text-xs uppercase font-bold text-brand-fg tracking-wider">
            404 • Halaman Tidak Ditemukan
          </span>
          <h1 className="text-2xl font-bold text-ink mt-2 mb-3">
            Rute ini tidak tersedia
          </h1>
          <p className="text-sm text-subtle mb-6 leading-relaxed">
            Halaman yang Anda tuju mungkin telah dipindahkan atau belum tersedia saat ini.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="h-11 px-5 bg-brand hover:bg-brand-hover text-white rounded-control font-semibold text-sm flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">home</span>
              <span>Ke Beranda</span>
            </Link>
            <Link
              to="/check-in"
              className="h-11 px-5 border border-line bg-panel hover:bg-tint text-ink rounded-control font-semibold text-sm flex items-center justify-center transition-colors"
            >
              Check-in Online
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/search" element={<div className="p-8 pt-24 text-ink">Hasil Pencarian (segera hadir)</div>} />
        <Route path="/dev/components" element={<ComponentsShowcase />} />

        {/* Auth (Guest Only — sudah login = redirect ke dashboard) */}
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Customer */}
        <Route path="/dashboard" element={<CustomerDashboard />} />

        {/* Admin - Master Data (Phase 2 & B14 Stitch Design) */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/airports" element={<AirportsPage />} />
        <Route path="/admin/airlines" element={<AirlinesPage />} />
        <Route path="/admin/airplanes" element={<AirplanesPage />} />

        {/* Staff */}
        <Route path="/staff" element={<StaffDashboard />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
