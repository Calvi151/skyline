import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ThemeToggle from '../../components/common/ThemeToggle'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, setUser } = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Tautan verifikasi tidak valid atau tidak memiliki token verifikasi.')
      return
    }

    const verifyToken = async () => {
      try {
        const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
        if (response.data && !response.data.error) {
          setStatus('success')
          setMessage('Email berhasil diverifikasi! Akun Anda sekarang aktif dan siap digunakan.')
          if (user) {
            setUser({ ...user, email_verified: true })
          }
        } else {
          setStatus('error')
          setMessage(response.data?.message || 'Tautan verifikasi sudah kedaluwarsa atau tidak valid.')
        }
      } catch (err: any) {
        const apiError = err.response?.data?.message
        setStatus('error')
        setMessage(apiError || 'Tautan verifikasi sudah kedaluwarsa atau tidak valid.')
      }
    }

    verifyToken()
  }, [token, user, setUser])

  return (
    <div className="min-h-screen w-full bg-page text-ink flex flex-col justify-between font-sans">
      {/* Top Navbar Header */}
      <header className="w-full border-b border-line bg-panel/80 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-control bg-tint text-brand-fg flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tracking-tight text-ink font-sans">Sky</span>
            <span className="text-lg font-bold tracking-tight text-brand-fg font-sans">Book</span>
            <span className="ml-1 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-tint text-brand-fg">
              WINGS
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-subtle hover:text-ink font-medium hidden sm:inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">home</span>
            <span>Beranda</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Verification Card */}
      {/* Main Verification Card */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-panel border border-line rounded-ticket p-8 shadow-sm text-center animate-fadeInUp">
          {status === 'loading' && (
            <div className="py-8 space-y-4">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-brand-fg/15 animate-ping opacity-75" />
                <div className="w-12 h-12 border-3 border-brand-fg/20 border-t-brand-fg rounded-full animate-spin relative z-10" />
              </div>
              <h1 className="text-xl font-bold text-ink">Memverifikasi email...</h1>
              <p className="text-xs text-subtle">Mohon tunggu sebentar, sistem sedang memvalidasi akun kamu.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4 space-y-4 animate-scaleIn">
              <div className="relative w-16 h-16 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto shadow-sm">
                <span className="absolute inset-0 rounded-full bg-success/20 animate-ping opacity-60" />
                <span className="material-symbols-outlined text-[36px] relative z-10">verified</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-success uppercase tracking-wider">
                  Verifikasi Berhasil
                </span>
                <h1 className="text-2xl font-bold text-ink mt-1">Akun Berhasil Diaktifkan</h1>
              </div>
              <p className="text-sm text-subtle leading-relaxed">{message}</p>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/login"
                  className="h-11 px-6 bg-brand hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 active:translate-y-0 text-white rounded-control font-semibold text-sm flex items-center justify-center gap-1.5 transition-all duration-200 shadow-sm active:scale-[0.99] group"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>Masuk ke Akun</span>
                  <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform duration-200">arrow_forward</span>
                </Link>
                <Link
                  to="/"
                  className="h-11 px-5 border border-line bg-panel hover:bg-tint text-ink rounded-control font-semibold text-sm flex items-center justify-center transition-colors"
                >
                  Cari Penerbangan
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4 space-y-4 animate-scaleIn">
              <div className="w-16 h-16 rounded-full bg-error/15 text-error flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[36px]">gpp_maybe</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-error uppercase tracking-wider">
                  Tautan Tidak Valid
                </span>
                <h1 className="text-2xl font-bold text-ink mt-1">Gagal Memverifikasi</h1>
              </div>
              <p className="text-sm text-subtle leading-relaxed">{message}</p>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/login"
                  className="h-11 px-5 bg-brand hover:bg-brand-hover hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 text-white rounded-control font-semibold text-sm flex items-center justify-center transition-all shadow-sm"
                >
                  Halaman Masuk
                </Link>
                <Link
                  to="/register"
                  className="h-11 px-5 border border-line bg-panel hover:bg-tint text-ink rounded-control font-semibold text-sm flex items-center justify-center transition-colors"
                >
                  Daftar Ulang
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-line/60 py-4 px-6 text-center text-xs text-subtle flex items-center justify-between flex-wrap gap-2">
        <span>Portal Reservasi Maskapai Nusantara</span>
        <span>&copy; 2026 SkyBook Indonesia • v2.4</span>
      </footer>
    </div>
  )
}
