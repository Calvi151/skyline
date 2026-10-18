import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import ThemeToggle from '../../components/common/ThemeToggle'
import { useAuthStore, type AuthUser } from '../../store/authStore'
import { api } from '../../lib/api'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setUser = useAuthStore((state) => state.setUser)

  // Form State
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showAlreadyRegisteredModal, setShowAlreadyRegisteredModal] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  // Interactive seat preview toggle state
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['14A', '15C'])

  // Password validation checks
  const hasMinLength = password.length >= 8
  const hasLetters = /[a-zA-Z]/.test(password)
  const hasNumbersOrSymbols = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password)
  const isPasswordMatch =
    confirmPassword.length > 0 && password === confirmPassword

  // Strength score: 0 to 3
  const strengthScore =
    (hasMinLength ? 1 : 0) +
    (hasLetters ? 1 : 0) +
    (hasNumbersOrSymbols ? 1 : 0)

  // Keyboard accessibility for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAlreadyRegisteredModal(false)
      }
    }
    if (showAlreadyRegisteredModal) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAlreadyRegisteredModal])

  const toggleSeat = (seatId: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatId)
        ? prev.filter((s) => s !== seatId)
        : [...prev, seatId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!fullName.trim()) {
      setErrorMessage('Nama lengkap wajib diisi')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Format email tidak valid')
      return
    }

    if (!hasMinLength || !hasLetters) {
      setErrorMessage('Kata sandi belum memenuhi kriteria keamanan')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok')
      return
    }

    setIsLoading(true)

    try {
      const cleanPhone = phone.trim()
        ? phone.startsWith('0')
          ? '+62' + phone.slice(1)
          : phone.startsWith('+')
          ? phone
          : '+62' + phone
        : undefined

      const response = await api.post('/auth/register', {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: cleanPhone,
      })

      if (response.data && !response.data.error) {
        // Alur urutan: Setelah register -> arahkan ke halaman Cek Email
        navigate(`/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
      } else {
        setErrorMessage(response.data.message || 'Registrasi gagal. Silakan coba lagi.')
      }
    } catch (err: any) {
      const status = err.response?.status
      const code = err.response?.data?.code
      const serverMsg = err.response?.data?.message
      const targetEmail = err.response?.data?.email || email.trim().toLowerCase()

      if (
        status === 409 ||
        code === 'EMAIL_ALREADY_REGISTERED' ||
        (serverMsg && serverMsg.toLowerCase().includes('terdaftar'))
      ) {
        setRegisteredEmail(targetEmail)
        setShowAlreadyRegisteredModal(true)
        setErrorMessage(null)
      } else if (serverMsg) {
        setErrorMessage(serverMsg)
      } else {
        setErrorMessage('Terjadi kendala pada server. Pastikan backend aktif dan coba lagi.')
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
        mode: 'register',
      })
      const userData: AuthUser = res.data.data?.user || res.data.user
      setUser(userData)
      navigate('/dashboard')
    } catch (err: any) {
      const status = err.response?.status
      const code = err.response?.data?.code
      const serverMsg = err.response?.data?.message
      const targetEmail = err.response?.data?.email || ''

      if (
        status === 409 ||
        code === 'EMAIL_ALREADY_REGISTERED' ||
        (serverMsg && serverMsg.toLowerCase().includes('terdaftar'))
      ) {
        setRegisteredEmail(targetEmail)
        setShowAlreadyRegisteredModal(true)
        setErrorMessage(null)
      } else {
        setErrorMessage(
          serverMsg || 'Gagal mendaftar dengan akun Google.'
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleError = () => {
    setErrorMessage('Pendaftaran Google dibatalkan atau terjadi masalah koneksi.')
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

        {/* Center Graphic: Cabin Seat Map Showcase (Interactive Stitch B3 Design) */}
        <div className="z-10 my-auto py-2 mb-6 relative w-full max-w-[460px] mx-auto">
          {/* Header & Tagline */}
          <div className="mb-3 text-left">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-semibold tracking-wide text-sky-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>Pilihan Kabin Fleksibel</span>
            </span>
            <h2 className="text-lg xl:text-xl font-bold tracking-tight text-white mt-1.5 leading-snug">
              Pilih kursi sendiri sebelum terbang.
            </h2>
            <p className="text-xs text-white/75 mt-1 leading-relaxed">
              Buat akun, verifikasi email, lalu pesan tiket ke seluruh Indonesia.
            </p>
          </div>

          {/* Graphic Container with Peeking Secondary Ticket & Seat Map Card */}
          <div className="relative pt-4 pb-2">
            {/* Peeking Background Ticket (Decorative Stacking Layer with Hover Interaction) */}
            <div className="absolute -bottom-2 right-1 w-64 h-36 bg-white/10 backdrop-blur-md rounded-ticket p-3.5 border border-white/20 transform rotate-6 translate-x-3 translate-y-3 pointer-events-none z-0 hidden sm:block transition-all duration-500 hover:rotate-8 hover:translate-x-4">
              <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">
                  BOARDING TICKET
                </span>
                <span className="text-[10px] font-bold text-sky-200 tabular-nums">SB-882</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[8px] text-white/60">Rute</p>
                  <p className="text-xs font-bold text-white tracking-tight">CGK → DPS</p>
                </div>
                <div className="w-10 h-10 bg-white/15 border border-white/30 rounded flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">qr_code</span>
                </div>
              </div>
            </div>

            {/* Main Interactive Seat Map Card with Floating Animation & Shimmer */}
            <div className="relative z-10 bg-panel text-ink rounded-ticket p-4 sm:p-5 shadow-2xl border border-line animate-float hover:!transform-none hover:scale-[1.02] transition-all duration-300 overflow-hidden select-none">
              {/* Shimmer light sweep pass */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-ticket">
                <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent skew-x-[-20deg] animate-shimmer" />
              </div>

              {/* Card Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-line relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-fg opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-fg" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                    PETA KURSI KABIN (ROW 14-16)
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tint text-brand-fg border border-line/60">
                  Boeing 737-800
                </span>
              </div>

              {/* Column Identifiers (A B C [LORONG] D E F) */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-subtle my-2.5 px-1">
                <div>A</div>
                <div>B</div>
                <div>C</div>
                <div className="text-[8px] text-muted flex items-center justify-center font-medium tracking-tighter">
                  LORONG
                </div>
                <div>D</div>
                <div>E</div>
                <div>F</div>
              </div>

              {/* Seat Matrix Grid */}
              <div className="space-y-1.5">
                {/* Row 14 */}
                <div className="grid grid-cols-7 gap-1.5 items-center text-center">
                  {/* 14A Selected (Coral Signature) */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('14A')}
                    className={`h-8 rounded-control flex items-center justify-center text-xs font-bold transition-all shadow-sm active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('14A')
                        ? 'bg-signal text-white ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-ink hover:border-brand-fg'
                    }`}
                    title="Kursi 14A"
                  >
                    {selectedSeats.includes('14A') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '14A'
                    )}
                  </button>

                  {/* 14B Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('14B')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('14B')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('14B') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '14B'
                    )}
                  </button>

                  {/* 14C Taken */}
                  <div
                    className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed select-none"
                    title="14C Terisi"
                  >
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  {/* Row Indicator */}
                  <span className="text-[10px] font-bold text-subtle select-none">14</span>

                  {/* 14D Taken */}
                  <div
                    className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed select-none"
                    title="14D Terisi"
                  >
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  {/* 14E Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('14E')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('14E')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('14E') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '14E'
                    )}
                  </button>

                  {/* 14F Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('14F')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('14F')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('14F') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '14F'
                    )}
                  </button>
                </div>

                {/* Row 15 (Contains Selected 15C with Floating Bobbing Tooltip) */}
                <div className="grid grid-cols-7 gap-1.5 items-center text-center relative">
                  {/* 15A Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('15A')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('15A')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('15A') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '15A'
                    )}
                  </button>

                  {/* 15B Taken */}
                  <div
                    className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed select-none"
                    title="15B Terisi"
                  >
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  {/* 15C Selected with Floating Bobbing Tooltip */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => toggleSeat('15C')}
                      className={`w-full h-8 rounded-control flex items-center justify-center text-xs font-bold transition-all shadow-sm active:scale-90 hover:scale-105 duration-150 ${
                        selectedSeats.includes('15C')
                          ? 'bg-signal text-white ring-2 ring-signal/30 scale-105 animate-seat-pop'
                          : 'bg-panel border border-line text-ink hover:border-brand-fg'
                      }`}
                      title="Kursi 15C"
                    >
                      {selectedSeats.includes('15C') ? (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      ) : (
                        '15C'
                      )}
                    </button>

                    {/* Floating Bobbing Tooltip Anchor */}
                    {selectedSeats.includes('15C') && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-brand-panel text-white text-[9px] font-semibold px-2 py-0.5 rounded shadow-lg pointer-events-none z-30 animate-fadeIn animate-bob">
                        Kursi 15C, lorong, gratis
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-panel" />
                      </div>
                    )}
                  </div>

                  {/* Row Indicator */}
                  <span className="text-[10px] font-bold text-subtle select-none">15</span>

                  {/* 15D Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('15D')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('15D')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('15D') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '15D'
                    )}
                  </button>

                  {/* 15E Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('15E')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('15E')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('15E') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '15E'
                    )}
                  </button>

                  {/* 15F Taken */}
                  <div
                    className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed select-none"
                    title="15F Terisi"
                  >
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>
                </div>

                {/* Row 16 */}
                <div className="grid grid-cols-7 gap-1.5 items-center text-center">
                  {/* 16A Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('16A')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('16A')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('16A') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '16A'
                    )}
                  </button>

                  {/* 16B Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('16B')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('16B')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('16B') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '16B'
                    )}
                  </button>

                  {/* 16C Taken */}
                  <div
                    className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed select-none"
                    title="16C Terisi"
                  >
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  {/* Row Indicator */}
                  <span className="text-[10px] font-bold text-subtle select-none">16</span>

                  {/* 16D Taken */}
                  <div
                    className="h-8 rounded-control bg-page/70 border border-line/50 flex items-center justify-center text-muted cursor-not-allowed select-none"
                    title="16D Terisi"
                  >
                    <span className="material-symbols-outlined text-[13px] opacity-60">close</span>
                  </div>

                  {/* 16E Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('16E')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('16E')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('16E') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '16E'
                    )}
                  </button>

                  {/* 16F Available */}
                  <button
                    type="button"
                    onClick={() => toggleSeat('16F')}
                    className={`h-8 rounded-control flex items-center justify-center text-[11px] font-medium transition-all active:scale-90 hover:scale-105 duration-150 ${
                      selectedSeats.includes('16F')
                        ? 'bg-signal text-white font-bold ring-2 ring-signal/30 scale-105 animate-seat-pop'
                        : 'bg-panel border border-line text-subtle hover:text-ink hover:border-brand-fg hover:bg-tint'
                    }`}
                  >
                    {selectedSeats.includes('16F') ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      '16F'
                    )}
                  </button>
                </div>
              </div>

              {/* Seat Selection Summary Footer */}
              <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-signal inline-block" />
                  <span className="font-bold text-ink">
                    {selectedSeats.length} kursi dipilih
                  </span>
                  <span className="text-subtle">({selectedSeats.join(', ') || 'Belum ada'})</span>
                </div>
                <span className="font-semibold text-brand-fg tabular-nums">
                  {selectedSeats.length > 0 ? '+ Rp 90.000 ruang kaki lebih luas' : 'Pilih kursi favorit'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Rows with Interactive Micro-Animations */}
        <div className="z-10 border-t border-white/20 pt-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-white/90 text-xs xl:text-sm group p-1 -mx-1 rounded-control hover:bg-white/10 transition-all duration-200 cursor-default">
              <div className="w-6 h-6 rounded-control bg-white/10 group-hover:bg-white/20 group-hover:scale-110 flex items-center justify-center shrink-0 transition-all duration-200">
                <span className="material-symbols-outlined text-[15px]">
                  airline_seat_recline_extra
                </span>
              </div>
              <span className="text-left font-sans group-hover:translate-x-1 transition-transform duration-200">
                Peta kursi interaktif langsung dari sistem reservasi
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-white/90 text-xs xl:text-sm border-t border-white/10 pt-1.5 group p-1 -mx-1 rounded-control hover:bg-white/10 transition-all duration-200 cursor-default">
              <div className="w-6 h-6 rounded-control bg-white/10 group-hover:bg-white/20 group-hover:scale-110 flex items-center justify-center shrink-0 transition-all duration-200">
                <span className="material-symbols-outlined text-[15px]">mark_email_read</span>
              </div>
              <span className="text-left font-sans group-hover:translate-x-1 transition-transform duration-200">
                Verifikasi email cepat dalam 24 jam
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-white/90 text-xs xl:text-sm border-t border-white/10 pt-1.5 group p-1 -mx-1 rounded-control hover:bg-white/10 transition-all duration-200 cursor-default">
              <div className="w-6 h-6 rounded-control bg-white/10 group-hover:bg-white/20 group-hover:scale-110 flex items-center justify-center shrink-0 transition-all duration-200">
                <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
              </div>
              <span className="text-left font-sans group-hover:translate-x-1 transition-transform duration-200">
                Penyimpanan e-tiket otomatis &amp; check-in instan
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-[10px] text-white/60">
            <span>&copy; 2026 SkyBook Indonesia</span>
            <span>Standar Keselamatan IATA</span>
          </div>
        </div>

        {/* Ambient background glows with pulse animation */}
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-white/5 pointer-events-none blur-3xl animate-pulse-glow" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-brand-hover/40 pointer-events-none blur-2xl animate-pulse-glow" />
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

        {/* Registration Card Form with Fade-In-Up entrance */}
        <div className="w-full max-w-[460px] mx-auto my-auto py-2 animate-fadeInUp">
          <div className="bg-panel rounded-ticket border border-line p-6 sm:p-8 shadow-sm">
            {/* Form Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-ink tracking-tight font-sans">
                Daftar Akun SkyBook
              </h1>
              <p className="text-sm text-subtle mt-1.5 leading-relaxed">
                Daftar untuk memilih kursi favorit dan mengelola pesanan tiket.
              </p>
            </div>

            {/* Google Signup Button */}
            <div className="mb-5 flex justify-center [&>div]:w-full [&>div>div]:w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                size="large"
                text="signup_with"
                width="100%"
                shape="rectangular"
              />
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-5">
              <div className="w-full border-t border-line" />
              <span className="bg-panel px-3 text-xs uppercase text-subtle font-medium absolute">
                atau
              </span>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-control bg-error/10 border border-error/30 flex items-start gap-2.5 text-xs text-error animate-fadeIn"
              >
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                  error
                </span>
                <p className="leading-snug">
                  {errorMessage}{' '}
                  {errorMessage.includes('terdaftar') && (
                    <Link to="/login" className="underline font-semibold hover:opacity-80">
                      Masuk sekarang
                    </Link>
                  )}
                </p>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Nama Lengkap */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="fullName">
                  Nama lengkap (sesuai KTP/paspor)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="w-full h-11 pl-10 pr-4 bg-panel border border-line rounded-control text-sm text-ink placeholder:text-subtle/60 focus:border-brand-fg focus:ring-2 focus:ring-brand-fg/20 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Field 2: Email */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle">
                    <span className="material-symbols-outlined text-[18px]">mail</span>
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full h-11 pl-10 pr-4 bg-panel border border-line rounded-control text-sm text-ink placeholder:text-subtle/60 focus:border-brand-fg focus:ring-2 focus:ring-brand-fg/20 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Field 3: Nomor Telepon (+62 Prefix Group) */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="phone">
                  Nomor telepon (opsional)
                </label>
                <div className="flex rounded-control border border-line bg-panel h-11 focus-within:border-brand-fg focus-within:ring-2 focus-within:ring-brand-fg/20 transition-all overflow-hidden">
                  <div className="flex items-center pl-3.5 pr-2.5 gap-1.5 border-r border-line bg-page text-xs font-bold text-ink shrink-0 select-none">
                    <span className="material-symbols-outlined text-[16px] text-subtle">call</span>
                    <span>+62</span>
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="812 3456 7890"
                    className="w-full h-full px-3 bg-panel text-sm text-ink tabular-nums outline-none border-0 focus:ring-0 placeholder:text-subtle/60"
                  />
                </div>
              </div>

              {/* Field 4: Kata Sandi */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="password">
                  Kata sandi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full h-11 pl-10 pr-10 bg-panel border border-line rounded-control text-sm text-ink placeholder:text-subtle/60 focus:border-brand-fg focus:ring-2 focus:ring-brand-fg/20 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-subtle hover:text-ink focus:outline-none"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator & Live Checklist */}
              {password.length > 0 && (
                <div className="space-y-2 pt-0.5 animate-fadeIn">
                  {/* 3-segment bar */}
                  <div className="grid grid-cols-3 gap-1.5 h-1.5">
                    <div
                      className={`rounded-full transition-colors ${
                        strengthScore >= 1
                          ? strengthScore === 1
                            ? 'bg-warning'
                            : 'bg-brand'
                          : 'bg-line'
                      }`}
                    />
                    <div
                      className={`rounded-full transition-colors ${
                        strengthScore >= 2
                          ? strengthScore === 2
                            ? 'bg-brand'
                            : 'bg-success'
                          : 'bg-line'
                      }`}
                    />
                    <div
                      className={`rounded-full transition-colors ${
                        strengthScore >= 3 ? 'bg-success' : 'bg-line'
                      }`}
                    />
                  </div>

                  {/* Checklist items */}
                  <div className="space-y-1 text-[11px]">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasMinLength ? 'text-success font-medium' : 'text-subtle'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {hasMinLength ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>Minimal 8 karakter</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasLetters ? 'text-success font-medium' : 'text-subtle'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {hasLetters ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>Ada kombinasi huruf</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasNumbersOrSymbols ? 'text-success font-medium' : 'text-subtle'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {hasNumbersOrSymbols ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>Ada angka atau simbol</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Field 5: Konfirmasi Kata Sandi */}
              <div>
                <label
                  className="block text-xs font-semibold text-ink mb-1.5"
                  htmlFor="confirmPassword"
                >
                  Konfirmasi kata sandi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle">
                    <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi"
                    className="w-full h-11 pl-10 pr-20 bg-panel border border-line rounded-control text-sm text-ink placeholder:text-subtle/60 focus:border-brand-fg focus:ring-2 focus:ring-brand-fg/20 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-14 pr-2 flex items-center text-subtle hover:text-ink focus:outline-none"
                    aria-label={
                      showConfirmPassword
                        ? 'Sembunyikan konfirmasi kata sandi'
                        : 'Tampilkan konfirmasi kata sandi'
                    }
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>

                  {/* Dynamic Match Badge with Spring Scale-In Animation */}
                  {confirmPassword.length > 0 && (
                    <div
                      className={`absolute inset-y-0 right-0 pr-3 flex items-center gap-1 pointer-events-none text-xs font-bold transition-all ${
                        isPasswordMatch
                          ? 'text-success animate-scaleIn'
                          : 'text-error animate-scaleIn'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isPasswordMatch ? 'check' : 'close'}
                      </span>
                      <span>{isPasswordMatch ? 'Cocok' : 'Beda'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Explanatory Note */}
              <p className="text-[11px] text-subtle leading-normal">
                Kami akan mengirim tautan verifikasi ke email kamu.
              </p>

              {/* Submit Button with Hover Lift, Shadow, and Arrow Nudge */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-brand hover:bg-brand-hover active:bg-brand-active text-white text-sm font-semibold rounded-control transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-brand/40 flex items-center justify-center gap-2 disabled:opacity-60 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mendaftarkan akun...</span>
                  </>
                ) : (
                  <>
                    <span>Buat akun</span>
                    <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform duration-200">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>

            {/* Redirect to Login */}
            <div className="text-center mt-5 text-xs text-subtle">
              Sudah punya akun?{' '}
              <Link to="/login" className="text-brand-fg underline font-semibold hover:opacity-80">
                Masuk
              </Link>
            </div>

            {/* Security & Legal Footnote */}
            <div className="mt-5 pt-4 border-t border-line text-center text-[11px] text-subtle flex items-center justify-center gap-1.5 flex-wrap">
              <span>Enkripsi TLS 256-bit</span>
              <span>&bull;</span>
              <a href="#" className="hover:underline">
                Kebijakan Privasi
              </a>
              <span>&bull;</span>
              <a href="#" className="hover:underline">
                Syarat &amp; Ketentuan
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="w-full flex justify-between items-center text-xs text-subtle pt-4 border-t border-line/60">
          <span>Portal Reservasi Maskapai Nusantara</span>
          <span>v2.4 - Sistem Terverifikasi IATA</span>
        </div>
      </div>

      {/* ─── MODAL: AKUN SUDAH TERDAFTAR ─── */}
      {showAlreadyRegisteredModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowAlreadyRegisteredModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-registered-title"
        >
          <div
            className="bg-panel border border-line rounded-ticket max-w-md w-full p-6 sm:p-7 shadow-2xl relative animate-scaleIn text-left select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAlreadyRegisteredModal(false)}
              className="absolute top-4 right-4 text-subtle hover:text-ink w-8 h-8 rounded-full flex items-center justify-center hover:bg-tint transition-colors"
              aria-label="Tutup"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            {/* Header Icon with Aviation Badge */}
            <div className="w-14 h-14 rounded-full bg-brand-fg/15 text-brand-fg flex items-center justify-center mb-4 shadow-sm border border-brand-fg/20">
              <span className="material-symbols-outlined text-[30px]">how_to_reg</span>
            </div>

            {/* Micro Badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-fg font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-fg animate-pulse" />
              <span>Sistem Reservasi • Akun Terdaftar</span>
            </div>

            {/* Headline */}
            <h3 id="modal-registered-title" className="text-xl font-bold text-ink mt-1 font-sans tracking-tight">
              Akun Sudah Terdaftar
            </h3>

            {/* Description */}
            <p className="text-sm text-subtle mt-2.5 leading-relaxed">
              Email{' '}
              <strong className="text-ink font-semibold break-all font-mono bg-page px-2 py-0.5 rounded border border-line">
                {registeredEmail || email}
              </strong>{' '}
              sudah memiliki akun aktif di SkyBook.
            </p>

            {/* Aviation Boarding Info Notice */}
            <div className="mt-4 p-3.5 rounded-control bg-page/80 border border-line flex items-start gap-3 text-xs text-subtle">
              <span className="material-symbols-outlined text-[18px] text-brand-fg shrink-0 mt-0.5">
                flight_takeoff
              </span>
              <p className="leading-relaxed text-ink/90">
                Anda tidak perlu mendaftar ulang. Silakan masuk untuk mengakses tiket, memilih kursi, atau mengelola reservasi penerbangan Anda.
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowAlreadyRegisteredModal(false)
                  navigate(`/login?email=${encodeURIComponent(registeredEmail || email)}`)
                }}
                className="flex-1 h-11 px-4 rounded-control bg-brand hover:bg-brand-hover hover:shadow-md hover:shadow-brand/25 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-[0.98] group"
              >
                <span>Masuk Sekarang</span>
                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform duration-200">
                  arrow_forward
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowAlreadyRegisteredModal(false)}
                className="h-11 px-4 rounded-control border border-line hover:bg-tint text-subtle hover:text-ink font-semibold text-sm transition-colors"
              >
                Gunakan Email Lain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
