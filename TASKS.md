# Task Breakdown - SkyBook (Untuk AI Agent / Development Tracking)

Urutan desain dan implementasi halaman: lihat `STITCH_PROMPT.md` (hanya untuk membuat desain di Stitch) dan `PAGE_PROMPTS.md` (kode per halaman).

Catatan revisi data real (lihat PRD bagian 8): tugas tambahan ditandai "(revisi data real)". Phase 1 dan 2 yang sudah dicentang tidak diubah. Perubahan database dibuat sebagai **migrasi baru** (drizzle-kit generate), jangan mengedit migrasi awal.

## Phase 1: Setup & Auth (Week 1)
- [x] Setup monorepo structure (frontend + backend)
- [x] Setup Hono.js project + TypeScript config
- [x] Setup Drizzle ORM + PostgreSQL connection
- [x] Buat schema database lengkap (semua tabel dari DATABASE_SCHEMA.md)
- [x] Jalankan migration awal
- [x] Implementasi endpoint: register, login, logout, me
- [x] Tabel email_verification_tokens + kolom users.email_verified_at
- [x] Email service (Nodemailer/SMTP) + template email verifikasi
- [x] Endpoint verify-email dan resend-verification (cooldown 60 detik, maks 5/jam)
- [x] Endpoint POST /api/auth/google (verifikasi ID token, buat/tautkan akun customer)
- [x] Guard EMAIL_NOT_VERIFIED pada POST /api/bookings
- [x] Implementasi JWT middleware + role middleware
- [x] Setup React + Vite + Tailwind + shadcn/ui
- [x] Buat halaman Login & Register (dengan tombol Google), CheckEmail, VerifyEmail
- [x] Komponen GoogleSignInButton + EmailVerificationBanner + BrandPanel + PasswordChecklist
- [x] Setup Zustand auth store + protected routes
- [x] Setup design tokens + komponen dasar (lihat DESIGN_SYSTEM.md dan PAGE_PROMPTS.md Prompt 0)
- [x] Tema terang dan gelap: CSS variables, ThemeToggle, themeStore, skrip anti-kedip di index.html, cek kontras di kedua tema

## Phase 2: Admin - Master Data (Week 2)
- [x] CRUD API: airports, airlines, airplanes
- [x] CRUD UI: Admin pages untuk airports, airlines, airplanes (table + form)
- [x] Validasi input (zod) di setiap endpoint
- [x] (revisi data real) Migrasi baru: kolom airports.timezone (nullable). Patch CRUD airports dan GET /api/airports agar menerima dan mengembalikan `timezone` (opsional, fallback tampilan Asia/Jakarta)
- [x] (revisi data real) Script seed:reference: bandara dan maskapai dari dataset terbuka + satu pesawat default per maskapai, idempotent (DAT-01, DAT-05)

## Phase 3: Admin - Flight Schedule (Week 3)
- [x] CRUD API: flight_schedules + flight_segments (support transit)
- [x] Logic auto-generate seats berdasarkan airplane capacity
- [x] CRUD API: baggage_options + endpoint publik GET /api/airports dan /api/baggage-options
- [x] UI: Form create flight schedule (dynamic segment input untuk transit)
- [x] UI: List & manage flight schedules (revisi data real: teks kecil "Impor API" untuk jadwal source api, dan dialog "Ubah status" dengan opsi tertunda + menit keterlambatan)
- [x] (revisi data real) Migrasi baru: flight_schedules (source, external_ref, delay_minutes, status_synced_at, created_by jadi nullable, unique index parsial), refunds.kind, tabel flight_notifications, provider_usage, provider_cache
- [x] (revisi data real) Patch API jadwal yang sudah ada: GET /api/admin/flights menyertakan source, status, delay_minutes; PUT /api/admin/flights/:id menerima status dan delay_minutes (ADM-10), dan memblokir perubahan harga, pesawat, segmen jika sudah ada booking
- [x] (revisi data real) Lapisan provider: interface FlightDataProvider, adapter AeroDataBox, cache, penjaga kuota (DAT-02, DAT-07, DAT-08)
- [x] (revisi data real) Script uji cakupan: panggil provider untuk 3-5 rute Indonesia dan catat hasilnya sebelum membangun impor
- [x] (revisi data real) Job import-schedules (reuse fungsi auto-generate seats yang sudah ada) + endpoint admin POST /api/admin/provider/import dan GET /api/admin/provider/usage (DAT-03, DAT-04)

## Phase 4: Landing Page, Customer - Search & Booking (Week 4)
- [x] API: GET /api/routes/popular
- [x] UI: Landing page (hero + RouteMap + SearchPanel, rute populer, cara kerja, SeatShowcase, aturan penting, FAQ, footer)
- [x] API: flight search (filter tipe dan kelas di server, sort termurah/tercepat/terbaik; filter harga, maskapai, jam berangkat di client). Revisi data real: field status, delay_minutes, value_score, layover_warning; penerbangan cancelled tidak ikut
- [x] (revisi data real) API: GET /api/flights/price-calendar untuk date strip (CAL-01)
- [x] UI: Search results page dengan filter sidebar (revisi data real: date strip dari price-calendar, sort Terbaik, teks tertunda dan peringatan transit)
- [x] UI: Flight detail + seat selection (seat map)
- [x] API: create booking (dengan DB transaction untuk lock seat); revisi data real: tolak FLIGHT_CANCELLED
- [x] UI: Form data penumpang (dynamic, multi-passenger)
- [x] UI: Checkout summary page

## Phase 5: Payment & E-Ticket (Week 5)
- [ ] Integrasi Midtrans Snap (create transaction)
- [ ] Implementasi webhook notification handler
- [ ] Logic update booking status berdasarkan payment result
- [ ] Generate booking_code (PNR)
- [ ] Generate e-ticket PDF (pdf-lib) + QR code + endpoint GET /api/bookings/:id/e-ticket
- [ ] Cron job auto-cancel booking pending > 1 jam (PAY-04)
- [ ] UI: Payment redirect flow
- [ ] UI: My Bookings page (list + detail + download e-ticket); revisi data real: teks tertunda, chip dibatalkan, panel catatan di detail

## Phase 6: Self Check-in (Week 6)
- [ ] API: check-in endpoint (confirm/ganti kursi)
- [ ] Logic validasi waktu check-in (H-24 jam)
- [ ] Generate boarding_pass_code + QR
- [ ] Generate boarding pass PDF
- [ ] UI: Check-in flow page (revisi data real: nonaktif jika penerbangan dibatalkan, jam boarding mengikuti keterlambatan)
- [ ] (revisi data real) Check-in menolak FLIGHT_CANCELLED
- [x] (revisi data real) Job sync-status tiap 30 menit + endpoint POST /api/admin/provider/sync-status (DAT-06)

## Phase 7: Staff & Refund (Week 7)
- [ ] API: daftar penerbangan hari ini + manifest per flight (staff)
- [x] API: admin users (buat staff, ubah role, nonaktifkan) + admin dashboard
- [ ] API: verify boarding (scan/input code)
- [ ] UI: Staff dashboard + manifest page
- [ ] API: refund request (customer) + approve/reject (admin); revisi data real: RFD-05 untuk penerbangan dibatalkan (tanpa batas H-6, jumlah penuh, refunds.kind)
- [ ] UI: Refund request form + status tracking (revisi data real: varian penerbangan dibatalkan sesuai PAGE_PROMPTS B10)
- [x] (revisi data real) Layanan notifikasi email delay/cancel + template + dedupe flight_notifications; dipanggil dari sync-status dan dari PUT /api/admin/flights/:id (NTF-01)
- [ ] UI: Admin refund management page

## Phase 8: Testing & Polish (Week 8)
- [ ] End-to-end testing semua flow utama
- [ ] (revisi data real) Tes: impor idempotent dan tidak menyentuh jadwal yang sudah dibooking; sync berhenti di 90% kuota; notifikasi tidak dobel; pencarian dan booking tetap jalan saat provider dimatikan
- [ ] Fix bug dari testing
- [ ] Responsive check (mobile/desktop)
- [ ] Loading states & error handling di semua halaman
- [ ] Dokumentasi final + persiapan demo (sebut jelas: harga simulasi, e-tiket bukan tiket resmi maskapai)

## Critical Technical Notes
0. **Auth**: token verifikasi email disimpan sebagai hash dan sekali pakai; verifikasi lewat POST (bukan GET).
   Akun Google hanya untuk customer. Setup Google Cloud: buat OAuth Client ID (Web), tambahkan origin dev dan produksi.
1. **Race condition handling**: Saat booking, gunakan PostgreSQL transaction
   dengan `SELECT ... FOR UPDATE` pada tabel seats sebelum update is_available.
2. **Webhook security**: Verifikasi signature key dari Midtrans sebelum
   memproses notification.
3. **Environment variables** yang dibutuhkan:
   ```
   DATABASE_URL=
   JWT_SECRET=
   MIDTRANS_SERVER_KEY=
   MIDTRANS_CLIENT_KEY=
   MIDTRANS_IS_PRODUCTION=false
   GOOGLE_CLIENT_ID=
   VITE_GOOGLE_CLIENT_ID=      # di frontend
   SMTP_HOST=
   SMTP_PORT=
   SMTP_USER=
   SMTP_PASS=
   EMAIL_FROM=
   APP_URL=http://localhost:5173
   # Data real (revisi data real)
   PROVIDER_NAME=aerodatabox
   PROVIDER_API_KEY=
   PROVIDER_BASE_URL=
   PROVIDER_MONTHLY_LIMIT=
   PROVIDER_UNIT_COST_SCHEDULE=
   PROVIDER_UNIT_COST_STATUS=
   PROVIDER_IMPORT_ROUTES=CGK-DPS,CGK-SUB
   PROVIDER_IMPORT_DAYS_AHEAD=7
   DELAY_NOTIFY_MIN_MINUTES=15
   PRICING_BASE=
   PRICING_PER_MINUTE=
   DEFAULT_AIRPLANE_SEATS_ECONOMY=
   DEFAULT_AIRPLANE_SEATS_BUSINESS=
   ```
4. **Provider data**: pencarian customer hanya membaca database. Semua panggilan provider lewat job atau endpoint admin, dengan cache dan penjaga kuota. Jika provider mati atau kuota habis, booking dan pembayaran harus tetap berjalan.
5. **Harga simulasi**: harga jadwal hasil impor dihitung rumus, bukan harga resmi maskapai. Jadwal yang sudah punya booking tidak pernah diubah harga, pesawat, atau kursinya oleh impor.