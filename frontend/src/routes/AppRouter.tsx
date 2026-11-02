import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ProtectedRoute, RoleRoute } from '../components/auth/ProtectedRoute'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

// ── Code-Splitting: Lazy load semua halaman untuk mempercepat load awal (0 ms lag) ──
const Landing = lazy(() => import('../pages/customer/Landing'))
const CheckIn = lazy(() => import('../pages/customer/CheckIn'))
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'))
const AirportsPage = lazy(() => import('../pages/admin/Airports'))
const AirlinesPage = lazy(() => import('../pages/admin/Airlines'))
const AirplanesPage = lazy(() => import('../pages/admin/Airplanes'))
const BaggageOptionsPage = lazy(() => import('../pages/admin/BaggageOptions'))
const FlightsPage = lazy(() => import('../pages/admin/Flights'))
const FlightFormPage = lazy(() => import('../pages/admin/FlightForm'))
const RefundsPage = lazy(() => import('../pages/admin/Refunds'))
const UsersPage = lazy(() => import('../pages/admin/Users'))
const StaffDashboard = lazy(() => import('../pages/staff/Dashboard'))
const FlightManifest = lazy(() => import('../pages/staff/Manifest'))
const ScanBoarding = lazy(() => import('../pages/staff/ScanBoarding'))
const Login = lazy(() => import('../pages/auth/Login'))
const Register = lazy(() => import('../pages/auth/Register'))
const CheckEmail = lazy(() => import('../pages/auth/CheckEmail'))
const VerifyEmail = lazy(() => import('../pages/auth/VerifyEmail'))
const ComponentsShowcase = lazy(() => import('../pages/dev/ComponentsShowcase'))
const SearchResults = lazy(() => import('../pages/customer/SearchResults'))
const BookingDetail = lazy(() => import('../pages/customer/BookingDetail'))
const Checkout = lazy(() => import('../pages/customer/Checkout'))
const PaymentResult = lazy(() => import('../pages/customer/PaymentResult'))
const MyBookings = lazy(() => import('../pages/customer/MyBookings'))
const BookingTicket = lazy(() => import('../pages/customer/BookingTicket'))
const MyRefunds = lazy(() => import('../pages/customer/MyRefunds'))
const CustomerProfile = lazy(() => import('../pages/customer/Profile'))
const AdminProfile = lazy(() => import('../pages/admin/Profile'))

function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center p-6 text-ink">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-[11px] font-semibold text-subtle tracking-wider uppercase">
          Memuat Halaman...
        </span>
      </div>
    </div>
  )
}

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
      <Suspense fallback={<PageLoadingFallback />}>
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
          path="/my-refunds"
          element={
            <ProtectedRoute>
              <MyRefunds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/refunds"
          element={
            <ProtectedRoute>
              <MyRefunds />
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
          path="/staff/manifest"
          element={
            <RoleRoute allowedRoles={['staff', 'admin']}>
              <FlightManifest />
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
      </Suspense>
    </BrowserRouter>
  )
}
