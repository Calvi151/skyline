import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import ThemeToggle from '../common/ThemeToggle'

interface AdminLayoutProps {
  children: React.ReactNode
  currentSection?: string
}

export default function AdminLayout({ children, currentSection }: AdminLayoutProps) {
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

  const navItems = [
    { label: 'Ringkasan', path: '/admin', icon: 'dashboard', exact: true },
    { label: 'Jadwal penerbangan', path: '/admin/flights', icon: 'calendar_month' },
    { label: 'Bandara', path: '/admin/airports', icon: 'connecting_airports' },
    { label: 'Maskapai', path: '/admin/airlines', icon: 'airlines' },
    { label: 'Pesawat', path: '/admin/airplanes', icon: 'flight' },
    { label: 'Bagasi', path: '/admin/baggage-options', icon: 'luggage' },
    { label: 'Refund', path: '/admin/refunds', icon: 'currency_exchange' },
    { label: 'Pengguna', path: '/admin/users', icon: 'group' },
    { label: 'Profil Saya', path: '/admin/profile', icon: 'account_circle' },
  ]

  const adminName = user?.name || 'Budi Santoso'

  return (
    <div className="min-h-screen bg-page text-ink font-sans antialiased">
      {/* ─── SIDEBAR (Fixed Left, 240px Width - Stitch B14 Specification) ─── */}
      <aside className="fixed left-0 top-0 h-full w-60 bg-[#0B2545] dark:bg-[#060E1A] text-white z-50 flex flex-col justify-between select-none shadow-xl">
        <div className="flex flex-col">
          {/* Logo Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="material-symbols-outlined text-brand-fg text-2xl group-hover:scale-105 transition-transform">
                flight_takeoff
              </span>
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                Sky<span className="text-sky-300">Book</span>
              </span>
            </Link>
            <span className="text-[10px] font-bold tracking-wider uppercase bg-white/15 text-sky-200 px-2 py-0.5 rounded">
              OPS
            </span>
          </div>

          {/* Navigation Links */}
          <div className="px-3 py-4">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path)

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-white/15 text-white font-semibold border-l-4 border-signal pl-2.5 shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10 font-normal'
                    }`}
                  >
                    <span className="material-symbols-outlined mr-3 text-[20px] shrink-0">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Operational Fleet Card */}
        <div className="p-3.5 m-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
          <div className="flex items-center justify-between text-white/60 text-[10px] uppercase font-bold tracking-wider">
            <span>GATE CONTROL</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </div>
          <p className="text-white/90 text-xs font-medium mt-1">Archipelago Fleet ID</p>
          <p className="text-[10px] text-white/50">v2.4 • Node Jakarta/CGK</p>
        </div>
      </aside>

      {/* ─── TOPBAR HEADER (Fixed Top, Shifted 240px to the Right) ─── */}
      <div className="pl-60">
        <header className="fixed top-0 left-60 right-0 h-16 bg-panel/90 backdrop-blur-md z-40 border-b border-line shadow-sm flex items-center justify-between px-6 lg:px-8">
          {/* Breadcrumb Hierarchy */}
          <div className="flex items-center gap-2 text-xs md:text-sm text-subtle">
            <span className="font-medium hover:text-ink transition-colors">SkyBook Control</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="font-semibold text-ink">
              {currentSection || 'Operasional Penerbangan'}
            </span>
          </div>

          {/* User Controls & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium border border-line bg-panel hover:bg-tint text-ink transition-colors shadow-2xs"
              title="Lihat Beranda Pemesanan Tiket"
            >
              <span className="material-symbols-outlined text-[16px] text-brand-fg">travel_explore</span>
              <span className="hidden sm:inline">Lihat Web</span>
            </Link>

            <ThemeToggle />

            <div className="h-5 w-px bg-line" />

            {/* Admin Avatar & Label */}
            <Link
              to="/admin/profile"
              className="flex items-center gap-2.5 pl-1 select-none hover:opacity-85 transition-opacity"
              title="Pengaturan Profil Administrator"
            >
              <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {adminName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col text-left leading-tight hidden sm:flex">
                <span className="text-xs font-bold text-ink">{adminName}</span>
                <span className="text-[10px] text-subtle font-medium">Administrator</span>
              </div>
            </Link>

            <div className="h-5 w-px bg-line" />

            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-control text-xs font-medium text-subtle hover:text-error hover:bg-error/10 transition-colors"
              title="Keluar dari sesi Admin"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span className="hidden md:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* ─── MAIN CONTENT VIEWPORT ─── */}
        <main className="relative pt-16 bg-page min-h-screen">
          <div className="p-6 lg:p-8 max-w-[1360px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
