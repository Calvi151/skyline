import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
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
  CompletionRing,
  getInitials,
  formatJoinDate,
} from '../../components/profile/ProfileKit'

type TabId = 'account' | 'security' | 'travel'

export default function CustomerProfile() {
  const { user, setUser } = useAuthStore()
  const { toast, setToast } = useToast()
  const [tab, setTab] = useState<TabId>('account')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => res.data?.data && setUser(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setUser])

  const saveField = async (patch: { name?: string; phone?: string | null }) => {
    try {
      const res = await api.put('/auth/profile', {
        name: patch.name ?? user?.name,
        phone: patch.phone !== undefined ? patch.phone || null : user?.phone || null,
      })
      if (user && res.data?.data) setUser({ ...user, ...res.data.data })
      setToast({ type: 'success', message: 'Data profil berhasil diperbarui' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Gagal menyimpan perubahan' })
      throw err
    }
  }

  // Profile completeness calculations
  const completion = useMemo(() => {
    const items = [
      { label: 'Nama lengkap sesuai ID', done: Boolean(user?.name) },
      { label: 'Email terverifikasi', done: Boolean(user?.email_verified) },
      { label: 'Nomor ponsel / WhatsApp', done: Boolean(user?.phone) },
      { label: 'Kata sandi akun', done: user?.has_password !== false },
    ]
    const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100)
    return { items, pct, next: items.find((i) => !i.done) }
  }, [user])

  const totalBookings = user?.stats?.total_bookings ?? 0
  const paidBookings = user?.stats?.paid_bookings ?? 0

  return (
    <div className="min-h-screen bg-page font-sans text-ink flex flex-col">
      <Navbar />

      <main className="flex-1 w-full pt-20 sm:pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
          {/* ─── Profile Masthead (Enterprise SaaS Grade) ─── */}
          <ProfileMasthead
            initials={getInitials(user?.name)}
            name={loading && !user?.name ? 'Memuat profil...' : user?.name}
            roleLabel={user?.role === 'admin' ? 'Administrator' : 'SkyBook Member'}
            roleTone={user?.role === 'admin' ? 'brand' : 'ok'}
            roleIcon={user?.role === 'admin' ? 'shield_person' : 'verified'}
            email={user?.email}
            userId={user?.id}
            joinDate={formatJoinDate(user?.created_at)}
            statusLabel={user?.email_verified ? 'Akun Terverifikasi' : 'Perlu Verifikasi'}
            statusTone={user?.email_verified ? 'ok' : 'muted'}
            actions={
              <div className="flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="h-9 px-3.5 rounded-control border border-line bg-raised hover:bg-panel text-ink text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">confirmation_number</span>
                  <span>Pesanan Saya</span>
                </Link>
                <Link
                  to="/"
                  className="h-9 px-3.5 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98] shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
                  <span>Cari Tiket</span>
                </Link>
              </div>
            }
          />

          {/* ─── Main Content Grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left 8 Cols: Settings Tabs & Sections */}
            <div className="lg:col-span-8 space-y-6 min-w-0">
              <Tabs<TabId>
                active={tab}
                onChange={setTab}
                items={[
                  { id: 'account', label: 'Data Pemesan', icon: 'person' },
                  { id: 'security', label: 'Keamanan Akun', icon: 'shield_lock' },
                  { id: 'travel', label: 'Pusat Perjalanan', icon: 'luggage', count: totalBookings },
                ]}
              />

              <div key={tab} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* TAB 1: DATA PEMESAN */}
                {tab === 'account' && (
                  <>
                    <Section
                      icon="badge"
                      title="Data Kontak Pemesan"
                      description="Data ini otomatis terisi saat memesan tiket agar proses checkout lebih cepat dan akurat."
                    >
                      <EditableRow
                        label="Nama Lengkap"
                        hint="Harus sesuai tanda pengenal resmi KTP / Paspor"
                        value={user?.name || ''}
                        placeholder="Contoh: Budi Santoso"
                        onSave={(v) => saveField({ name: v })}
                      />
                      <EditableRow
                        label="Nomor Ponsel / WhatsApp"
                        hint="Digunakan untuk pengiriman link e-tiket dan update gerbang"
                        type="tel"
                        value={user?.phone || ''}
                        placeholder="Contoh: 081234567890"
                        onSave={(v) => saveField({ phone: v })}
                      />
                      <EditableRow
                        label="Alamat Email Akun"
                        value={user?.email || ''}
                        locked
                        lockedNote="Email utama tidak dapat diubah (hubungi customer care jika diperlukan)"
                      />
                    </Section>

                    <Section
                      icon="notifications"
                      title="Preferensi Notifikasi & Dokumen"
                      description="Atur bagaimana Anda menerima dokumen perjalanan penerbangan."
                    >
                      <InfoRow
                        icon="receipt"
                        title="Format E-Tiket Otomatis"
                        description="E-tiket resmi berformat PDF dan barcode boarding terlampir otomatis di email."
                        right={<StatusPill tone="ok">Standar IATA</StatusPill>}
                      />
                      <InfoRow
                        icon="chat"
                        title="Pemberitahuan Perubahan Jadwal"
                        description="Notifikasi instan jika penerbangan mengalami perubahan gate atau penundaan."
                        right={<StatusPill tone="ok">Aktif</StatusPill>}
                      />
                    </Section>
                  </>
                )}

                {/* TAB 2: KEAMANAN */}
                {tab === 'security' && (
                  <>
                    <Section
                      icon="lock"
                      title="Kredensial & Autentikasi"
                      description="Kelola kata sandi dan metode login Anda ke layanan SkyBook."
                    >
                      <PasswordRow hasPassword={user?.has_password !== false} onToast={setToast} />
                      <InfoRow
                        icon="mark_email_read"
                        title="Verifikasi Alamat Email"
                        description={`Email login Anda: ${user?.email || '-'}`}
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
                        title="Single Sign-On (Google)"
                        description={
                          user?.has_google
                            ? 'Akun Google aktif terhubung. Anda dapat masuk cepat satu klik.'
                            : 'Belum terhubung ke Google. Gunakan email dan kata sandi.'
                        }
                        right={user?.has_google ? <StatusPill tone="ok">Terhubung</StatusPill> : <StatusPill tone="muted">Nonaktif</StatusPill>}
                      />
                    </Section>

                    <Section
                      icon="security"
                      title="Keamanan Data & Privasi"
                      description="Data pemesanan dan dokumen identitas Anda dilindungi dengan enkripsi standar industri perbankan."
                    >
                      <InfoRow
                        icon="shield"
                        title="Enkripsi Data Penumpang"
                        description="Koneksi terenkripsi TLS 1.3 dan penyimpanan data mematuhi standar privasi penerbangan sipil."
                        right={<StatusPill tone="ok">Terenkripsi</StatusPill>}
                      />
                    </Section>
                  </>
                )}

                {/* TAB 3: PUSAT PERJALANAN */}
                {tab === 'travel' && (
                  <>
                    {/* Travel KPI */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 rounded-ticket bg-raised border border-line shadow-xs">
                        <span className="text-xs font-semibold text-subtle block">Total Pesanan Tiket</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-3xl font-black text-ink tabular-nums">{totalBookings}</span>
                          <span className="text-xs text-subtle font-medium">reservasi</span>
                        </div>
                      </div>
                      <div className="p-5 rounded-ticket bg-raised border border-line shadow-xs">
                        <span className="text-xs font-semibold text-subtle block">Tiket Terbit & Lunas</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-3xl font-black text-brand-fg tabular-nums">{paidBookings}</span>
                          <span className="text-xs text-subtle font-medium">e-tiket aktif</span>
                        </div>
                      </div>
                    </div>

                    <Section
                      icon="explore"
                      title="Pintasan Cepat Perjalanan"
                      description="Akses mudah untuk memeriksa status penerbangan dan reservasi Anda."
                    >
                      {[
                        {
                          to: '/dashboard',
                          icon: 'confirmation_number',
                          title: 'Pesanan & E-Tiket Saya',
                          desc: 'Lihat rincian penerbangan, unduh PDF e-tiket, atau ajukan refund online.',
                        },
                        {
                          to: '/check-in',
                          icon: 'qr_code_2',
                          title: 'Check-in Online & Kursi',
                          desc: 'Pilih kursi favorit dan unduh boarding pass digital sebelum menuju bandara.',
                        },
                        {
                          to: '/',
                          icon: 'travel_explore',
                          title: 'Jelajahi Rute Lainnya',
                          desc: 'Cari jadwal penerbangan domestik dengan harga terbaik.',
                        },
                      ].map((item) => (
                        <Link key={item.to} to={item.to} className="group block">
                          <InfoRow
                            icon={item.icon}
                            title={item.title}
                            description={item.desc}
                            right={
                              <span className="material-symbols-outlined text-[18px] text-subtle group-hover:text-brand-fg group-hover:translate-x-1 transition-all">
                                arrow_forward
                              </span>
                            }
                          />
                        </Link>
                      ))}
                    </Section>
                  </>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Aside / Completeness / Support */}
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
              {/* Profile Completeness Card */}
              <div className="p-5 rounded-ticket bg-raised border border-line shadow-xs">
                <div className="flex items-center gap-4">
                  <CompletionRing percent={completion.pct} />
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-ink block">Kelengkapan Profil</span>
                    <span className="text-xs text-subtle block mt-0.5">
                      {completion.next
                        ? `Belum lengkap: ${completion.next.label}`
                        : 'Profil Anda telah 100% lengkap!'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-line/60 space-y-2.5">
                  {completion.items.map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 text-xs">
                      <span
                        className={`material-symbols-outlined text-[16px] shrink-0 ${
                          item.done ? 'text-emerald-500' : 'text-line'
                        }`}
                      >
                        {item.done ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span className={item.done ? 'text-subtle line-through decoration-line/80' : 'text-ink font-semibold'}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {completion.next && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        completion.next?.label.includes('sandi') ||
                        completion.next?.label.includes('verifikasi')
                      ) {
                        setTab('security')
                      } else {
                        setTab('account')
                      }
                    }}
                    className="mt-4 w-full h-9 rounded-control bg-tint text-brand-fg text-xs font-semibold hover:bg-tint/70 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Lengkapi Sekarang</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                )}
              </div>

              {/* Help & Support Card */}
              <div className="p-5 rounded-ticket bg-panel/70 border border-line space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-control bg-raised border border-line text-brand-fg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">support_agent</span>
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-ink">Bantuan Pelanggan 24/7</h4>
                    <span className="text-[11px] text-subtle">Tim operasional siap membantu</span>
                  </div>
                </div>
                <p className="text-xs text-subtle leading-relaxed">
                  Jika Anda membutuhkan perubahan data nama tiket setelah terbit atau pertanyaan seputar bagasi tambahan, hubungi tim helpdesk.
                </p>
                <div className="pt-1 flex items-center justify-between text-xs font-semibold text-brand-fg">
                  <span className="font-mono">support@skybook.com</span>
                  <span className="text-[11px] text-subtle font-normal">Tanggapan &lt; 15 mnt</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
