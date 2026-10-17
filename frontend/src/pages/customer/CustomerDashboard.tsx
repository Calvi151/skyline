import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/layout/Navbar'

export default function CustomerDashboard() {
  const { user } = useAuthStore()

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-page flex flex-col font-sans text-ink">
      <Navbar />
      <main className="flex-1 pt-[88px] pb-10 px-4 md:px-6">
        <div className="max-w-[960px] mx-auto">
          <h1 className="text-2xl font-bold text-ink mb-2">Dashboard Customer</h1>
          <p className="text-sm text-subtle mb-6">Selamat datang, {user.name} ({user.email})</p>

          {!user.email_verified && (
            <div className="mb-6 p-4 rounded-control bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">warning</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">Email Belum Diverifikasi</p>
                <p className="text-xs text-subtle mt-0.5">Verifikasi email agar dapat memesan tiket.</p>
              </div>
              <Link to={`/check-email?email=${encodeURIComponent(user.email)}`} className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-control hover:bg-amber-600 transition-colors">
                Verifikasi
              </Link>
            </div>
          )}

          <p className="text-subtle text-sm">Halaman ini akan didesain dari Stitch.</p>
        </div>
      </main>
    </div>
  )
}
