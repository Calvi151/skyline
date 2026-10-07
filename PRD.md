# PRD - SkyBook (Flight Ticketing System)

## 1. Overview
SkyBook adalah sistem ticketing pesawat online dengan 3 role (Admin, Staff Maskapai, Customer).
Fitur utama: search & booking tiket, payment gateway, e-ticket generation, self check-in,
dukungan penerbangan direct & transit, serta sistem refund.

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

### Customer - Search & Booking
- CUS-01: Search flight (origin, destination, date, jumlah penumpang)
- CUS-02: Filter hasil (price, direct/transit, airline, waktu keberangkatan)
- CUS-03: Sort hasil (termurah, tercepat)
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

## 6. Priority (MoSCoW)

### Must Have
- Auth JWT multi-role, login Google, verifikasi email
- CRUD master data (admin)
- Search & booking flow
- Payment gateway integration
- E-ticket generation
- Self check-in
- Staff verification

### Should Have
- Filter & sorting
- Baggage add-on
- Refund system
- Admin dashboard/reporting

### Could Have
- Email notifikasi lain (e-ticket, pengingat check-in)
- Reset kata sandi lewat email
- Reschedule tiket

### Won't Have (v1)
- Mobile native app
- Live chat
- Multi-currency

## 7. Timeline (8 Weeks)
| Week | Focus |
|---|---|
| 1 | Setup project, design tokens, Auth (JWT, Google, verifikasi email) |
| 2 | Admin: CRUD master data |
| 3 | Admin: Flight schedule + transit + seat generation |
| 4 | Landing page + Customer: Search, filter, booking flow |
| 5 | Payment integration + E-ticket generation |
| 6 | Self check-in + Boarding pass |
| 7 | Staff module + Refund module |
| 8 | Testing, bug fixing, polish |
