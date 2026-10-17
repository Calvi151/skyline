import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    if (!user) {
      api
        .get('/auth/me')
        .then((res) => {
          if (res.data?.data) {
            setUser(res.data.data)
          }
        })
        .catch(() => {
          // not logged in
        })
    }
  }, [user, setUser])

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (e) {
      // ignore
    } finally {
      setUser(null)
      navigate('/', { replace: true })
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-panel/90 backdrop-blur-md border-b border-line">
      <div className="max-w-[1200px] h-full mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Left: Wordmark & Navigation Links */}
        <div className="flex items-center gap-6 md:gap-10">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink"
          >
            <span className="material-symbols-outlined text-brand-fg text-[28px] select-none">
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
              className="text-sm font-medium text-ink hover:text-brand-fg transition-colors"
            >
              Check-in online
            </Link>
            <a
              href="#faq"
              className="text-sm font-medium text-ink hover:text-brand-fg transition-colors"
            >
              Bantuan
            </a>
          </nav>
        </div>

        {/* Right: Theme Toggle & Auth Buttons */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-control bg-tint border border-brand-fg/20 text-ink text-xs font-medium">
                <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-[11px] uppercase">
                  {user.name ? user.name[0] : 'U'}
                </span>
                <span className="max-w-[120px] truncate font-semibold">{user.name}</span>
                {user.role !== 'customer' && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand-fg">
                    {user.role}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs text-subtle hover:text-ink hover:bg-tint rounded-control transition-colors"
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
