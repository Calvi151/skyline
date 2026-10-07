import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'

export default function Navbar() {
  const location = useLocation()

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
        </div>
      </div>
    </header>
  )
}
