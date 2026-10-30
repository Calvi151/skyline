# SkyBook — Wings Ticketing System

Platform pemesanan tiket pesawat *end-to-end* berbasis monorepo yang mendukung pencarian jadwal penerbangan (langsung & transit), kalender harga terendah, penguncian kursi (*seat lock* anti-*race condition*), pembayaran Midtrans Snap, pembuatan *E-Ticket* & *Boarding Pass* PDF ber-QR Code, *Self Check-in*, verifikasi *boarding* oleh petugas (*Staff*), pengajuan *Refund*, serta sinkronisasi jadwal & status penerbangan dengan lapisan penjaga kuota (*Quota Guard*).

> [!IMPORTANT]
> **Pemberitahuan Penting (Disclaimer Simulasi & Demo):**
> 1. **Harga Tiket Adalah Simulasi**: Seluruh harga tiket pada jadwal hasil impor maupun *seed* dihitung menggunakan rumus deterministik internal (`PRICING_BASE + durasi × PRICING_PER_MINUTE × multiplier maskapai & rute`) dan **bukan harga resmi maskapai atau GDS**.
> 2. **E-Ticket & Boarding Pass Bukan Dokumen Penerbangan Resmi**: Dokumen PDF *E-Ticket* (PNR) dan *Boarding Pass* (`BP-XXXX`) yang dihasilkan oleh aplikasi ini semata-mata digunakan untuk keperluan **simulasi akademik / portofolio rekayasa perangkat lunak** dan **tidak berlaku** sebagai tiket penerbangan resmi di bandara atau maskapai mana pun.

---

## Arsitektur Monorepo

- **`backend/`**: Hono.js + TypeScript + Drizzle ORM + PostgreSQL + Midtrans Snap + `pdf-lib` + `qrcode` + Nodemailer + `node-cron`
- **`frontend/`**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand
- **`docs/`**: Dokumentasi spesifikasi sistem (`PRD.md`, `API_ENDPOINTS.md`, `DATABASE_SCHEMA.md`, `DESIGN_SYSTEM.md`)

---

## Fitur Utama Backend (Phase 1 – Phase 8)

1. **Autentikasi & Keamanan (Phase 1)**
   - Registrasi pelanggan dengan token verifikasi email sekali pakai (*single-use*, disimpan sebagai hash SHA-256) melalui endpoint `POST /api/auth/verify-email` dan *cooldown* kirim ulang (`60 detik`, maks `5/jam`).
   - Login berbasis JWT (`httpOnly` cookie & `Bearer` token) serta Google OAuth (`POST /api/auth/google`) khusus pelanggan.
   - Proteksi *Role-Based Access Control* (`customer`, `staff`, `admin`) dan *guard* `EMAIL_NOT_VERIFIED` pada pembuatan booking.

2. **Master Data & Referensi Dunia Nyata (Phase 2)**
   - CRUD Bandara (mendukung zona waktu IANA `timezone`, *fallback* `Asia/Jakarta`), Maskapai, dan Pesawat.
   - *Idempotent Reference Seed* (`npm run seed:reference`) untuk bandara, maskapai, dan pesawat *default*.

3. **Manajemen Jadwal, Kursi Otomatis & Integrasi Provider (Phase 3)**
   - Pembuatan jadwal penerbangan langsung maupun transit (*multi-segment*) disertai *auto-generate* kursi Ekonomi & Bisnis sesuai kapasitas pesawat.
   - Lapisan *Flight Data Provider* (`AeroDataBoxProvider` & `DuffelProvider`) lengkap dengan *cache* (`provider_cache`) dan **Penjaga Kuota 90%** (`QuotaGuardService` pada tabel `provider_usage`).
   - Impor jadwal otomatis (`importSchedulesJob`) yang bersifat **idempotent** dan **tidak pernah mengubah harga, pesawat, atau kursi pada jadwal yang sudah memiliki booking** (`DAT-03`, `DAT-04`).

4. **Pencarian Penerbangan, Kalender Harga & Booking Anti-Race Condition (Phase 4)**
   - Pencarian penerbangan (`GET /api/flights/search`) dengan filter tipe/kelas, penyortiran (`cheapest`, `fastest`, `best` berbasis `value_score`), peringatan transit (`layover_warning`), serta eksklusi otomatis jadwal `cancelled`.
   - Kalender harga 7 hari (`GET /api/flights/price-calendar`).
   - Transaksi pembuatan booking (`POST /api/bookings`) menggunakan PostgreSQL `SELECT ... FOR UPDATE` untuk mencegah *double-booking* kursi secara bersamaan.
   - **Ketahanan Offline (`DAT-08`)**: Pencarian dan pemesanan pelanggan membaca 100% dari database PostgreSQL lokal sehingga tetap berjalan normal meskipun provider eksternal dimatikan atau kuota habis.

5. **Pembayaran Midtrans, E-Ticket PDF & Auto-Cancel Cron (Phase 5)**
   - Pembuatan transaksi Midtrans Snap (`POST /api/payment/create`) dan *webhook notification handler* (`POST /api/payment/notification`) dengan verifikasi tanda tangan SHA-512 (`signature_key`).
   - Pengunduhan *E-Ticket* PDF (`GET /api/bookings/:id/e-ticket`) lengkap dengan kode PNR dan QR Code.
   - *Background cron job* (`expire-bookings.ts`) setiap 5 menit yang otomatis membatalkan booking `pending` yang melewati batas waktu 1 jam dan melepas kembali kursi yang dikunci (`PAY-04`).

6. **Self Check-in, Boarding Pass PDF & Sinkronisasi Status (Phase 6)**
   - *Self Check-in* (`POST /api/check-in/:bookingId`) pada jendela waktu **H-24 jam hingga H-1 jam** sebelum keberangkatan (menolak penerbangan `cancelled`).
   - Pengunduhan *Boarding Pass* PDF (`GET /api/check-in/:bookingId/boarding-pass`) dengan waktu *boarding* yang otomatis menyesuaikan `delay_minutes`.
   - Sinkronisasi status keberangkatan (`syncStatusJob` / `POST /api/admin/provider/sync-status`).

7. **Operasional Staff, Refund & Deduplikasi Notifikasi (Phase 7)**
   - *Staff Manifest* (`GET /api/staff/flights/today`, `GET /api/staff/flights/:id/manifest`) dan verifikasi *boarding* (`POST /api/staff/verify-boarding`).
   - Pengajuan *Refund* pelanggan (`POST /api/refunds`) dengan perhitungan otomatis:
     - **Reguler (`customer_request`)**: Maksimal H-6 jam sebelum keberangkatan; pengembalian `80%` jika `> 24 jam`, atau `50%` jika `6 – 24 jam`.
     - **Penerbangan Dibatalkan (`flight_cancelled` / `RFD-05`)**: Tanpa batas waktu H-6 jam dengan pengembalian penuh **`100%`**.
   - Persetujuan/penolakan *Refund* oleh Admin (`PUT /api/admin/refunds/:id`) yang otomatis melepas kursi kembali saat disetujui.
   - Notifikasi email keterlambatan/pembatalan (`FlightNotificationService`) dengan **deduplikasi** pada tabel `flight_notifications` (`NTF-01`).

---

## Konfigurasi Environment Variables (`backend/.env`)

Salin `backend/.env.example` ke `backend/.env` dan sesuaikan nilainya:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skybook
JWT_SECRET=rahasia_jwt_skybook
PORT=3000
APP_URL=http://localhost:5173

# Midtrans Sandbox
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false

# Google OAuth (Khusus Customer)
GOOGLE_CLIENT_ID=

# SMTP Email
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="SkyBook Ticketing <noreply@skybook.local>"

# Konfigurasi Provider Data Real & Simulasi Harga
PROVIDER_NAME=aerodatabox
PROVIDER_API_KEY=
PROVIDER_BASE_URL=https://aerodatabox.p.rapidapi.com
PROVIDER_MONTHLY_LIMIT=500
PROVIDER_UNIT_COST_SCHEDULE=2
PROVIDER_UNIT_COST_STATUS=1
PROVIDER_IMPORT_ROUTES=CGK-DPS,CGK-SUB
PROVIDER_IMPORT_DAYS_AHEAD=7
DELAY_NOTIFY_MIN_MINUTES=15
PRICING_BASE=450000
PRICING_PER_MINUTE=5500
DEFAULT_AIRPLANE_SEATS_ECONOMY=150
DEFAULT_AIRPLANE_SEATS_BUSINESS=24
```

---

## Panduan Instalasi & Menjalankan Aplikasi

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run seed:reference
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Akun Dummy untuk Pengetesan / Demo

Setelah menjalankan `npm run seed:reference`, akun berikut langsung tersedia dan sudah terverifikasi:

| Role | Email | Password | Kegunaan |
| :--- | :--- | :--- | :--- |
| **Staff** | `staff@skybook.com` | `Password123!` | Melihat jadwal hari ini, manifest penumpang, & verifikasi *boarding pass* (`BP-XXXX`) |
| **Admin** | `admin@skybook.com` | `Password123!` | Mengelola master data, jadwal penerbangan, impor provider, pengguna, & persetujuan *refund* |
| **Customer** | `customer@skybook.com` | `Password123!` | Mencari tiket, pemesanan kursi, pembayaran, *self check-in*, & pengajuan *refund* |

---

## Pengujian Integrasi & End-to-End (Automated Test Suites)

Jalankan perintah berikut di direktori `backend/` untuk memverifikasi seluruh fitur dan aturan bisnis:

```bash
cd backend

# Uji API Pencarian, Kalender Harga, dan Booking (Phase 4)
npm run test:phase4

# Uji Pembayaran Midtrans, Webhook, E-Ticket PDF, dan Cron Auto-Expire (Phase 5)
npm run test:phase5

# Uji Self Check-in, Validasi H-24, Boarding Pass PDF, dan Penolakan Flight Cancelled (Phase 6)
npm run test:phase6

# Uji Staff Manifest, Verify Boarding, Customer Refund (Reguler & RFD-05), dan Admin Approval (Phase 7)
npm run test:phase7

# Uji End-to-End Semua Flow Utama + Safeguard Data Real:
# - Impor idempotent & proteksi jadwal ber-booking (DAT-03, DAT-04)
# - Penghentian otomatis pada 90% kuota bulanan (DAT-07)
# - Deduplikasi notifikasi delay/cancel (NTF-01)
# - Ketahanan pencarian & booking saat provider dimatikan (DAT-08)
npm run test:phase8
```
