import { useState, useEffect, useMemo } from 'react'
import AdminLayout from '../../components/layout/AdminLayout'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import Pagination from '../../components/common/Pagination'

interface UserItem {
  id: number
  name: string
  email: string
  phone: string | null
  role: 'admin' | 'staff' | 'customer'
  is_active: boolean
  created_at: string
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'staff' | 'customer'>('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [openModal, setOpenModal] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [tempPasswordCopied, setTempPasswordCopied] = useState<string | null>(null)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Form states for adding staff
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff' as 'staff' | 'admin',
    password: '',
    sendEmail: true,
  })
  const [submitting, setSubmitting] = useState(false)

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ error: boolean; data: UserItem[] }>('/admin/users')
      if (res.data?.data) {
        setUsers(res.data.data)
      }
    } catch (err) {
      console.error('Gagal mengambil daftar pengguna:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
    let pwd = 'SkyOps#'
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData((prev) => ({ ...prev, password: pwd }))
  }

  // Open modal with freshly generated password
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      password: '',
      sendEmail: true,
    })
    generatePassword()
    setOpenModal(true)
  }

  // Submit Add Staff
  const handleSubmitStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.password) {
      alert('Nama, email, dan kata sandi wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post<{
        error: boolean
        message: string
        data: UserItem
      }>('/admin/users', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
        role: formData.role,
      })

      if (res.data?.data) {
        const createdUser = res.data.data
        setUsers((prev) => [
          {
            ...createdUser,
            phone: formData.phone || null,
            is_active: true,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ])
        setTempPasswordCopied(formData.password)
        setToastMessage(`Akun staf untuk ${formData.name} berhasil dibuat.`)
        setOpenModal(false)
      }
    } catch (err: any) {
      console.error('Gagal membuat akun staf:', err)
      alert(err.response?.data?.message || 'Gagal membuat pengguna baru')
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle user active status
  const handleToggleActive = async (targetUser: UserItem) => {
    if (targetUser.id === currentUser?.id) {
      alert('Anda tidak dapat menonaktifkan akun Anda sendiri.')
      return
    }

    try {
      const nextStatus = !targetUser.is_active
      await api.put(`/admin/users/${targetUser.id}`, { is_active: nextStatus })
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextStatus } : u))
      )
      setToastMessage(
        `Akun ${targetUser.name} telah ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`
      )
      setActiveMenuId(null)
    } catch (err: any) {
      console.error('Gagal mengubah status aktif pengguna:', err)
      alert(err.response?.data?.message || 'Gagal mengubah status akun')
    }
  }

  // Toggle user role
  const handleChangeRole = async (targetUser: UserItem, nextRole: 'admin' | 'staff' | 'customer') => {
    if (targetUser.id === currentUser?.id && nextRole !== 'admin') {
      alert('Anda tidak boleh menurunkan hak akses akun sendiri.')
      return
    }

    try {
      await api.put(`/admin/users/${targetUser.id}`, { role: nextRole })
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
      )
      setToastMessage(`Role untuk ${targetUser.name} berhasil diubah ke ${nextRole}.`)
      setActiveMenuId(null)
    } catch (err: any) {
      console.error('Gagal mengubah role pengguna:', err)
      alert(err.response?.data?.message || 'Gagal mengubah role akun')
    }
  }

  // Copy password to clipboard
  const handleCopyPassword = (pwd: string) => {
    navigator.clipboard?.writeText(pwd)
    alert('Kata sandi sementara disalin ke clipboard!')
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = 'ID,Nama,Email,Telepon,Role,Status,Terdaftar\n'
    const rows = users
      .map(
        (u) =>
          `USR-${u.id},"${u.name}","${u.email}","${u.phone || '-'}",${u.role},${
            u.is_active ? 'Aktif' : 'Nonaktif'
          },"${u.created_at}"`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Daftar_Pengguna_SkyBook_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedRole !== 'all' && u.role !== selectedRole) return false
      if (selectedStatus === 'active' && !u.is_active) return false
      if (selectedStatus === 'inactive' && u.is_active) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = u.name.toLowerCase().includes(q)
        const matchEmail = u.email.toLowerCase().includes(q)
        const matchPhone = (u.phone || '').toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchPhone) return false
      }

      return true
    })
  }, [users, selectedRole, selectedStatus, searchQuery])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedRole, selectedStatus, searchQuery])

  // Pagination Slice
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage, pageSize])

  // Counts
  const totalCount = users.length
  const adminCount = users.filter((u) => u.role === 'admin').length
  const staffCount = users.filter((u) => u.role === 'staff').length
  const customerCount = users.filter((u) => u.role === 'customer').length

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  return (
    <AdminLayout currentSection="Pengguna">
      <div className="w-full px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-6 max-w-[1440px] mx-auto">
        {/* ─── TOP AREA: CONTEXT & PAGE TITLE ─── */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col max-w-2xl">
            <div className="flex items-center gap-1.5 text-subtle text-xs uppercase tracking-wider font-semibold mb-1">
              <span className="material-symbols-outlined text-[16px] text-brand-fg">security</span>
              <span>MANAJEMEN HAK AKSES &amp; OTENTIKASI • PROTOKOL RBAC AKTIF</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Pengguna &amp; Staf
            </h1>
            <p className="text-xs sm:text-sm text-subtle leading-relaxed mt-0.5">
              Kelola akun pengguna, penugasan hak akses operasional (Admin &amp; Staf Gerbang/Ground crew), dan otentikasi sistem.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="h-11 px-4 flex items-center gap-1.5 rounded-control bg-raised border border-line text-ink hover:bg-tint transition-colors text-xs font-semibold"
            >
              <span className="material-symbols-outlined text-[18px] text-subtle">file_download</span>
              <span>Ekspor Daftar (CSV)</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-11 px-4 flex items-center gap-1.5 rounded-control bg-brand hover:bg-brand-hover text-white transition-colors text-xs font-semibold shadow-xs active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>+ Tambah staf</span>
            </button>
          </div>
        </header>

        {/* ─── FILTER & SEARCH CONTROLS PANEL ─── */}
        <section className="bg-panel border border-line rounded-ticket p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shadow-xs">
          {/* Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[260px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, email, atau nomor telepon..."
                className="w-full h-10 pl-9 pr-24 rounded-control bg-panel border border-line text-ink placeholder:text-subtle text-xs focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-xs"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-tint text-brand-fg text-[10px] font-semibold tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span>{filteredUsers.length} hasil</span>
              </div>
            </div>

            {/* Segmented Role Filter Tabs */}
            <nav className="flex items-center p-1 rounded-xl bg-raised border border-line shrink-0 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setSelectedRole('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedRole === 'all'
                    ? 'bg-panel text-brand-fg shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                Semua <span className="font-normal opacity-70 ml-0.5">({totalCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedRole === 'admin'
                    ? 'bg-panel text-brand-fg shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                Admin <span className="font-normal opacity-70 ml-0.5">({adminCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('staff')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedRole === 'staff'
                    ? 'bg-panel text-brand-fg shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                Staf Operasional <span className="font-normal opacity-70 ml-0.5">({staffCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('customer')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedRole === 'customer'
                    ? 'bg-panel text-brand-fg shadow-xs'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                Customer <span className="font-normal opacity-70 ml-0.5">({customerCount})</span>
              </button>
            </nav>
          </div>

          {/* Right Status Filter */}
          <div className="flex items-center gap-3 shrink-0 text-xs">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="h-10 px-3 rounded-control bg-panel border border-line text-ink font-semibold focus:outline-none focus:border-brand cursor-pointer shadow-xs"
            >
              <option value="all">Status: Semua</option>
              <option value="active">Status: Aktif</option>
              <option value="inactive">Status: Nonaktif</option>
            </select>

            <div className="flex items-center gap-1.5 text-subtle text-[11px]">
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span className="uppercase font-semibold tracking-wider">Sinkron 1 mnt lalu</span>
            </div>
          </div>
        </section>

        {/* ─── USERS DATA TABLE ─── */}
        <section className="bg-panel border border-line rounded-ticket shadow-xs overflow-visible">
          <div className="overflow-x-auto min-h-[420px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="h-11 bg-raised border-b border-line text-subtle font-semibold text-[11px] uppercase tracking-wider">
                  <th className="w-12 px-4 text-center">
                    <input type="checkbox" className="rounded accent-brand cursor-pointer" />
                  </th>
                  <th className="py-3 px-4">PENGGUNA</th>
                  <th className="py-3 px-4">EMAIL &amp; KONTAK</th>
                  <th className="py-3 px-4">ROLE / PERAN</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">TERDAFTAR</th>
                  <th className="py-3 px-4 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-subtle">
                      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-subtle">
                      Tidak ada pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((userItem) => {
                    const initials = userItem.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()

                    const roleLabel =
                      userItem.role === 'admin'
                        ? 'Admin Utama'
                        : userItem.role === 'staff'
                        ? 'Staf Operasional'
                        : 'Customer'

                    const roleColor =
                      userItem.role === 'admin'
                        ? 'bg-tint text-brand-fg font-bold'
                        : userItem.role === 'staff'
                        ? 'bg-raised text-ink font-semibold border border-line'
                        : 'bg-page text-subtle'

                    const isSelf = userItem.id === currentUser?.id

                    return (
                      <tr key={userItem.id} className="hover:bg-tint/20 transition-colors">
                        <td className="px-4 text-center">
                          <input type="checkbox" className="rounded accent-brand cursor-pointer" />
                        </td>

                        {/* Pengguna Identity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-tint text-brand-fg flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-ink truncate text-sm">
                                {userItem.name}
                                {isSelf && (
                                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-tint text-brand-fg">
                                    Anda
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] uppercase font-semibold text-subtle tracking-wider font-mono">
                                ID: USR-{userItem.id.toString().padStart(5, '0')}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="text-ink font-medium">{userItem.email}</span>
                            <span className="text-subtle text-[11px] font-mono mt-0.5">
                              {userItem.phone || '+62 812-xxxx-xxxx'}
                            </span>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${roleColor}`}>
                            {roleLabel}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {userItem.is_active ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/15 text-success font-semibold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-success" />
                              <span>Aktif</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-danger/15 text-danger font-semibold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                              <span>Nonaktif</span>
                            </div>
                          )}
                        </td>

                        {/* Terdaftar */}
                        <td className="py-3.5 px-4 text-subtle tabular-nums whitespace-nowrap">
                          {formatDate(userItem.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right relative">
                          <div className="inline-flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveMenuId(activeMenuId === userItem.id ? null : userItem.id)
                              }}
                              className="w-8 h-8 rounded-control inline-flex items-center justify-center text-subtle hover:text-ink hover:bg-raised transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_vert</span>
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === userItem.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-4 top-10 w-56 rounded-control bg-panel border border-line shadow-xl z-50 text-left py-1 text-xs"
                              >
                                {userItem.role !== 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleChangeRole(userItem, 'admin')}
                                    className="w-full px-3 py-2 flex items-center gap-2 text-ink hover:bg-tint transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-brand-fg">
                                      admin_panel_settings
                                    </span>
                                    <span>Jadikan Admin Utama</span>
                                  </button>
                                )}
                                {userItem.role !== 'staff' && (
                                  <button
                                    type="button"
                                    onClick={() => handleChangeRole(userItem, 'staff')}
                                    className="w-full px-3 py-2 flex items-center gap-2 text-ink hover:bg-tint transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-brand-fg">
                                      badge
                                    </span>
                                    <span>Tugaskan sebagai Staf</span>
                                  </button>
                                )}
                                <div className="h-px bg-line my-1" />
                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => handleToggleActive(userItem)}
                                  className={`w-full px-3 py-2 flex items-center gap-2 transition-colors ${
                                    isSelf
                                      ? 'text-subtle/50 cursor-not-allowed'
                                      : userItem.is_active
                                      ? 'text-danger hover:bg-danger/10'
                                      : 'text-success hover:bg-success/10'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {userItem.is_active ? 'person_off' : 'person_check'}
                                  </span>
                                  <span>
                                    {userItem.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setCurrentPage(1)
            }}
            pageSizeOptions={[10, 15, 25, 50]}
            itemLabel="pengguna"
          />
        </section>

        {/* ─── FLOATING DIALOG MODAL: TAMBAH STAF BARU ─── */}
        {openModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn"
          >
            <div className="w-full max-w-[500px] bg-panel border border-line rounded-ticket shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
              {/* Header */}
              <div className="p-5 border-b border-line flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink">Tambah Staf Baru</h2>
                  <p className="text-xs text-subtle mt-0.5">
                    Daftarkan akun staf baru untuk operasional darat atau sistem tiket.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-subtle hover:text-ink hover:bg-raised transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitStaff} className="p-5 flex flex-col gap-4 text-xs">
                {/* Field: Nama Lengkap */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink" htmlFor="staff-name">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
                      person
                    </span>
                    <input
                      id="staff-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: Ahmad Rizky Pratama"
                      className="w-full h-11 pl-9 pr-3 rounded-control bg-raised border border-line text-ink text-xs focus:bg-panel focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Field: Email Resmi */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink" htmlFor="staff-email">
                    Email Resmi
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
                      mail
                    </span>
                    <input
                      id="staff-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="ahmad.rizky@skybook.co.id"
                      className="w-full h-11 pl-9 pr-3 rounded-control bg-raised border border-line text-ink text-xs focus:bg-panel focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Field: Nomor Telepon */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink" htmlFor="staff-phone">
                    Nomor Telepon Operasional
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
                      phone
                    </span>
                    <input
                      id="staff-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+62 813-7766-5544"
                      className="w-full h-11 pl-9 pr-3 rounded-control bg-raised border border-line text-ink text-xs font-mono focus:bg-panel focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Field: Penugasan Peran */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink" htmlFor="staff-role">
                    Penugasan Peran (Role RBAC)
                  </label>
                  <select
                    id="staff-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full h-11 px-3 rounded-control bg-raised border border-line text-ink text-xs font-semibold focus:bg-panel focus:outline-none focus:border-brand"
                  >
                    <option value="staff">Staf Gerbang / Ground Ops (Gate Crew)</option>
                    <option value="admin">Admin Sistem (Full Access)</option>
                  </select>
                </div>

                {/* Field: Kata Sandi Sementara */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-ink" htmlFor="staff-pwd">
                      Kata Sandi Sementara
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-brand-fg hover:underline font-bold text-[11px] uppercase tracking-wider"
                    >
                      Buat Otomatis
                    </button>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-[18px]">
                      key
                    </span>
                    <input
                      id="staff-pwd"
                      type="text"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full h-11 pl-9 pr-3 rounded-control bg-raised border border-line text-ink text-xs font-mono focus:bg-panel focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Checkbox notification */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="send-email"
                    type="checkbox"
                    checked={formData.sendEmail}
                    onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
                    className="rounded accent-brand mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="send-email" className="text-subtle text-[11px] leading-snug cursor-pointer">
                    Kirim kredensial login dan panduan aktivasi via email ke staf terkait secara aman.
                  </label>
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenModal(false)}
                    className="h-10 px-4 rounded-control bg-raised border border-line text-ink hover:bg-tint text-xs font-semibold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-10 px-5 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan & Buat Akun'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── FLOATING TOAST NOTIFICATION ─── */}
        {toastMessage && (
          <aside className="fixed bottom-6 right-6 z-50 bg-panel border border-line rounded-ticket p-4 shadow-xl flex items-start gap-3 max-w-md animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
            <div className="flex-1 text-xs pr-2">
              <span className="font-bold text-ink block">{toastMessage}</span>
              {tempPasswordCopied && (
                <button
                  type="button"
                  onClick={() => handleCopyPassword(tempPasswordCopied)}
                  className="mt-1 text-brand-fg font-semibold hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Salin sandi sementara ({tempPasswordCopied})</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setToastMessage(null)
                setTempPasswordCopied(null)
              }}
              className="text-subtle hover:text-ink p-1 rounded"
              aria-label="Tutup notifikasi"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </aside>
        )}
      </div>
    </AdminLayout>
  )
}

