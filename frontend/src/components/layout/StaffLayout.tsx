import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import ThemeToggle from '../common/ThemeToggle'

interface StaffLayoutProps {
  children: React.ReactNode
  activeFlightId?: number | null
}

export default function StaffLayout({ children, activeFlightId }: StaffLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  const manifestPath = activeFlightId
    ? `/staff/flights/${activeFlightId}/manifest`
    : '/staff/flights/1/manifest'

  const isPenerbanganActive = location.pathname === '/staff'
  const isManifestActive = location.pathname.includes('/manifest')
  const isScanActive = location.pathname.includes('/scan')

  const staffName = user?.name || 'Ahmad Rizky'
  const staffRole = user?.role === 'admin' ? 'Super Admin' : 'Gate Crew'

  return (
    <div className="min-h-screen bg-page text-ink font-sans antialiased flex flex-col justify-between print:min-h-0 print:bg-white print:text-black">
      {/* ─── FIXED STAFF TOPBAR (Hidden in Print) ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-panel/95 backdrop-blur-md border-b border-line shadow-sm print:hidden">
        <div className="h-[72px] max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between gap-4">
          {/* Logo & Operational Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/staff" className="flex items-center gap-2 group">
              <span className="material-symbols-outlined text-brand-fg text-2xl group-hover:scale-105 transition-transform">
                flight_takeoff
              </span>
              <span className="text-xl font-bold tracking-tight text-ink font-sans">
                Sky<span className="text-brand-fg">Book</span>
              </span>
            </Link>
            <span className="px-2.5 py-0.5 rounded-full bg-tint text-brand-fg font-semibold text-[11px] uppercase tracking-wider">
              Staff Ops
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 h-[72px]">
            <Link
              to="/staff"
              className={`h-full flex items-center px-4 font-medium text-sm border-b-2 transition-all ${
                isPenerbanganActive
                  ? 'border-brand text-brand-fg font-semibold'
                  : 'border-transparent text-subtle hover:text-ink hover:border-line'
              }`}
            >
              Penerbangan Hari Ini
            </Link>
            <Link
              to={manifestPath}
              className={`h-full flex items-center px-4 font-medium text-sm border-b-2 transition-all ${
                isManifestActive
                  ? 'border-brand text-brand-fg font-semibold'
                  : 'border-transparent text-subtle hover:text-ink hover:border-line'
              }`}
            >
              Manifest
            </Link>
            <Link
              to="/staff/scan"
              className={`h-full flex items-center px-4 font-medium text-sm border-b-2 transition-all ${
                isScanActive
                  ? 'border-brand text-brand-fg font-semibold'
                  : 'border-transparent text-subtle hover:text-ink hover:border-line'
              }`}
            >
              Verifikasi Boarding
            </Link>
          </nav>

          {/* Right Operational Controls & Profile */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Live DCS Status */}
            <div className="hidden lg:flex items-center gap-2 bg-tint/80 border border-line/60 px-3 py-1.5 rounded-full text-xs font-medium text-ink">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span>DCS Terhubung (CGK-Gate 14)</span>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Profile Avatar & Info */}
            <div className="hidden sm:flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {staffName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="font-semibold text-xs text-ink">{staffName}</span>
                <span className="text-[10px] uppercase font-semibold text-subtle tracking-wide">
                  {staffRole}
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-line hidden sm:block" />

            {/* Logout Action */}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-control text-xs font-semibold text-danger hover:bg-danger/10 transition-colors flex items-center gap-1"
              title="Keluar dari sesi"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT VIEWPORT ─── */}
      <main className="w-full pt-[72px] flex-1 print:pt-0 print:m-0 print:p-0">
        {children}
      </main>
    </div>
  )
}

