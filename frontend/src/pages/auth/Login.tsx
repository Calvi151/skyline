import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useAuthStore, AuthUser } from '../../store/authStore'
import { api } from '../../lib/api'
import ThemeToggle from '../../components/common/ThemeToggle'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/dashboard'
  const registeredSuccess = searchParams.get('registered') === '1'

  const { setUser } = useAuthStore()

  // Form states
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showNotFoundModal, setShowNotFoundModal] = useState(false)

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
      const res = await api.post('/auth/login', { email: email.trim().toLowerCase(), password })
      const userData: AuthUser = res.data.data?.user || res.data.user
      setUser(userData)

      // ALUR URUTAN: Jika email belum diverifikasi, arahkan ke verifikasi email!
      if (!userData.email_verified) {
        navigate(`/check-email?email=${encodeURIComponent(userData.email)}`)
        return
      }

      // Role-based redirection
      if (userData.role === 'admin') {
        navigate('/admin')
      } else if (userData.role === 'staff') {
        navigate('/staff')
      } else {
        navigate(redirectUrl)
      }
    } catch (err: any) {
      const status = err.response?.status
      const code = err.response?.data?.code
      const serverMsg = err.response?.data?.message || err.response?.data?.error

      if (code === 'EMAIL_NOT_VERIFIED' || (serverMsg && serverMsg.toLowerCase().includes('belum diverifikasi'))) {
        navigate(`/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
        return
      }

      if (
        status === 404 ||
        code === 'USER_NOT_FOUND' ||
        (serverMsg && (
          serverMsg.toLowerCase().includes('belum terdaftar') ||
          serverMsg.toLowerCase().includes('tidak ditemukan')
        ))
      ) {
        // Tampilkan Modal bahwa akun belum terdaftar
        setShowNotFoundModal(true)
        setErrorMessage(null)
      } else if (serverMsg) {
        setErrorMessage(serverMsg)
      } else {
        setErrorMessage('Terjadi gangguan koneksi. Pastikan server backend sedang berjalan.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setErrorMessage('Kredensial Google tidak ditemukan.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const res = await api.post('/auth/google', {
        credential: credentialResponse.credential,
        mode: 'login',
      })
      const userData: AuthUser = res.data.data?.user || res.data.user
      setUser(userData)

      // ALUR URUTAN: Jika email belum diverifikasi, arahkan ke verifikasi email!
      if (!userData.email_verified) {
        navigate(`/check-email?email=${encodeURIComponent(userData.email)}`)
        return
      }

      if (userData.role === 'admin') {
        navigate('/admin')
      } else if (userData.role === 'staff') {
        navigate('/staff')
      } else {
        navigate(redirectUrl)
      }
    } catch (err: any) {
      const status = err.response?.status
      const code = err.response?.data?.code
      const serverMsg = err.response?.data?.message || err.response?.data?.error
      const errorEmail = err.response?.data?.email

      if (
        status === 404 ||
        code === 'USER_NOT_FOUND' ||
        (serverMsg && (
          serverMsg.toLowerCase().includes('belum terdaftar') ||
          serverMsg.toLowerCase().includes('tidak ditemukan')
        ))
      ) {
        if (errorEmail) {
          setEmail(errorEmail)
        }
        setShowNotFoundModal(true)
        setErrorMessage(null)
      } else if (serverMsg) {
        setErrorMessage(serverMsg)
      } else {
        setErrorMessage(
          'Gagal masuk dengan akun Google. Pastikan Client ID sudah terdaftar di Google Cloud.'
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleError = () => {
    setErrorMessage('Login Google dibatalkan atau terjadi masalah koneksi.')
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
        <div className="z-10 my-auto py-2 mb-10 relative w-full max-w-[460px] mx-auto">
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

          {/* Abstract Archipelago Map (Sedang / Balanced Height) */}
          <div className="relative w-full h-[210px] xl:h-[230px] rounded-ticket bg-brand-hover/30 border border-white/15 p-3 backdrop-blur-[2px]">
            <svg
              className="w-full h-full"
              viewBox="0 0 600 240"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Landmass Contours Hint */}
              <path
                d="M35 75 Q 65 55, 105 45 T 180 90"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />
              <path
                d="M205 118 Q 275 125, 355 132 T 430 142"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />
              <path
                d="M255 58 Q 305 48, 355 68 T 405 92"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />
              <path
                d="M435 68 Q 465 52, 480 78 T 485 115"
                stroke="#FAFCFF"
                strokeWidth="1.2"
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />

              {/* Flight Routes */}
              {/* KNO - CGK */}
              <path
                d="M 95 48 Q 155 85 225 118"
                stroke="#FAFCFF"
                strokeOpacity="0.6"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              {/* CGK - SUB */}
              <path
                d="M 225 118 Q 285 125 350 130"
                stroke="#FAFCFF"
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
              {/* SUB - DPS */}
              <path
                d="M 350 130 Q 385 135 420 140"
                stroke="#FAFCFF"
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
              {/* CGK - JOG */}
              <path
                d="M 225 118 Q 260 130 290 138"
                stroke="#FAFCFF"
                strokeOpacity="0.4"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              {/* SUB - UPG */}
              <path
                d="M 350 130 Q 410 100 465 82"
                stroke="#FAFCFF"
                strokeOpacity="0.5"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />

              {/* Primary Active Route: CGK to DPS with animated stream */}
              <path
                d="M 225 118 Q 320 108 420 140"
                stroke="#FAFCFF"
                strokeOpacity="0.95"
                strokeWidth="2.5"
              />
              <path
                d="M 225 118 Q 320 108 420 140"
                stroke="#FAFCFF"
                strokeOpacity="0.8"
                strokeWidth="2"
                className="animate-flight-dash"
              />

              {/* City Nodes */}
              {/* KNO (Medan) */}
              <circle
                cx="95"
                cy="48"
                r="10"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.3"
                strokeWidth="1"
              >
                <animate attributeName="r" values="4;14" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="95" cy="48" r="4.5" fill="#FAFCFF" />
              <circle cx="95" cy="48" r="8" stroke="#FAFCFF" strokeOpacity="0.4" strokeWidth="1" />
              <text x="95" y="32" fill="#FAFCFF" fontSize="13" fontWeight="600" textAnchor="middle">
                KNO
              </text>
              <text x="95" y="66" fill="#FAFCFF" fillOpacity="0.75" fontSize="10" textAnchor="middle">
                Medan
              </text>

              {/* CGK (Jakarta) */}
              <circle
                cx="225"
                cy="118"
                r="14"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              >
                <animate attributeName="r" values="6;22" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="225" cy="118" r="5.5" fill="#FAFCFF" />
              <text x="210" y="105" fill="#FAFCFF" fontSize="14" fontWeight="700">
                CGK
              </text>
              <text x="210" y="136" fill="#FAFCFF" fillOpacity="0.8" fontSize="10">
                Jakarta
              </text>

              {/* JOG */}
              <circle cx="290" cy="138" r="4" fill="#FAFCFF" />
              <text x="290" y="156" fill="#FAFCFF" fontSize="12" fontWeight="600" textAnchor="middle">
                JOG
              </text>

              {/* SUB (Surabaya) */}
              <circle
                cx="350"
                cy="130"
                r="10"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.3"
                strokeWidth="1"
              >
                <animate attributeName="r" values="4;15" dur="2.8s" begin="0.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="2.8s" begin="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="350" cy="130" r="4.5" fill="#FAFCFF" />
              <text x="350" y="115" fill="#FAFCFF" fontSize="13" fontWeight="600" textAnchor="middle">
                SUB
              </text>
              <text x="350" y="150" fill="#FAFCFF" fillOpacity="0.75" fontSize="10" textAnchor="middle">
                Surabaya
              </text>

              {/* DPS (Denpasar) */}
              <circle
                cx="420"
                cy="140"
                r="14"
                stroke="#FAFCFF"
                fill="none"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              >
                <animate attributeName="r" values="6;22" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="420" cy="140" r="5.5" fill="#FAFCFF" />
              <text x="435" y="136" fill="#FAFCFF" fontSize="14" fontWeight="700">
                DPS
              </text>
              <text x="435" y="152" fill="#FAFCFF" fillOpacity="0.8" fontSize="10">
                Denpasar
              </text>

              {/* UPG (Makassar) */}
              <circle cx="465" cy="82" r="4.5" fill="#FAFCFF" />
              <text x="465" y="68" fill="#FAFCFF" fontSize="13" fontWeight="600" textAnchor="middle">
                UPG
              </text>
              <text x="465" y="100" fill="#FAFCFF" fillOpacity="0.75" fontSize="10" textAnchor="middle">
                Makassar
              </text>

              {/* Animated Airplane Flying Along Flight Route Path */}
              <g className="cursor-pointer">
                <animateMotion
                  path="M 225 118 Q 320 108 420 140"
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
            <div className="absolute -bottom-8 -left-3 sm:-left-5 xl:-left-6 z-20 w-[220px] bg-panel text-ink rounded-ticket shadow-2xl p-2.5 border border-line animate-float hover:!transform-none hover:scale-105 hover:shadow-2xl transition-all duration-300 select-none overflow-hidden">
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
        <div className="z-10 border-t border-white/20 pt-3.5">
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
          {/* Notification: Baru Selesai Registrasi */}
          {registeredSuccess && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-control p-4 flex items-start gap-3 shadow-sm text-left animate-fadeIn">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
              </div>
              <div className="text-xs text-ink leading-relaxed">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm block">Pendaftaran Berhasil!</span>
                <p className="text-subtle mt-0.5">
                  Akun Anda telah terdaftar. Silakan masukkan kata sandi yang baru Anda buat untuk masuk ke akun Anda.
                </p>
              </div>
            </div>
          )}

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

            {/* Google Official Button */}
            <div className="w-full flex justify-center [&>div]:w-full [&>div>div]:w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                size="large"
                text="continue_with"
                width="100%"
                shape="rectangular"
              />
            </div>

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

      {/* ─── MODAL: AKUN BELUM TERDAFTAR ─── */}
      {showNotFoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-panel border border-line rounded-ticket max-w-md w-full p-6 sm:p-7 shadow-2xl relative animate-scaleIn text-left">
            <button
              type="button"
              onClick={() => setShowNotFoundModal(false)}
              className="absolute top-4 right-4 text-subtle hover:text-ink w-8 h-8 rounded-full flex items-center justify-center hover:bg-tint transition-colors"
              aria-label="Tutup"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="w-14 h-14 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4 shadow-sm">
              <span className="material-symbols-outlined text-[30px]">person_search</span>
            </div>

            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pemberitahuan Akun
            </span>
            <h3 className="text-xl font-bold text-ink mt-1">
              Akun Belum Terdaftar
            </h3>

            <p className="text-sm text-subtle mt-2.5 leading-relaxed">
              Email <strong className="text-ink font-semibold break-all">{email}</strong> belum terdaftar di sistem SkyBook. Silakan daftarkan akun baru Anda terlebih dahulu untuk melanjutkan pemesanan tiket penerbangan.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowNotFoundModal(false)
                  navigate(`/register?email=${encodeURIComponent(email)}`)
                }}
                className="flex-1 h-11 px-4 rounded-control bg-brand hover:bg-brand-hover hover:shadow-md hover:shadow-brand/25 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-[0.98]"
              >
                <span>Daftar Akun Baru</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNotFoundModal(false)}
                className="h-11 px-4 rounded-control border border-line hover:bg-tint text-subtle hover:text-ink font-semibold text-sm transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
