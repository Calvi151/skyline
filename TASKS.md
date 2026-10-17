# Task Breakdown - SkyBook (Untuk AI Agent / Development Tracking)

Urutan desain dan implementasi halaman: lihat `STITCH_PROMPT.md` (hanya untuk membuat desain di Stitch) dan `PAGE_PROMPTS.md` (kode per halaman).

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
- [ ] CRUD API: airports, airlines, airplanes
- [ ] CRUD UI: Admin pages untuk airports, airlines, airplanes (table + form)
- [ ] Validasi input (zod) di setiap endpoint

## Phase 3: Admin - Flight Schedule (Week 3)
- [ ] CRUD API: flight_schedules + flight_segments (support transit)
- [ ] Logic auto-generate seats berdasarkan airplane capacity
- [ ] CRUD API: baggage_options + endpoint publik GET /api/airports dan /api/baggage-options
- [ ] UI: Form create flight schedule (dynamic segment input untuk transit)
- [ ] UI: List & manage flight schedules

## Phase 4: Landing Page, Customer - Search & Booking (Week 4)
- [ ] API: GET /api/routes/popular
- [ ] UI: Landing page (hero + RouteMap + SearchPanel, rute populer, cara kerja, SeatShowcase, aturan penting, FAQ, footer)
- [ ] API: flight search (filter tipe dan kelas di server, sort termurah/tercepat; filter harga, maskapai, jam berangkat di client)
- [ ] UI: Search results page dengan filter sidebar
- [ ] UI: Flight detail + seat selection (seat map)
- [ ] API: create booking (dengan DB transaction untuk lock seat)
- [ ] UI: Form data penumpang (dynamic, multi-passenger)
- [ ] UI: Checkout summary page

## Phase 5: Payment & E-Ticket (Week 5)
- [ ] Integrasi Midtrans Snap (create transaction)
- [ ] Implementasi webhook notification handler
- [ ] Logic update booking status berdasarkan payment result
- [ ] Generate booking_code (PNR)
- [ ] Generate e-ticket PDF (pdf-lib) + QR code + endpoint GET /api/bookings/:id/e-ticket
- [ ] Cron job auto-cancel booking pending > 1 jam (PAY-04)
- [ ] UI: Payment redirect flow
- [ ] UI: My Bookings page (list + detail + download e-ticket)

## Phase 6: Self Check-in (Week 6)
- [ ] API: check-in endpoint (confirm/ganti kursi)
- [ ] Logic validasi waktu check-in (H-24 jam)
- [ ] Generate boarding_pass_code + QR
- [ ] Generate boarding pass PDF
- [ ] UI: Check-in flow page

## Phase 7: Staff & Refund (Week 7)
- [ ] API: daftar penerbangan hari ini + manifest per flight (staff)
- [ ] API: admin users (buat staff, ubah role, nonaktifkan) + admin dashboard
- [ ] API: verify boarding (scan/input code)
- [ ] UI: Staff dashboard + manifest page
- [ ] API: refund request (customer) + approve/reject (admin)
- [ ] UI: Refund request form + status tracking
- [ ] UI: Admin refund management page

## Phase 8: Testing & Polish (Week 8)
- [ ] End-to-end testing semua flow utama
- [ ] Fix bug dari testing
- [ ] Responsive check (mobile/desktop)
- [ ] Loading states & error handling di semua halaman
- [ ] Dokumentasi final + persiapan demo

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
   ```
