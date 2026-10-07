import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from '../pages/customer/Landing'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* Placeholder routes for search, login, register etc. */}
        <Route path="/search" element={<div className="p-8 pt-24 text-ink">Hasil Pencarian (segera hadir)</div>} />
        <Route path="/login" element={<div className="p-8 pt-24 text-ink">Login (segera hadir)</div>} />
        <Route path="/register" element={<div className="p-8 pt-24 text-ink">Daftar (segera hadir)</div>} />
      </Routes>
    </BrowserRouter>
  )
}
