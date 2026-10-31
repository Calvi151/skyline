import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ProtectedRoute, RoleRoute } from '../components/auth/ProtectedRoute'
import Landing from '../pages/customer/Landing'
import CheckIn from '../pages/customer/CheckIn'
import AdminDashboard from '../pages/admin/Dashboard'
import AirportsPage from '../pages/admin/Airports'
import AirlinesPage from '../pages/admin/Airlines'
import AirplanesPage from '../pages/admin/Airplanes'
import BaggageOptionsPage from '../pages/admin/BaggageOptions'
import FlightsPage from '../pages/admin/Flights'
import FlightFormPage from '../pages/admin/FlightForm'
import RefundsPage from '../pages/admin/Refunds'
import UsersPage from '../pages/admin/Users'
import StaffDashboard from '../pages/staff/Dashboard'
import FlightManifest from '../pages/staff/Manifest'
import ScanBoarding from '../pages/staff/ScanBoarding'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import CheckEmail from '../pages/auth/CheckEmail'
import VerifyEmail from '../pages/auth/VerifyEmail'
import ComponentsShowcase from '../pages/dev/ComponentsShowcase'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import SearchResults from '../pages/customer/SearchResults'
import BookingDetail from '../pages/customer/BookingDetail'
import Checkout from '../pages/customer/Checkout'
import PaymentResult from '../pages/customer/PaymentResult'
import MyBookings from '../pages/customer/MyBookings'
import BookingTicket from '../pages/customer/BookingTicket'
import CustomerProfile from '../pages/customer/Profile'
import AdminProfile from '../pages/admin/Profile'

/** Redirect kalau sudah login dan coba akses /login atau /register */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isInitialized } = useAuthStore()
  if (isLoading && !isInitialized) return null
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
  const checkAuth = useAuthStore((s) => s.checkAuth)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/check-in/:bookingId" element={<CheckIn />} />
        <Route path="/checkin/:bookingId" element={<CheckIn />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/flights/:id" element={<BookingDetail />} />
        <Route path="/checkout/:bookingId" element={<Checkout />} />
        <Route path="/payment/result" element={<PaymentResult />} />
        <Route path="/payment/finish" element={<PaymentResult />} />
        <Route path="/dev/components" element={<ComponentsShowcase />} />

        {/* Auth (Guest Only — sudah login = redirect ke dashboard) */}
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Customer Bookings / Dashboard (Phase 5 & Stitch B9 / B10) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/:id"
          element={
            <ProtectedRoute>
              <BookingTicket />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <CustomerProfile />
            </ProtectedRoute>
          }
        />

        {/* Admin - Master Data (Phase 2 & B14 Stitch Design) */}
        <Route
          path="/admin"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/airports"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AirportsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/airlines"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AirlinesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/airplanes"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AirplanesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/baggage-options"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <BaggageOptionsPage />
            </RoleRoute>
          }
        />

        {/* Admin - Flight Schedules (Phase 3 & Stitch B15/B16 Design) */}
        <Route
          path="/admin/flights"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <FlightsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/flights/new"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <FlightFormPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/flights/:id/edit"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <FlightFormPage />
            </RoleRoute>
          }
        />

        {/* Admin - Refunds & Users (Phase 7 & Stitch B18 / B17 Design) */}
        <Route
          path="/admin/refunds"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <RefundsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <UsersPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AdminProfile />
            </RoleRoute>
          }
        />

        {/* Staff Operations (Phase 7 & Stitch B19 / B20 / B21 Design) */}
        <Route
          path="/staff"
          element={
            <RoleRoute allowedRoles={['staff', 'admin']}>
              <StaffDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/staff/flights/:id/manifest"
          element={
            <RoleRoute allowedRoles={['staff', 'admin']}>
              <FlightManifest />
            </RoleRoute>
          }
        />
        <Route
          path="/staff/scan"
          element={
            <RoleRoute allowedRoles={['staff', 'admin']}>
              <ScanBoarding />
            </RoleRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
