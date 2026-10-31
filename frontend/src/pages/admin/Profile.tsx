import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import {
  Toast,
  useToast,
  ProfileMasthead,
  Tabs,
  Section,
  EditableRow,
  InfoRow,
  StatusPill,
  PasswordRow,
  getInitials,
  formatJoinDate,
} from '../../components/profile/ProfileKit'

type TabId = 'account' | 'security' | 'access'

interface ModuleInfo {
  path: string
  icon: string
  title: string
  desc: string
  category: string
  permissions: string[]
}

const MODULES: ModuleInfo[] = [
  {
    path: '/admin/flights',
    icon: 'calendar_month',
    title: 'Jadwal Penerbangan',
    desc: 'Buat jadwal rute baru, sesuaikan armada, atur status delay & pembatalan.',
    category: 'Flight Ops',
    permissions: ['Baca', 'Tulis', 'Ubah Status'],
  },
  {
    path: '/admin/airports',
    icon: 'connecting_airports',
    title: 'Bandara & Navigasi',
    desc: 'Registri kode IATA/ICAO, nama kota, zona waktu, dan terminal bandara.',
    category: 'Master Data',
    permissions: ['Baca', 'Kelola'],
  },
  {
    path: '/admin/airlines',
    icon: 'airlines',
    title: 'Maskapai Rekanan',
    desc: 'Master data maskapai komersial, armada terdaftar, dan logo resmi operator.',
    category: 'Aviation',
    permissions: ['Baca', 'Kelola Logo'],
  },
  {
    path: '/admin/airplanes',
    icon: 'flight',
    title: 'Pesawat & Armada',
    desc: 'Nomor registrasi pesawat, kapasitas kabin, dan konfigurasi tata letak kursi.',
    category: 'Fleet Ops',
    permissions: ['Baca', 'Konfigurasi Kursi'],
  },
  {
    path: '/admin/baggage-options',
    icon: 'luggage',
    title: 'Tarif & Opsi Bagasi',
    desc: 'Aturan jatah bagasi kabin cuma-cuma dan skema tarif bagasi tercatat prabayar.',
    category: 'Commercial',
    permissions: ['Baca', 'Atur Tarif'],
  },
  {
    path: '/admin/refunds',
    icon: 'currency_exchange',
    title: 'Pengajuan Refund',
    desc: 'Tinjau klaim pembatalan, validasi nomor rekening tujuan & otorisasi transfer.',
    category: 'Finance & Audit',
    permissions: ['Tinjau', 'Setujui / Tolak'],
  },
  {
    path: '/admin/users',
    icon: 'group',
    title: 'Pengguna & Akses',
    desc: 'Pengawasan akun pengguna, penetapan peran administrator, dan reset kredensial.',
    category: 'Security IAM',
    permissions: ['Kelola Akun', 'Atur Peran'],
  },
  {
    path: '/staff',
    icon: 'qr_code_scanner',
    title: 'Operasional Gate Boarding',
    desc: 'Pemeriksaan manifest penumpang penerbangan dan verifikasi boarding pass di gate.',
    category: 'Ground Ops',
    permissions: ['Scan QR', 'Manifest Check'],
  },
]

export default function AdminProfile() {
  const { user, setUser } = useAuthStore()
  const { toast, setToast } = useToast()
  const [tab, setTab] = useState<TabId>('account')

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => res.data?.data && setUser(res.data.data))
      .catch(() => {})
  }, [setUser])

  const saveField = async (patch: { name?: string; phone?: string | null }) => {
    try {
      const res = await api.put('/auth/profile', {
        name: patch.name ?? user?.name,
        phone: patch.phone !== undefined ? patch.phone || null : user?.phone || null,
      })
      if (user && res.data?.data) setUser({ ...user, ...res.data.data })
      setToast({ type: 'success', message: 'Perubahan profil berhasil disimpan' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Gagal menyimpan perubahan' })
      throw err
    }
  }

  return (
    <AdminLayout currentSection="Profil Saya">
      <div className="max-w-5xl space-y-6">
        {/* ─── Profile Masthead (Enterprise SaaS Grade) ─── */}
        <ProfileMasthead
          initials={getInitials(user?.name)}
          name={user?.name}
          roleLabel="Administrator Ops"
          roleTone="brand"
          roleIcon="shield_person"
          email={user?.email}
          userId={user?.id}
          joinDate={formatJoinDate(user?.created_at)}
          statusLabel="Sesi Aktif (Level 1 Root)"
          statusTone="ok"
          actions={
            <div className="flex items-center gap-2">
              <Link
                to="/staff"
                className="h-9 px-3.5 rounded-control border border-line bg-raised hover:bg-panel text-ink text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                <span>Gate Scanner</span>
              </Link>
              <Link
                to="/admin"
                className="h-9 px-3.5 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98] shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">query_stats</span>
                <span>Dasbor Analitik</span>
              </Link>
            </div>
          }
        />

        {/* ─── Navigation Tabs ─── */}
        <Tabs<TabId>
          active={tab}
          onChange={setTab}
          items={[
            { id: 'account', label: 'Identitas & Akun', icon: 'badge' },
            { id: 'security', label: 'Keamanan & Autentikasi', icon: 'shield_lock' },
            { id: 'access', label: 'Matriks Hak Akses', icon: 'admin_panel_settings', count: MODULES.length },
          ]}
        />

        {/* ─── Tab Content Views ─── */}
        <div key={tab} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* TAB 1: AKUN */}
          {tab === 'account' && (
            <>
              <Section
                icon="account_circle"
                title="Informasi Petugas Operasional"
                description="Identitas penanggung jawab resmi yang tercatat di audit trail setiap pembaruan jadwal dan otorisasi penerbangan."
              >
                <EditableRow
                  label="Nama Petugas"
                  hint="Nama lengkap sesuai surat tugas resmi"
                  value={user?.name || ''}
                  placeholder="Contoh: Administrator SkyBook"
                  onSave={(v) => saveField({ name: v })}
                />
                <EditableRow
                  label="Kontak Hotline Internal"
                  hint="Nomor telepon dinas / ekstensi WhatsApp"
                  type="tel"
                  value={user?.phone || ''}
                  placeholder="Contoh: 081200001111"
                  onSave={(v) => saveField({ phone: v })}
                />
                <EditableRow
                  label="Email Kredensial Operasional"
                  value={user?.email || ''}
                  locked
                  lockedNote="Kredensial login root (hanya diubah via konsol master)"
                />
              </Section>

              <Section
                icon="tune"
                title="Preferensi Lingkungan Sistem"
                description="Konfigurasi default antarmuka operasional penerbangan SkyBook Airlines Ops."
              >
                <InfoRow
                  icon="schedule"
                  title="Zona Waktu Operasional"
                  description="Waktu Indonesia Barat (WIB, UTC+7). Sinkronisasi otomatis dengan server timekeeper ICAO."
                  right={<StatusPill tone="ok">WIB (UTC+7)</StatusPill>}
                />
                <InfoRow
                  icon="verified"
                  title="Tingkat Otorisasi (RBAC)"
                  description="Akses Super Administrator Level 1 dengan otoritas penuh pada seluruh pangkalan udara dan maskapai."
                  right={<StatusPill tone="brand">Super Admin</StatusPill>}
                />
                <InfoRow
                  icon="receipt_long"
                  title="Pencatatan Audit Trail"
                  description="Setiap aksi modifikasi data jadwal, perubahan status delay, dan persetujuan refund dicatat permanen."
                  right={<StatusPill tone="ok">Logging Aktif</StatusPill>}
                />
              </Section>
            </>
          )}

          {/* TAB 2: KEAMANAN */}
          {tab === 'security' && (
            <>
              <Section
                icon="lock"
                title="Kredensial & Autentikasi Masuk"
                description="Pastikan kata sandi memenuhi standar keamanan tinggi untuk melindungi akses administratif maskapai."
              >
                <PasswordRow hasPassword={user?.has_password !== false} onToast={setToast} />
                <InfoRow
                  icon="mark_email_read"
                  title="Status Verifikasi Email"
                  description={`Alamat email operasional: ${user?.email || '-'}`}
                  right={
                    user?.email_verified ? (
                      <StatusPill tone="ok">
                        <span className="material-symbols-outlined text-[13px]">check</span>Terverifikasi
                      </StatusPill>
                    ) : (
                      <StatusPill tone="warn">Belum Diverifikasi</StatusPill>
                    )
                  }
                />
                <InfoRow
                  icon="account_circle"
                  title="Single Sign-On (Google Workspace)"
                  description={
                    user?.has_google
                      ? 'Akun Google terhubung untuk otentikasi cepat.'
                      : 'Akun Google belum terhubung. Masuk manual via email & sandi.'
                  }
                  right={user?.has_google ? <StatusPill tone="ok">Terhubung</StatusPill> : <StatusPill tone="muted">Nonaktif</StatusPill>}
                />
              </Section>

              <Section
                icon="devices"
                title="Keamanan Sesi & Lingkungan Operasional"
                description="Status koneksi sesi yang sedang berjalan saat ini."
              >
                <InfoRow
                  icon="computer"
                  title="Sesi Perangkat Saat Ini"
                  description="Aplikasi web browser pada jaringan operasional SkyBook."
                  right={<StatusPill tone="ok">Sesi Ini (Aktif)</StatusPill>}
                />
                <InfoRow
                  icon="shield"
                  title="Enkripsi Token"
                  description="Bearer JSON Web Token (JWT) dengan penandatanganan kriptografis HMAC SHA-256."
                  right={<StatusPill tone="muted">HMAC-SHA256</StatusPill>}
                />
              </Section>
            </>
          )}

          {/* TAB 3: HAK AKSES MODUL */}
          {tab === 'access' && (
            <div className="space-y-6">
              {/* Permission Banner KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-ticket bg-raised border border-line shadow-xs">
                  <span className="text-[11px] font-semibold text-subtle uppercase tracking-wider block">Total Modul</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-ink tabular-nums">{MODULES.length}</span>
                    <span className="text-xs text-subtle font-medium">modul aktif</span>
                  </div>
                </div>
                <div className="p-4 rounded-ticket bg-raised border border-line shadow-xs">
                  <span className="text-[11px] font-semibold text-subtle uppercase tracking-wider block">Tingkat Izin</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-brand-fg">Level 1</span>
                    <span className="text-xs text-subtle font-medium">Super Admin</span>
                  </div>
                </div>
                <div className="p-4 rounded-ticket bg-raised border border-line shadow-xs">
                  <span className="text-[11px] font-semibold text-subtle uppercase tracking-wider block">Audit Log</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">100%</span>
                    <span className="text-xs text-subtle font-medium">terekam</span>
                  </div>
                </div>
                <div className="p-4 rounded-ticket bg-raised border border-line shadow-xs">
                  <span className="text-[11px] font-semibold text-subtle uppercase tracking-wider block">Terminal Gate</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-ink">Online</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">• live</span>
                  </div>
                </div>
              </div>

              {/* Module Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MODULES.map((m) => (
                  <Link
                    key={m.path}
                    to={m.path}
                    className="group p-5 rounded-ticket bg-raised border border-line hover:border-brand/40 hover:shadow-md transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-control bg-tint/40 border border-line/60 text-brand-fg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-[20px]">{m.icon}</span>
                          </span>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-subtle block">
                              {m.category}
                            </span>
                            <h4 className="text-sm font-bold text-ink group-hover:text-brand-fg transition-colors">
                              {m.title}
                            </h4>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-subtle group-hover:text-brand-fg group-hover:translate-x-1 transition-all">
                          arrow_forward
                        </span>
                      </div>
                      <p className="text-xs text-subtle mt-3 leading-relaxed">{m.desc}</p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-line/50">
                      {m.permissions.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-panel border border-line text-subtle"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AdminLayout>
  )
}
