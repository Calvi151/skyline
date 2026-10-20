# PRD - SkyBook (Flight Ticketing System)

## 1. Overview
SkyBook adalah sistem ticketing pesawat online dengan 3 role (Admin, Staff Maskapai, Customer).
Fitur utama: search & booking tiket, payment gateway, e-ticket generation, self check-in,
dukungan penerbangan direct & transit, serta sistem refund.

**Sumber data penerbangan:** jadwal dan status penerbangan bisa berasal dari data real lewat API pihak ketiga (paket gratis, hasilnya disimpan di database). Harga, kursi, booking, pembayaran, e-tiket, check-in, dan refund sepenuhnya dikelola sistem sendiri. Detail dan batasan ada di bagian 8.

Platform: **aplikasi web** (desktop-first, responsif ke tablet dan mobile). Tidak ada aplikasi native di v1.

## 2. Tech Stack
- Frontend: React 18 + Vite + TypeScript
- Backend: Hono.js (Node.js runtime) + TypeScript
- ORM: Drizzle ORM
- Database: PostgreSQL
- Auth: JWT (httpOnly cookie) + Google Sign-In (Google Identity Services, ID token diverifikasi di backend)
- Email: Nodemailer (SMTP) untuk email verifikasi
- Payment: Midtrans Snap (Sandbox)
- PDF: pdf-lib
- QR Code: qrcode (npm)
- Data penerbangan real: AeroDataBox (paket gratis, lewat API.Market atau RapidAPI) di balik adapter provider yang bisa diganti
- Data referensi: dataset terbuka OpenFlights / OurAirports untuk seed bandara dan maskapai (sekali jalan, tanpa API)
- Scheduler: node-cron (dipakai untuk auto-cancel PAY-04, impor jadwal, sinkron status)
- Styling: Tailwind CSS + shadcn/ui
- State: Zustand + TanStack Query

## 3. User Roles

### Pengunjung (belum login)
- Melihat landing page, rute populer, aturan layanan, dan FAQ
- Mencari penerbangan tanpa login (login diminta saat memilih penerbangan)

### Admin
- CRUD data master: airports, airlines, airplanes, flight schedules
- Kelola user & role
- Approve/reject refund
- Lihat dashboard & laporan
- Memicu impor jadwal dan sinkron status secara manual lewat endpoint admin (tanpa halaman khusus di v1)

### Staff Maskapai
- Lihat manifest penumpang per jadwal
- Verifikasi boarding pass (check-in fisik di bandara)
- Update status penumpang (boarded/no-show)

### Customer
- Daftar dan masuk dengan email + kata sandi atau akun Google
- Verifikasi email (wajib sebelum membuat booking)
- Search & booking tiket (filter: direct/transit, harga, jam, maskapai)
- Checkout & pembayaran (Midtrans)
- Self check-in (H-24 jam sebelum keberangkatan)
- Ajukan refund
- Lihat riwayat booking & download e-ticket
- Menerima email jika penerbangan yang dipesan tertunda atau dibatalkan

## 4. Functional Requirements

### Landing Page (publik)
- LND-01: Hero dengan form pencarian (asal, tujuan, tanggal, penumpang, kelas)
- LND-02: Daftar rute populer dengan harga mulai dari (data dari jadwal yang tersedia)
- LND-03: Penjelasan cara kerja, aturan penting (batas bayar 1 jam, check-in H-24 jam, refund sampai H-6 jam), dan FAQ
- LND-04: Navigasi ke Masuk dan Daftar, footer berisi kebijakan layanan

### Auth
- AUTH-01: Register customer (nama, email, password, telepon), sistem langsung mengirim email verifikasi
- AUTH-02: Login (email + password) untuk semua role, generate JWT di httpOnly cookie
- AUTH-03: Admin create akun staff secara manual
- AUTH-04: Middleware RBAC (role-based access control) di setiap protected route
- AUTH-05: Logout (clear cookie)
- AUTH-06: Customer dapat daftar/masuk dengan Google. Backend memverifikasi ID token Google. Akun Google otomatis terverifikasi emailnya. Hanya untuk role customer (staff dan admin wajib email + password)
- AUTH-07: Verifikasi email: token acak sekali pakai, disimpan dalam bentuk hash, berlaku 24 jam, dikirim lewat email berisi tautan ke `/verify-email?token=...`
- AUTH-08: Kirim ulang email verifikasi (jeda 60 detik, maksimal 5 kali per jam)
- AUTH-09: Customer yang belum terverifikasi boleh mencari penerbangan, tetapi tidak bisa membuat booking (error `EMAIL_NOT_VERIFIED`)
- AUTH-10: Jika email Google cocok dengan akun email + password yang sudah ada, akun ditautkan (google_id diisi, email dianggap terverifikasi)
- AUTH-11: Akun staff yang dibuat admin langsung dianggap terverifikasi

### Admin - Master Data
- ADM-01: CRUD airports (code, name, city, country)
- ADM-02: CRUD airlines (name, code, logo)
- ADM-03: CRUD airplanes (registration_number, model, total_seat_economy, total_seat_business)
- ADM-04: CRUD flight schedules (flight_number, airline, airplane, flight_type)
- ADM-05: Jika flight_type = transit, support multi flight_segments
- ADM-06: Set harga per kelas (economy/business)
- ADM-07: Auto-generate seats berdasarkan kapasitas airplane saat flight schedule dibuat
- ADM-08: CRUD baggage_options (name, weight_kg, price)
- ADM-09: Approve/reject refund request
- ADM-10: Ubah status jadwal (scheduled/delayed/cancelled) dan `delay_minutes` secara manual; perubahan memicu notifikasi (NTF-01)

### Data Penerbangan (Provider)
Prinsip: pencarian customer **hanya membaca database**, tidak pernah memanggil API eksternal. Semua panggilan provider terjadi di job terjadwal atau endpoint admin.
- DAT-01: Seed awal `airports` dan `airlines` dari dataset terbuka lewat script (`seed:reference`). Cakup bandara Indonesia dan bandara internasional utama saja agar tabel ringan, termasuk zona waktu bandara. Data tetap bisa diubah lewat CRUD ADM-01 dan ADM-02.
- DAT-02: Adapter provider (interface `FlightDataProvider`) dengan dua operasi: ambil jadwal per bandara dan rentang tanggal, serta ambil status per nomor penerbangan dan tanggal. Implementasi awal AeroDataBox. Mengganti provider tidak boleh mengubah route atau service lain.
- DAT-03: Job impor jadwal (harian dini hari, bisa dipicu admin). Rute yang diimpor dan jumlah hari ke depan diatur lewat env (`PROVIDER_IMPORT_ROUTES`, `PROVIDER_IMPORT_DAYS_AHEAD`, default 7). Hasil impor menjadi `flight_schedules` dengan `source = 'api'` dan satu segmen (penerbangan direct). Penerbangan transit tetap dibuat admin manual.
- DAT-04: Harga jadwal hasil impor dihitung dengan rumus simulasi yang deterministik (dasar + durasi + faktor jam berangkat, parameter di env) dan bisa diubah admin. Penerbangan yang sudah punya booking tidak pernah diubah harga, pesawat, atau kursinya oleh impor.
- DAT-05: Tiap maskapai hasil seed punya satu pesawat default (kapasitas dari env) supaya kursi bisa digenerate otomatis dengan alur yang sama seperti ADM-07.
- DAT-06: Job sinkron status (tiap 30 menit): hanya untuk jadwal `source = 'api'` yang berangkat dalam 24 jam ke depan dan sudah punya booking berstatus paid. Memperbarui `status` dan `delay_minutes`. Jadwal manual tidak disinkronkan.
- DAT-07: Penjaga kuota: tiap panggilan dicatat di `provider_usage`; panggilan dihentikan saat pemakaian bulan berjalan mencapai 90% dari `PROVIDER_MONTHLY_LIMIT`. Respons di-cache di `provider_cache` (TTL jadwal 12 jam, status 15 menit).
- DAT-08: Degradasi halus: jika provider gagal atau kuota habis, sistem memakai data yang sudah tersimpan. Pencarian, booking, dan pembayaran tidak boleh ikut gagal.

### Fitur Pembeda
- NTF-01: Email otomatis ke pemilik booking berstatus paid saat jadwal menjadi `delayed` (keterlambatan minimal `DELAY_NOTIFY_MIN_MINUTES`, default 15) atau `cancelled`. Satu email per perubahan; keterlambatan lanjutan hanya diemail ulang jika bertambah minimal 30 menit. Kegagalan kirim tidak boleh menggagalkan sinkron status.
- NTF-02: Penerbangan `cancelled` tidak muncul di hasil pencarian, booking baru ditolak (`FLIGHT_CANCELLED`), dan check-in ditolak.
- CAL-01: Kalender harga: harga ekonomi atau bisnis termurah per tanggal (7 hari di sekitar tanggal terpilih), dihitung dari database. Dipakai date strip di hasil pencarian.
- VAL-01: Skor nilai 0 sampai 100 per hasil pencarian, rumus transparan dan relatif terhadap hasil pencarian yang sama: harga 50%, durasi 30%, jam berangkat 10%, kualitas transit 10%. Dipakai untuk sort "Terbaik".
- VAL-02: Peringatan transit: `short` jika transit kurang dari 60 menit, `long` jika lebih dari 360 menit.

### Customer - Search & Booking
- CUS-01: Search flight (origin, destination, date, jumlah penumpang)
- CUS-02: Filter hasil (price, direct/transit, airline, waktu keberangkatan)
- CUS-03: Sort hasil (termurah, tercepat, terbaik)
- CUS-04: Pilih flight + kelas kursi
- CUS-05: Pilih kursi spesifik (seat map) - optional step
- CUS-06: Pilih baggage add-on
- CUS-07: Input data penumpang (support multi-passenger per booking)
- CUS-08: Sistem hitung total price otomatis

### Payment
- PAY-01: Generate Midtrans Snap transaction, redirect customer ke payment page
- PAY-02: Terima webhook notification dari Midtrans
- PAY-03: Update booking status otomatis (pending -> paid / failed)
- PAY-04: Auto-cancel booking jika tidak dibayar dalam 1 jam (cron job/scheduled task)

### E-Ticket & Check-in
- ETK-01: Generate booking_code (PNR) unik setelah payment sukses
- ETK-02: Generate e-ticket (PDF + QR Code)
- ETK-03: Customer download e-ticket dari dashboard
- ETK-04: Self check-in available mulai H-24 jam sebelum departure_time
- ETK-05: Saat check-in, customer bisa confirm kursi lama atau pilih kursi baru (jika available)
- ETK-06: Generate boarding_pass_code (QR terpisah) setelah check-in sukses

### Refund
- RFD-01: Customer ajukan refund dengan alasan (reason)
- RFD-02: Refund hanya bisa diajukan sebelum H-6 jam keberangkatan
- RFD-03: Status refund: pending -> approved/rejected -> refunded
- RFD-04: Admin dapat approve/reject dari dashboard
- RFD-05: Jika penerbangan dibatalkan (`cancelled`), refund boleh diajukan kapan saja sebelum keberangkatan tanpa batas H-6 jam, jumlah refund penuh, alasan terisi otomatis. Tetap melewati persetujuan admin.

### Staff
- STF-01: Lihat manifest penumpang per flight_schedule_id
- STF-02: Input/scan boarding_pass_code untuk verifikasi
- STF-03: Update status passenger: checked_in -> boarded / no_show

## 5. Non-Functional Requirements
- Response time API < 500ms untuk operasi standar
- Mencegah double booking kursi menggunakan DB transaction + row locking
- Password di-hash menggunakan bcrypt/argon2
- Token verifikasi email disimpan sebagai hash (SHA-256), sekali pakai, kedaluwarsa 24 jam
- ID token Google diverifikasi di server (audience = GOOGLE_CLIENT_ID, email_verified = true)
- JWT disimpan di httpOnly cookie (bukan localStorage, mencegah XSS)
- Validasi input di setiap endpoint (gunakan zod/typebox)
- UI web desktop-first, responsif sampai mobile (breakpoint Tailwind)
- Dua tema, terang dan gelap: default mengikuti pengaturan perangkat, pilihan pengguna disimpan di browser, kontras teks minimal WCAG AA di kedua tema
- Desain mengikuti `DESIGN_SYSTEM.md` (biru langit sebagai warna utama, aksen tunggal coral, tanpa kombinasi biru-emas)
- Tampilan tidak berubah: penambahan akibat revisi data real hanya berupa teks, ikon, dan satu opsi sort memakai komponen dan token yang sudah ada
- Endpoint publik tidak boleh memanggil API eksternal; kunci API provider hanya di env backend
- Patuhi syarat penggunaan provider (termasuk aturan caching); cakupan rute Indonesia diuji dulu sebelum impor dibangun

## 6. Priority (MoSCoW)

### Must Have
- Auth JWT multi-role, login Google, verifikasi email
- CRUD master data (admin) dan seed bandara dan maskapai (DAT-01)
- Adapter provider, impor jadwal, penjaga kuota, dan degradasi halus (DAT-02 sampai DAT-08)
- Search & booking flow
- Payment gateway integration
- E-ticket generation
- Self check-in
- Staff verification

### Should Have
- Filter & sorting
- Baggage add-on
- Refund system (termasuk RFD-05)
- Admin dashboard/reporting
- Sinkron status real dan notifikasi delay/cancel (DAT-06, NTF-01, NTF-02)
- Kalender harga (CAL-01)
- Skor nilai dan peringatan transit (VAL-01, VAL-02)

### Could Have
- Email notifikasi lain (e-ticket, pengingat check-in)
- Reset kata sandi lewat email
- Reschedule tiket
- Price alert lewat email
- Estimasi emisi karbon per penerbangan
- E-tiket dan boarding pass offline (PWA)

### Won't Have (v1)
- Mobile native app
- Live chat
- Multi-currency
- Harga dan penerbitan tiket asli dari maskapai atau GDS
- Halaman admin khusus untuk impor dan sinkron provider

## 7. Timeline (8 Weeks)
| Week | Focus |
|---|---|
| 1 | Setup project, design tokens, Auth (JWT, Google, verifikasi email) |
| 2 | Admin: CRUD master data + seed bandara dan maskapai (DAT-01) |
| 3 | Admin: Flight schedule + transit + seat generation; adapter provider, impor jadwal, cache, dan kuota (DAT-02 sampai DAT-05, DAT-07, DAT-08) |
| 4 | Landing page + Customer: Search, filter, kalender harga, skor nilai, booking flow |
| 5 | Payment integration + E-ticket generation |
| 6 | Self check-in + Boarding pass; job sinkron status (DAT-06) |
| 7 | Staff module + Refund module; notifikasi delay/cancel dan refund penerbangan dibatalkan (NTF-01, NTF-02, RFD-05) |
| 8 | Testing, bug fixing, polish |

## 8. Sumber Data dan Batasan
- **Data real:** bandara, maskapai (dataset terbuka), serta jadwal dan status penerbangan (provider API gratis). Kuota gratis kecil, jadi semua data di-cache dan hanya diambil lewat job.
- **Dikelola sistem sendiri:** harga, kursi, booking, pembayaran (Midtrans Sandbox), e-tiket, boarding pass, check-in, refund.
- **Harga adalah simulasi.** Tidak ada API gratis untuk harga dan pemesanan tiket asli, jadi harga hasil impor dihitung dengan rumus (DAT-04) dan perlu disebut sebagai simulasi saat demo atau dokumentasi.
- **E-tiket bukan tiket resmi maskapai.** Sistem ini tidak menerbitkan tiket ke maskapai atau GDS.
- **Cakupan data tidak dijamin.** Cakupan jadwal dan status provider per negara bersifat best-effort; uji rute Indonesia sebelum membangun impor. Jika cakupan kurang, jadwal dibuat admin manual dan sisanya tetap berjalan.
- **Fitur kandidat yang ditunda:** price alert, estimasi emisi karbon, dan PWA offline (lihat Could Have).