import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Navbar from '../../components/layout/Navbar'

export default function AdminDashboard() {
  const { user } = useAuthStore()

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-page flex flex-col font-sans text-ink">
      <Navbar />
      <main className="flex-1 pt-[88px] pb-10 px-4 md:px-6">
        <div className="max-w-[1100px] mx-auto">
          <h1 className="text-2xl font-bold text-ink mb-2">Panel Admin</h1>
          <p className="text-sm text-subtle mb-6">Selamat datang, {user.name}</p>
          <p className="text-subtle text-sm">Halaman ini akan didesain dari Stitch.</p>
        </div>
      </main>
    </div>
  )
}
