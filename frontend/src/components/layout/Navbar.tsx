import { Link, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import { useAuthStore } from '../../store/authStore'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/', { replace: true })
    }
  }

  const getDashboardPath = () => {
    if (!user) return '/login'
    if (user.role === 'admin') return '/admin'
    if (user.role === 'staff') return '/staff'
    return '/dashboard'
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-panel/90 backdrop-blur-md border-b border-line shadow-xs">
      <div className="max-w-[1200px] h-full mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Left: Wordmark & Navigation Links */}
        <div className="flex items-center gap-6 md:gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink group"
          >
            <span className="material-symbols-outlined text-brand-fg text-[28px] select-none group-hover:scale-105 transition-transform">
              flight_takeoff
            </span>
            <span className="font-sans">
              Sky<span className="text-brand-fg">Book</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'text-brand-fg font-semibold border-b-2 border-brand-fg pb-1'
                  : 'text-ink hover:text-brand-fg'
              }`}
            >
              Cari tiket
            </Link>
            <Link
              to="/check-in"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/check-in'
                  ? 'text-brand-fg font-semibold border-b-2 border-brand-fg pb-1'
                  : 'text-ink hover:text-brand-fg'
              }`}
            >
              Check-in online
            </Link>
            <a
              href="#faq"
              className="text-sm font-medium text-ink hover:text-brand-fg transition-colors"
            >
              Bantuan
            </a>

            {/* Direct Admin Link in Navbar Menu for Admins */}
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                  location.pathname.startsWith('/admin')
                    ? 'text-brand-fg font-semibold border-b-2 border-brand-fg pb-1'
                    : 'text-brand-fg hover:text-brand-hover'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                <span>Dashboard Admin</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Right: Theme Toggle & Auth Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* PRIMARY CALL-TO-ACTION BUTTON FOR LOGGED-IN USERS */}
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  id="navbar-admin-dashboard-btn"
                  className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-control text-xs md:text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-fg active:scale-[0.98]"
                  title="Buka Dashboard Admin"
                >
                  <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                  <span className="hidden sm:inline">Dashboard Admin</span>
                  <span className="sm:hidden">Admin</span>
                </Link>
              )}

              {user.role === 'staff' && (
                <Link
                  to="/staff"
                  id="navbar-staff-dashboard-btn"
                  className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-control text-xs md:text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
                  title="Buka Dashboard Staf"
                >
                  <span className="material-symbols-outlined text-[18px]">shield_person</span>
                  <span className="hidden sm:inline">Dashboard Staf</span>
                  <span className="sm:hidden">Staf</span>
                </Link>
              )}

              {user.role === 'customer' && (
                <Link
                  to="/dashboard"
                  id="navbar-customer-dashboard-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-panel hover:bg-tint text-ink rounded-control text-xs md:text-sm font-medium transition-colors"
                  title="Buka Pesanan Saya"
                >
                  <span className="material-symbols-outlined text-[18px] text-brand-fg">confirmation_number</span>
                  <span className="hidden sm:inline">Pesanan Saya</span>
                </Link>
              )}

              {/* User profile capsule with link to appropriate dashboard */}
              <Link
                to={getDashboardPath()}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-control bg-tint hover:bg-tint/80 border border-brand-fg/20 text-ink text-xs font-medium transition-colors"
                title="Buka Profil / Dashboard"
              >
                <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-[11px] uppercase">
                  {user.name ? user.name[0] : 'U'}
                </span>
                <span className="max-w-[75px] sm:max-w-[120px] truncate font-semibold">
                  {user.name}
                </span>
                {user.role !== 'customer' && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand-fg hidden md:inline">
                    {user.role}
                  </span>
                )}
              </Link>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 py-1.5 text-xs text-subtle hover:text-ink hover:bg-tint rounded-control transition-colors"
                title="Keluar"
              >
                Keluar
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center justify-center border border-ink text-ink rounded-control px-4 py-2 text-xs md:text-sm font-semibold hover:bg-tint transition-all focus:outline-none focus:ring-2 focus:ring-brand-fg"
              >
                Masuk
              </Link>

              <Link
                to="/register"
                className="inline-flex items-center justify-center bg-brand hover:bg-brand-hover text-white rounded-control px-4 md:px-5 py-2 text-xs md:text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-fg"
              >
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

