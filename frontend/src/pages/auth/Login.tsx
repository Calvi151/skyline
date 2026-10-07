import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore, AuthUser } from '../../store/authStore'
import { api } from '../../lib/api'
import ThemeToggle from '../../components/common/ThemeToggle'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'

  const { setUser } = useAuthStore()

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Email format validation helper
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email) {
      setErrorMessage('Harap masukkan alamat email.')
      return
    }

    if (!isEmailValid) {
      setErrorMessage('Format email tidak valid. Masukkan email yang benar.')
      return
    }

    if (!password) {
      setErrorMessage('Harap masukkan kata sandi.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Kata sandi minimal 6 karakter.')
      return
    }

    setIsLoading(true)

    try {
      // Attempt backend API login
      const res = await api.post('/auth/login', { email, password })
      const userData: AuthUser = res.data.data?.user || res.data.user
      setUser(userData)

      // Role-based redirection
      if (userData.role === 'admin') {
        navigate('/admin')
      } else if (userData.role === 'staff') {
        navigate('/staff')
      } else {
        navigate(redirectUrl)
      }
    } catch (err: any) {
      // If backend responds with specific error code or backend is not running yet
      const apiError = err.response?.data?.message || err.response?.data?.error

      if (apiError) {
        setErrorMessage(apiError)
      } else {
        // Fallback demo simulation for offline/preview mode
        console.warn('Backend unavailable, simulating login with mock session:', err.message)
        
        let role: 'admin' | 'staff' | 'customer' = 'customer'
        let name = 'Rina Wulandari'

        if (email.includes('admin')) {
          role = 'admin'
          name = 'Admin Operasional'
        } else if (email.includes('staff')) {
          role = 'staff'
          name = 'Staff Bandara'
        }

        const mockUser: AuthUser = {
          id: 101,
          name,
          email,
          role,
          email_verified: true,
        }

        setUser(mockUser)

        setTimeout(() => {
          if (role === 'admin') {
            navigate('/admin')
          } else if (role === 'staff') {
            navigate('/staff')
          } else {
            navigate(redirectUrl)
          }
        }, 500)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    setIsLoading(true)
    setErrorMessage(null)

    // Simulate Google SSO response or trigger OAuth
    setTimeout(() => {
      const mockUser: AuthUser = {
        id: 202,
        name: 'Pengguna Google',
        email: email || 'user.google@gmail.com',
        role: 'customer',
        email_verified: true,
      }
      setUser(mockUser)
      setIsLoading(false)
      navigate(redirectUrl)
    }, 600)
  }

  return (
    <div className="min-h-screen w-full bg-page text-ink flex flex-col lg:flex-row font-sans">
      {/* ─── LEFT HALF: BRAND PANEL (Pinned to Screen, Zero Gaps, No Scroll Lift) ─── */}
      <div className="hidden lg:flex lg:w-1/2 lg:fixed lg:inset-y-0 lg:left-0 bg-brand-panel text-on-chrome p-6 xl:p-10 flex-col justify-between relative overflow-hidden select-none z-10">
        {/* Top Header: Logo & Back Link */}
        <div className="z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-control bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm shadow-sm group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-white text-[22px]">
                flight_takeoff
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight text-white font-sans">Sky</span>
              <span className="text-xl font-bold tracking-tight text-sky-200 font-sans">Book</span>
              <span className="ml-1 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-white/20 text-white">
                WINGS
              </span>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors py-1.5 px-3 rounded-control hover:bg-white/10 border border-transparent hover:border-white/20"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Kembali ke beranda</span>
          </Link>
        </div>

        {/* Center Graphic: Archipelago Route Map + Floating Ticket (Sedang / Balanced Size) */}
        <div className="z-10 my-auto py-2 relative w-full max-w-[460px] mx-auto">
          <div className="mb-2.5 text-left">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-semibold tracking-wide text-sky-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>Konektivitas Nusantara Tanpa Kendala</span>
            </span>
            <h2 className="text-lg xl:text-xl font-bold tracking-tight text-white mt-1.5 leading-snug">
              Akses seluruh pesanan &amp;
              <br />
              jadwal terbang dalam satu akun.
            </h2>
          </div>

          {/* Abstract Archipelago Map (Sedang / Compact Height) */}
          <div className="relative w-full h-[190px] xl:h-[210px] rounded-ticket bg-brand-hover/30 border border-white/15 p-3 backdrop-blur-[2px]">
            <svg
              className="w-full h-full"
              viewBox="0 0 600 280"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Landmass Contours Hint */}
              <path
                d="M40 90 Q 70 70, 110 110 T 170 160"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />
              <path
                d="M160 170 Q 210 160, 270 170 T 360 185"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />
              <path
                d="M280 90 Q 320 80, 360 110 T 420 160"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />
              <path
                d="M380 90 Q 420 100, 480 80 T 550 120"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />

              {/* Flight Routes */}
              {/* KNO - CGK */}
              <path
                d="M70 60 Q 110 130 160 175"
                stroke="#FAFCFF"
                strokeOpacity="0.6"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              {/* CGK - SUB */}
              <path
                d="M160 175 Q 220 190 280 180"
                stroke="#FAFCFF"
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
              {/* SUB - DPS */}
              <path
                d="M280 180 Q 315 190 350 195"
                stroke="#FAFCFF"
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
              {/* SUB - JOG */}
              <path
                d="M280 180 Q 255 185 230 185"
                stroke="#FAFCFF"
                strokeOpacity="0.4"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              {/* CGK - JOG */}
              <path
                d="M160 175 Q 195 185 230 185"
                stroke="#FAFCFF"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              />
              {/* SUB - UPG */}
              <path
                d="M280 180 Q 340 145 400 135"
                stroke="#FAFCFF"
                strokeOpacity="0.5"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />

              {/* Primary Active Route: CGK to DPS with animated stream */}
              <path
                d="M160 175 Q 250 170 350 195"
                stroke="#FAFCFF"
                strokeOpacity="0.95"
                strokeWidth="2.5"
              />
              <path
                d="M160 175 Q 250 170 350 195"
                stroke="#FAFCFF"
                strokeOpacity="0.8"
                strokeWidth="2"
                className="animate-flight-dash"
              />

              {/* City Nodes */}
              {/* KNO */}
              <circle
                cx="70"
                cy="60"
                r="10"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.3"
                strokeWidth="1"
              >
                <animate attributeName="r" values="4;14" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="70" cy="60" r="4.5" fill="#FAFCFF" />
              <circle cx="70" cy="60" r="8" stroke="#FAFCFF" strokeOpacity="0.4" strokeWidth="1" />
              <text x="70" y="44" fill="#FAFCFF" fontSize="13" fontWeight="600" textAnchor="middle">
                KNO
              </text>
              <text x="70" y="78" fill="#FAFCFF" fillOpacity="0.75" fontSize="10" textAnchor="middle">
                Medan
              </text>

              {/* CGK */}
              {/* Radar ripple wave */}
              <circle
                cx="160"
                cy="175"
                r="14"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              >
                <animate attributeName="r" values="6;22" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="160" cy="175" r="5.5" fill="#FAFCFF" />
              <text x="142" y="165" fill="#FAFCFF" fontSize="14" fontWeight="700">
                CGK
              </text>
              <text x="142" y="196" fill="#FAFCFF" fillOpacity="0.8" fontSize="10">
                Jakarta
              </text>

              {/* JOG */}
              <circle cx="230" cy="185" r="4" fill="#FAFCFF" />
              <text x="230" y="206" fill="#FAFCFF" fontSize="12" fontWeight="600" textAnchor="middle">
                JOG
              </text>

              {/* SUB */}
              <circle
                cx="280"
                cy="180"
                r="10"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.3"
                strokeWidth="1"
              >
                <animate attributeName="r" values="4;15" dur="2.8s" begin="0.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="2.8s" begin="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="280" cy="180" r="4.5" fill="#FAFCFF" />
              <text x="280" y="166" fill="#FAFCFF" fontSize="13" fontWeight="600" textAnchor="middle">
                SUB
              </text>
              <text x="280" y="202" fill="#FAFCFF" fillOpacity="0.75" fontSize="10" textAnchor="middle">
                Surabaya
              </text>

              {/* DPS */}
              {/* Radar ripple wave */}
              <circle
                cx="350"
                cy="195"
                r="14"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              >
                <animate attributeName="r" values="6;22" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="350" cy="195" r="5.5" fill="#FAFCFF" />
              <text x="366" y="192" fill="#FAFCFF" fontSize="14" fontWeight="700">
                DPS
              </text>
              <text x="366" y="208" fill="#FAFCFF" fillOpacity="0.8" fontSize="10">
                Denpasar
              </text>

              {/* UPG */}
              <circle cx="400" cy="135" r="4.5" fill="#FAFCFF" />
              <text x="400" y="122" fill="#FAFCFF" fontSize="13" fontWeight="600" textAnchor="middle">
                UPG
              </text>
              <text x="400" y="154" fill="#FAFCFF" fillOpacity="0.75" fontSize="10" textAnchor="middle">
                Makassar
              </text>

              {/* Animated Airplane Flying Along Flight Route Path */}
              <g className="cursor-pointer">
                <animateMotion
                  path="M 160 175 Q 250 170 350 195"
                  dur="5.5s"
                  repeatCount="indefinite"
                  rotate="auto"
                />
                <circle cx="0" cy="0" r="11" fill="#1D5BD6" stroke="#FAFCFF" strokeWidth="1.5" />
                <path
                  d="M 6 0 L -2 -5 L -0.5 -1.2 L -5 -1.2 L -6.5 -3 L -7.5 -2.5 L -6.5 0 L -7.5 2.5 L -6.5 3 L -5 1.2 L -0.5 1.2 L -2 5 Z"
                  fill="#FAFCFF"
                />
              </g>
            </svg>

            {/* Floating Mini Boarding Pass Card with animate-float, pulse dot, and shimmer beam */}
            <div className="absolute -bottom-4 left-3 w-[230px] bg-panel text-ink rounded-ticket shadow-xl p-2.5 border border-line animate-float hover:!transform-none hover:scale-105 hover:shadow-2xl transition-all duration-300 select-none overflow-hidden relative">
              {/* Shimmer light beam pass */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-ticket">
                <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent skew-x-[-20deg] animate-shimmer" />
              </div>

              <div className="flex items-center justify-between border-b border-line pb-1 relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                  </span>
                  <span className="text-[8px] font-bold tracking-wider text-subtle uppercase">
                    BOARDING PASS
                  </span>
                </div>
                <span className="text-[8px] font-bold text-brand-fg bg-tint px-1.5 py-0.5 rounded-full">
                  KA-412
                </span>
              </div>

              <div className="flex items-center justify-between mt-1.5 relative z-10">
                <div>
                  <div className="text-sm font-bold tracking-tight text-ink tabular-nums">CGK</div>
                  <div className="text-[8px] text-subtle">Jakarta</div>
                </div>
                <div className="flex flex-col items-center px-1">
                  <span className="material-symbols-outlined text-brand-fg text-[14px]">
                    arrow_forward
                  </span>
                  <span className="text-[8px] text-subtle">14 Okt</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tracking-tight text-ink tabular-nums">DPS</div>
                  <div className="text-[8px] text-subtle">Denpasar</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 mt-1 border-t border-dashed border-line text-[10px] relative z-10">
                <div>
                  <span className="text-[8px] text-subtle block">Berangkat</span>
                  <span className="font-bold text-ink tabular-nums">07.40</span>
                </div>
                <div>
                  <span className="text-[8px] text-subtle block">Kursi</span>
                  <span className="font-bold text-signal tabular-nums">14A</span>
                </div>
                <div>
                  <span className="text-[8px] text-subtle block">Zona</span>
                  <span className="font-semibold text-ink">2</span>
                </div>
                <div className="w-4 h-4 bg-page border border-line rounded flex items-center justify-center text-ink">
                  <span className="material-symbols-outlined text-[11px]">qr_code</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Rows with Interactive Micro-Animations */}
        <div className="z-10 border-t border-white/20 pt-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-white/90 text-xs xl:text-sm group p-1 -mx-1 rounded-control hover:bg-white/10 transition-all duration-200 cursor-default">
              <div className="w-6 h-6 rounded-control bg-white/10 group-hover:bg-white/20 group-hover:scale-110 flex items-center justify-center shrink-0 transition-all duration-200">
                <span className="material-symbols-outlined text-[15px]">
                  airline_seat_recline_extra
                </span>
              </div>
              <span className="text-left font-sans group-hover:translate-x-1 transition-transform duration-200">
                Pilih kursi sendiri dengan denah kabin interaktif real-time
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-white/90 text-xs xl:text-sm border-t border-white/10 pt-1.5 group p-1 -mx-1 rounded-control hover:bg-white/10 transition-all duration-200 cursor-default">
              <div className="w-6 h-6 rounded-control bg-white/10 group-hover:bg-white/20 group-hover:scale-110 flex items-center justify-center shrink-0 transition-all duration-200">
                <span className="material-symbols-outlined text-[15px]">schedule</span>
              </div>
              <span className="text-left font-sans group-hover:translate-x-1 transition-transform duration-200">
                Check-in online 24 jam sebelum keberangkatan tanpa antre
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-white/90 text-xs xl:text-sm border-t border-white/10 pt-1.5 group p-1 -mx-1 rounded-control hover:bg-white/10 transition-all duration-200 cursor-default">
              <div className="w-6 h-6 rounded-control bg-white/10 group-hover:bg-white/20 group-hover:scale-110 flex items-center justify-center shrink-0 transition-all duration-200">
                <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
              </div>
              <span className="text-left font-sans group-hover:translate-x-1 transition-transform duration-200">
                E-tiket PDF langsung tersimpan di akun dan siap cetak kapan saja
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-[10px] text-white/60">
            <span>&copy; 2026 SkyBook Indonesia</span>
            <span>Standar Keselamatan IATA</span>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-white/5 pointer-events-none blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-brand-hover/40 pointer-events-none blur-2xl" />
      </div>

      {/* ─── RIGHT HALF: FORM PANEL (50% Width on Desktop, Shifted Right with lg:ml-[50%]) ─── */}
      <div className="w-full lg:w-1/2 lg:ml-[50%] min-h-screen bg-page flex flex-col justify-between p-6 sm:p-8 lg:p-10 relative overflow-y-auto">
        {/* Top Header: Mobile Logo & Theme Toggle */}
        <div className="w-full flex justify-between items-center mb-6">
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-fg text-[24px]">
              flight_takeoff
            </span>
            <span className="text-xl font-bold tracking-tight text-ink font-sans">
              Sky<span className="text-brand-fg">Book</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/"
              className="lg:hidden text-xs text-subtle hover:text-ink flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Beranda</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Form Container (440px wide) */}
        <div className="w-full max-w-[440px] mx-auto my-auto py-4 animate-fadeInUp">
          {/* Informational Callout Panel */}
          <div className="mb-5 bg-panel border border-line rounded-control p-3.5 flex items-start gap-3 shadow-sm text-left">
            <div className="w-6 h-6 rounded-full bg-tint text-brand-fg flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[16px]">info</span>
            </div>
            <div className="text-xs text-ink leading-relaxed">
              <span className="font-bold text-ink">Akun Google terhubung?</span>
              <p className="text-subtle mt-0.5">
                Jika sebelumnya mendaftar via Google, masuk dengan tombol satu klik di bawah.
              </p>
            </div>
          </div>

          {/* Main Login Card */}
          <div className="bg-panel rounded-ticket border border-line p-6 sm:p-8 shadow-sm">
            {/* Header */}
            <div className="text-left mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-ink font-sans">
                Masuk ke SkyBook
              </h1>
              <p className="text-subtle text-sm mt-1 leading-normal font-sans">
                Lihat pesanan, unduh e-tiket, dan check-in online.
              </p>
            </div>

            {/* Google One-Click Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-12 rounded-control border border-line bg-panel hover:bg-page hover:border-brand-fg/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 text-ink font-semibold text-sm flex items-center justify-center gap-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-fg active:scale-[0.98] group"
            >
              {/* Official Google Icon SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24" className="group-hover:scale-110 transition-transform duration-200">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Lanjutkan dengan Google</span>
            </button>

            {/* Role Note */}
            <p className="text-[11px] text-subtle text-center mt-2.5">
              Akun staf dan admin masuk dengan email dan kata sandi.
            </p>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-panel px-3 text-subtle font-medium">atau</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {/* Field 1: Email */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold text-ink">
                    Email
                  </label>
                  {isEmailValid && (
                    <span className="text-[11px] text-success flex items-center gap-1 font-semibold animate-scaleIn">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      <span>Format valid</span>
                    </span>
                  )}
                </div>

                <div
                  className={`relative rounded-control transition-all duration-200 ${
                    isEmailValid
                      ? 'border border-success/60 focus-within:ring-2 focus-within:ring-success'
                      : 'border border-line focus-within:ring-2 focus-within:ring-brand-fg focus-within:border-brand-fg'
                  }`}
                >
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle">
                    <span className="material-symbols-outlined text-[18px]">mail</span>
                  </div>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    required
                    className="w-full h-12 pl-10 pr-10 bg-panel text-sm text-ink rounded-control border-0 focus:outline-none font-medium transition-colors"
                  />
                  {isEmailValid && (
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-success animate-scaleIn">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Field 2: Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-ink">
                    Kata sandi
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault()
                      alert('Tautan atur ulang kata sandi akan dikirim ke email terdaftar.')
                    }}
                    className="text-xs text-brand-fg hover:text-brand-hover hover:underline font-semibold transition-colors"
                  >
                    Lupa kata sandi?
                  </a>
                </div>

                <div className="relative rounded-control border border-line focus-within:border-brand-fg focus-within:ring-2 focus-within:ring-brand-fg transition-all duration-200">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    required
                    className="w-full h-12 pl-10 pr-11 bg-panel text-sm text-ink rounded-control border-0 focus:outline-none font-medium transition-colors"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-subtle hover:text-ink focus:outline-none transition-transform duration-150 active:scale-90"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Error Message Box */}
              {errorMessage && (
                <div className="p-3 rounded-control bg-danger/10 border border-danger/30 flex items-start gap-2.5 animate-fadeIn">
                  <span className="material-symbols-outlined text-danger text-[18px] shrink-0 mt-0.5">
                    error
                  </span>
                  <p className="text-xs text-danger font-medium leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              )}

              {/* Primary Submit Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-control bg-brand hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 active:translate-y-0 text-white font-semibold text-sm transition-all duration-200 shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-fg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Akun</span>
                      <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform duration-200">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Register Link */}
            <div className="mt-6 text-center text-sm border-t border-line pt-4 font-sans">
              <span className="text-subtle">Belum punya akun?</span>
              <Link to="/register" className="text-brand-fg hover:underline font-bold ml-1.5">
                Daftar sekarang
              </Link>
            </div>
          </div>

          {/* Security Micro-footer */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-subtle">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <span>Enkripsi TLS 256-bit</span>
            </span>
            <span>&bull;</span>
            <Link to="/#faq" className="hover:text-ink hover:underline">
              Bantuan Masuk
            </Link>
            <span>&bull;</span>
            <Link to="/" className="hover:text-ink hover:underline">
              Privasi
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="w-full flex justify-between items-center text-xs text-subtle pt-4 border-t border-line/60">
          <span>Portal Reservasi Maskapai Nusantara</span>
          <span>v2.4 - Sistem Terverifikasi IATA</span>
        </div>
      </div>
    </div>
  )
}
