# API Specification - SkyBook

Base URL: `/api`
Auth: JWT via httpOnly cookie (`auth`)
Contoh `Response` di dokumen ini menunjukkan isi `data` (lihat Standard Success Response Format di bagian bawah).

## Auth

### POST /api/auth/register
Hanya customer. Membuat akun, mengirim email verifikasi, dan langsung login (set-cookie `auth`).
Body: `{ name, email, password, phone }`
Response: `{ message, user: { id, name, email, role, email_verified: false } }`
Error: `EMAIL_ALREADY_REGISTERED`, `VALIDATION_ERROR`

### POST /api/auth/login
Body: `{ email, password }`
Response: `{ message, user: { id, name, email, role, email_verified } }` + set-cookie `auth`
Error: `INVALID_CREDENTIALS`, `USE_GOOGLE_SIGNIN` (akun terdaftar lewat Google dan belum punya password), `ACCOUNT_DISABLED`

### POST /api/auth/google
Masuk atau daftar dengan Google. Frontend mengirim ID token (credential) dari Google Identity Services.
Body: `{ credential }`
Backend: verifikasi token (signature, audience = GOOGLE_CLIENT_ID, expiry), wajib `email_verified = true`.
- Email belum ada: buat akun customer baru, `google_id` terisi, `email_verified_at` terisi.
- Email sudah ada sebagai customer: tautkan `google_id`, isi `email_verified_at` jika masih kosong.
- Email milik staff atau admin: ditolak.
Response: `{ message, user: { id, name, email, role, email_verified: true }, is_new_user }` + set-cookie `auth`
Error: `GOOGLE_TOKEN_INVALID`, `GOOGLE_EMAIL_NOT_VERIFIED`, `GOOGLE_NOT_ALLOWED_FOR_ROLE`, `ACCOUNT_DISABLED`

### POST /api/auth/verify-email
Tanpa auth (tautan bisa dibuka di perangkat lain). Memakai POST agar pemindai email tidak menghabiskan token.
Body: `{ token }`
Response: `{ message, email_verified: true }`
Error: `TOKEN_INVALID`, `TOKEN_EXPIRED`

### POST /api/auth/resend-verification
Auth: required
Response: `{ message, retry_after: 60 }`
Error: `ALREADY_VERIFIED`, `RESEND_TOO_SOON` (menyertakan `retry_after` detik), `RESEND_LIMIT_REACHED` (maks 5 per jam)

### POST /api/auth/logout
Response: `{ message }` + clear cookie

### GET /api/auth/me
Auth: required
Response: `{ id, name, email, role, email_verified, has_password, has_google }`

### Email verifikasi
- Subjek: "Verifikasi email SkyBook". Isi Bahasa Indonesia: sapaan nama, satu tombol "Verifikasi email", tautan teks cadangan, masa berlaku 24 jam, dan catatan "Abaikan email ini jika kamu tidak membuat akun".
- Tautan: `${APP_URL}/verify-email?token=<token>`
- Dikirim lewat SMTP (Nodemailer). Kegagalan kirim tidak boleh menggagalkan register; catat error dan biarkan user memakai kirim ulang.

---

## Public Reference Data
Tanpa auth. Dipakai form pencarian dan halaman booking.

### GET /api/airports
Query: `q` (optional, cari kode/kota)
Response: `[{ id, code, name, city, country }]`

### GET /api/baggage-options
Response: `[{ id, name, weight_kg, price }]`

### GET /api/routes/popular
Dipakai landing page. Rute dengan jadwal terdekat dan harga ekonomi terendah.
Query: `limit` (default 6)
Response:
```json
[
  {
    "origin": { "code": "CGK", "city": "Jakarta" },
    "destination": { "code": "DPS", "city": "Denpasar" },
    "next_departure_time": "2026-10-14T07:40:00+07:00",
    "duration_minutes": 170,
    "flight_type": "direct",
    "lowest_price_economy": 1286000
  }
]
```

---

## Admin - Airports
Auth: required, role: admin

### GET /api/admin/airports
Response: `[{ id, code, name, city, country }]`

### POST /api/admin/airports
Body: `{ code, name, city, country }`

### PUT /api/admin/airports/:id
Body: `{ code, name, city, country }`

### DELETE /api/admin/airports/:id

---

## Admin - Airlines
Auth: required, role: admin
Same CRUD pattern: GET/POST/PUT/DELETE `/api/admin/airlines`
Body: `{ name, code, logo }`

---

## Admin - Airplanes
Auth: required, role: admin
Same CRUD pattern: `/api/admin/airplanes`
Body: `{ airline_id, registration_number, model, total_seat_economy, total_seat_business }`

---

## Admin - Flight Schedules

### GET /api/admin/flights
Response: list jadwal dengan join airline, airplane

### POST /api/admin/flights
Body:
```json
{
  "flight_number": "GA-123",
  "airline_id": 1,
  "airplane_id": 1,
  "flight_type": "transit",
  "price_economy": 1500000,
  "price_business": 3000000,
  "segments": [
    {
      "segment_order": 1,
      "origin_airport_id": 1,
      "destination_airport_id": 2,
      "departure_time": "2025-01-10T08:00:00Z",
      "arrival_time": "2025-01-10T09:30:00Z"
    },
    {
      "segment_order": 2,
      "origin_airport_id": 2,
      "destination_airport_id": 3,
      "departure_time": "2025-01-10T10:30:00Z",
      "arrival_time": "2025-01-10T12:00:00Z",
      "transit_duration_minutes": 60
    }
  ]
}
```
Note: Saat create, backend otomatis generate records di tabel `seats`
berdasarkan `total_seat_economy` + `total_seat_business` dari airplane terkait.

### PUT /api/admin/flights/:id
### DELETE /api/admin/flights/:id

---

## Admin - Baggage Options
CRUD pattern: `/api/admin/baggage-options`
Body: `{ name, weight_kg, price }`

---

## Admin - Users
Auth: required, role: admin

### GET /api/admin/users
Query: `role` (admin|staff|customer), `q` (nama/email), `page`, `limit`
Response: `[{ id, name, email, phone, role, is_active, created_at }]`

### POST /api/admin/users
Buat akun staff (AUTH-03). `email_verified_at` langsung diisi.
Body: `{ name, email, phone, password, role: "staff" }`
Response: `{ id, name, email, role }`

### PUT /api/admin/users/:id
Body: `{ role?, is_active? }`
Aturan: admin tidak boleh menurunkan role atau menonaktifkan dirinya sendiri (error code `CANNOT_MODIFY_SELF`).

---

## Admin - Dashboard
Auth: required, role: admin

### GET /api/admin/dashboard
Query: `range` (optional, `7` | `30` | `90`, default `30`) untuk deret pesanan harian.
Response:
```json
{
  "today": { "bookings": 128, "revenue": 184320000, "pending_refunds": 3 },
  "bookings_by_day": [{ "date": "2026-09-01", "count": 94 }],
  "upcoming_departures": [
    { "flight_schedule_id": 1, "flight_number": "KA 412", "route": "CGK-DPS", "departure_time": "...", "seats_sold": 112, "seats_total": 180 }
  ],
  "pending_refunds": [
    { "id": 5, "booking_code": "K7QM4X", "passenger": "Rina Wulandari", "refund_amount": 1286000 }
  ]
}
```

---

## Admin - Refunds

### GET /api/admin/refunds?status=pending
Response: list refund request

### PUT /api/admin/refunds/:id
Body: `{ status: "approved" | "rejected" }`

---

## Customer - Flight Search

### GET /api/flights/search
Query params: `origin, destination, date, passengers, flight_type, sort` dan `class` (optional, `economy` | `business`).
Filter harga, maskapai, dan jam berangkat dilakukan di client dari hasil satu tanggal (sort `price` atau `duration` dilakukan di server lewat `sort`).
Response:
```json
[
  {
    "id": 1,
    "flight_number": "GA-123",
    "airline": { "name": "Garuda", "logo": "..." },
    "flight_type": "direct",
    "segments": [...],
    "price_economy": 1500000,
    "price_business": 3000000,
    "available_seats_economy": 45,
    "available_seats_business": 8
  }
]
```

### GET /api/flights/:id
Response: detail 1 flight schedule lengkap dengan segments dan daftar kursi untuk seat map:
`{ ..., seats: [{ id, seat_number, seat_class, is_available }] }`

---

## Customer - Booking

### POST /api/bookings
Body:
```json
{
  "flight_schedule_id": 1,
  "passengers": [
    {
      "full_name": "John Doe",
      "id_number": "3201xxxx",
      "birth_date": "1995-05-10",
      "gender": "male",
      "seat_class": "economy",
      "seat_id": 12,
      "baggage_option_id": 2
    }
  ]
}
```
Response: `{ id, booking_code, total_price, status: "pending", created_at, expires_at }` (`expires_at` = `created_at` + 1 jam, dipakai countdown batas bayar)

Note: endpoint ini harus pakai DB transaction untuk lock seat yang dipilih.
Syarat: email customer sudah terverifikasi, jika belum kembalikan 403 `EMAIL_NOT_VERIFIED`.

### GET /api/bookings/my
Auth: required
Response: list booking milik user yang login

### GET /api/bookings/:id
Response: detail booking (termasuk passengers, payment status, refund jika ada, `created_at`, `expires_at`)

### GET /api/bookings/:id/e-ticket
Auth: required, hanya pemilik booking, booking harus berstatus `paid`
Response: PDF e-ticket (dengan QR code)

---

## Payment

### POST /api/payment/create
Body: `{ booking_id }`
Response: `{ redirect_url, token }` (dari Midtrans Snap)

### POST /api/payment/notification
Webhook dari Midtrans (tanpa auth, verifikasi via signature key)
Body: payload dari Midtrans
Action: update `payments.payment_status` dan `bookings.status`

---

## Check-in

### POST /api/check-in/:bookingId
Body: `{ passenger_id, seat_id (optional, jika ganti kursi) }`
Response: `{ boarding_pass_code, qr_code_url }`

### GET /api/check-in/:bookingId/boarding-pass
Response: PDF boarding pass

---

## Refund

### POST /api/refunds
Body: `{ booking_id, reason }`
Response: `{ id, status: "pending" }`

### GET /api/refunds/my
Response: list refund milik user

---

## Staff

### GET /api/staff/flights
Auth: required, role: staff
Query: `date` (default hari ini)
Response: `[{ id, flight_number, route, departure_time, checked_in_count, passenger_count, status }]`

### GET /api/staff/flights/:id/manifest
Response: list passenger + check-in status untuk 1 flight

### POST /api/staff/verify-boarding
Body: `{ boarding_pass_code, flight_schedule_id (optional, untuk validasi penerbangan) }`
Response: `{ passenger_name, seat_number, flight_number, status: "boarded" }`
Error codes: `BOARDING_CODE_NOT_FOUND`, `ALREADY_BOARDED`, `WRONG_FLIGHT`

### PUT /api/staff/passengers/:checkInId/status
Body: `{ status: "boarded" | "no_show" }`

---

## Standard Error Response Format
```json
{
  "error": true,
  "message": "Descriptive error message",
  "code": "SEAT_NOT_AVAILABLE"
}
```

## Error Codes
`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `SEAT_NOT_AVAILABLE`,
`INVALID_CREDENTIALS`, `EMAIL_ALREADY_REGISTERED`, `ACCOUNT_DISABLED`, `EMAIL_NOT_VERIFIED`, `ALREADY_VERIFIED`,
`TOKEN_INVALID`, `TOKEN_EXPIRED`, `RESEND_TOO_SOON`, `RESEND_LIMIT_REACHED`, `USE_GOOGLE_SIGNIN`,
`GOOGLE_TOKEN_INVALID`, `GOOGLE_EMAIL_NOT_VERIFIED`, `GOOGLE_NOT_ALLOWED_FOR_ROLE`,
`BOOKING_EXPIRED`, `CHECKIN_NOT_OPEN`, `ALREADY_CHECKED_IN`, `REFUND_WINDOW_CLOSED`,
`CANNOT_MODIFY_SELF`, `BOARDING_CODE_NOT_FOUND`, `ALREADY_BOARDED`, `WRONG_FLIGHT`

## Standard Success Response Format
```json
{
  "error": false,
  "data": { ... }
}
```
