process.env.NODE_ENV = 'test'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import app from '../index.js'
import {
  users,
  airports,
  flightSchedules,
  flightSegments,
  seats,
  bookings,
  bookingPassengers,
  payments,
} from '../db/schema.js'
import { autoCancelPendingBookingsJob } from '../jobs/expire-bookings.js'

async function runPhase5Tests() {
  console.log('========================================================')
  console.log('    TESTING PHASE 5 INTEGRATION: PAYMENT & E-TICKET    ')
  console.log('========================================================\n')

  // 1. Dapatkan atau siapkan test user dengan email terverifikasi
  let [testUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'test_phase5_customer@skybook.com'))
    .limit(1)

  if (!testUser) {
    const [created] = await db
      .insert(users)
      .values({
        name: 'Phase 5 Tester',
        email: 'test_phase5_customer@skybook.com',
        role: 'customer',
        isActive: true,
        emailVerifiedAt: new Date(),
      })
      .returning()
    testUser = created
  } else if (!testUser.emailVerifiedAt) {
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, testUser.id))
  }

  // Buat JWT token untuk test user
  const jwtSecret = process.env.JWT_SECRET || 'skybook_super_secret_jwt_key_2026_x89a4b2c'
  const userToken = jwt.sign(
    {
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role,
      name: testUser.name,
    },
    jwtSecret,
    { expiresIn: '1h' },
  )

  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: `token=${userToken}`,
    Authorization: `Bearer ${userToken}`,
  }

  // 2. Cari penerbangan aktif yang tersedia di database
  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.status, 'scheduled'))
    .limit(1)

  if (!schedule) {
    console.error('❌ Tidak ada jadwal penerbangan aktif di database!')
    process.exit(1)
  }

  // Cari 2 kursi yang tersedia untuk test
  const availableSeats = await db
    .select()
    .from(seats)
    .where(eq(seats.flightScheduleId, schedule.id))
    .limit(10)

  const freeSeats = availableSeats.filter((s) => s.isAvailable)
  if (freeSeats.length < 2) {
    // Reset ketersediaan beberapa kursi untuk testing
    const seatIds = availableSeats.slice(0, 4).map((s) => s.id)
    await db.update(seats).set({ isAvailable: true }).where(inArray(seats.id, seatIds))
  }

  const refreshedSeats = await db
    .select()
    .from(seats)
    .where(eq(seats.flightScheduleId, schedule.id))

  const seat1 = refreshedSeats.find((s) => s.isAvailable && s.seatClass === 'economy')!
  const seat2 = refreshedSeats.find((s) => s.isAvailable && s.id !== seat1.id && s.seatClass === 'economy')!

  console.log(`[Setup] Menggunakan Jadwal ID: ${schedule.id} (${schedule.flightNumber})`)
  console.log(`[Setup] Menggunakan Kursi: ${seat1.seatNumber} (ID: ${seat1.id}) dan ${seat2.seatNumber} (ID: ${seat2.id})`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: CREATE BOOKING DENGAN KUNCI KURSI & PNR GENERATION (ETK-01)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 1] POST /api/bookings (Create Booking & PNR) ---')
  const createBookingRes = await app.request('/api/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      flight_schedule_id: schedule.id,
      passengers: [
        {
          full_name: 'Budi Santoso',
          id_number: '3171012345670001',
          birth_date: '1990-01-15',
          gender: 'male',
          seat_class: 'economy',
          seat_id: seat1.id,
        },
      ],
    }),
  })

  const bookingJson = await createBookingRes.json()
  if (!createBookingRes.ok || bookingJson.error) {
    throw new Error(`Create booking gagal: ${JSON.stringify(bookingJson)}`)
  }

  const bookingId = bookingJson.data.id
  const bookingCode = bookingJson.data.booking_code
  console.log(`✓ Booking berhasil dibuat: ID = ${bookingId}, PNR = ${bookingCode}, Status = ${bookingJson.data.status}`)

  if (!bookingCode || bookingCode.length !== 6) {
    throw new Error(`Kode booking (PNR) tidak valid: ${bookingCode}`)
  }

  // Verifikasi kursi terkunci di database
  const [lockedSeat1] = await db.select().from(seats).where(eq(seats.id, seat1.id)).limit(1)
  if (lockedSeat1.isAvailable) {
    throw new Error(`Kursi ${seat1.seatNumber} seharusnya terkunci (isAvailable = false)!`)
  }
  console.log(`✓ Kursi ${seat1.seatNumber} terkunci di database (is_available = false)`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: CREATE MIDTRANS SNAP TRANSACTION (PAY-01)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 2] POST /api/payment/create (Midtrans Snap Token) ---')
  const createPaymentRes = await app.request('/api/payment/create', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      booking_id: bookingId,
    }),
  })

  const paymentJson = await createPaymentRes.json()
  if (!createPaymentRes.ok || paymentJson.error) {
    throw new Error(`Create payment failed: ${JSON.stringify(paymentJson)}`)
  }

  console.log(`✓ Snap Transaction berhasil digenerate:`)
  console.log(`  - Token: ${paymentJson.data.token}`)
  console.log(`  - Redirect URL: ${paymentJson.data.redirect_url}`)
  console.log(`  - Order ID: ${paymentJson.data.order_id}`)

  // Verifikasi record payment tersimpan di database
  const [paymentRec] = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1)
  if (!paymentRec || paymentRec.paymentStatus !== 'pending') {
    throw new Error('Record payment di database tidak sesuai!')
  }
  console.log(`✓ Record payment berstatus 'pending' tersimpan di database`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: ATTEMPT DOWNLOAD E-TICKET WHILE UNPAID (MUST BE REJECTED)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 3] GET /api/bookings/:id/e-ticket (Unpaid: Must Reject) ---')
  const unpaidEticketRes = await app.request(`/api/bookings/${bookingId}/e-ticket`, {
    method: 'GET',
    headers: authHeaders,
  })

  if (unpaidEticketRes.status !== 400) {
    throw new Error(`Seharusnya ditolak 400 jika belum bayar, tapi status: ${unpaidEticketRes.status}`)
  }
  const unpaidJson = await unpaidEticketRes.json()
  console.log(`✓ Berhasil ditolak 400 dengan pesan: "${unpaidJson.message}"`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: MIDTRANS WEBHOOK NOTIFICATION - SETTLEMENT / PAID (PAY-02, PAY-03)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 4] POST /api/payment/notification (Settlement -> Paid) ---')
  const notificationPayload = {
    order_id: paymentJson.data.order_id,
    status_code: '200',
    gross_amount: String(paymentJson.data.amount),
    transaction_status: 'settlement',
    fraud_status: 'accept',
    payment_type: 'bank_transfer',
    transaction_id: `MIDTRANS-TRX-${Date.now()}`,
    signature_key: '', // Pada mode dev tanpa MIDTRANS_SERVER_KEY, verifySignature mengizinkan
  }

  const notifRes = await app.request('/api/payment/notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notificationPayload),
  })

  const notifJson = await notifRes.json()
  if (!notifRes.ok || notifJson.error) {
    throw new Error(`Notification failed: ${JSON.stringify(notifJson)}`)
  }

  // Verifikasi status booking dan payment berubah menjadi paid/success
  const [paidBooking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  const [successPayment] = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1)

  if (paidBooking.status !== 'paid') {
    throw new Error(`Status booking seharusnya 'paid', tapi '${paidBooking.status}'`)
  }
  if (successPayment.paymentStatus !== 'success') {
    throw new Error(`Status payment seharusnya 'success', tapi '${successPayment.paymentStatus}'`)
  }
  console.log(`✓ Webhook sukses memproses pembayaran:`)
  console.log(`  - booking.status: ${paidBooking.status}`)
  console.log(`  - payment.payment_status: ${successPayment.paymentStatus}`)
  console.log(`  - payment.paid_at: ${successPayment.paidAt}`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: DOWNLOAD E-TICKET PDF DENGAN QR CODE (ETK-02, ETK-03)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 5] GET /api/bookings/:id/e-ticket (Paid: PDF Download) ---')
  const paidEticketRes = await app.request(`/api/bookings/${bookingId}/e-ticket`, {
    method: 'GET',
    headers: authHeaders,
  })

  if (!paidEticketRes.ok) {
    const errText = await paidEticketRes.text()
    throw new Error(`Gagal mengunduh e-ticket: ${paidEticketRes.status} - ${errText}`)
  }

  const contentType = paidEticketRes.headers.get('Content-Type')
  const contentDisp = paidEticketRes.headers.get('Content-Disposition')
  const pdfArrayBuffer = await paidEticketRes.arrayBuffer()
  const pdfBuffer = Buffer.from(pdfArrayBuffer)

  console.log(`✓ E-Ticket PDF berhasil dihasilkan:`)
  console.log(`  - Content-Type: ${contentType}`)
  console.log(`  - Content-Disposition: ${contentDisp}`)
  console.log(`  - Ukuran file PDF: ${pdfBuffer.length} bytes`)

  // Validasi format PDF (Header %PDF-)
  const pdfHeader = pdfBuffer.slice(0, 5).toString()
  if (pdfHeader !== '%PDF-') {
    throw new Error(`File yang dihasilkan bukan format PDF valid (Header: ${pdfHeader})`)
  }
  console.log(`✓ Header file PDF valid (${pdfHeader})`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: WEBHOOK EXPIRE / CANCEL -> AUTO RELEASE SEATS (PAY-03)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 6] Webhook Expire / Cancel -> Otomatis Lepas Kursi ---')
  // Buat booking kedua untuk uji expire
  const createBooking2Res = await app.request('/api/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      flight_schedule_id: schedule.id,
      passengers: [
        {
          full_name: 'Siti Aminah',
          id_number: '3171012345670002',
          birth_date: '1992-05-20',
          gender: 'female',
          seat_class: 'economy',
          seat_id: seat2.id,
        },
      ],
    }),
  })

  const booking2Json = await createBooking2Res.json()
  const booking2Id = booking2Json.data.id
  const booking2Code = booking2Json.data.booking_code

  // Pastikan seat2 terkunci
  const [seat2Locked] = await db.select().from(seats).where(eq(seats.id, seat2.id)).limit(1)
  if (seat2Locked.isAvailable) {
    throw new Error(`Kursi ${seat2.seatNumber} seharusnya terkunci!`)
  }
  console.log(`✓ Booking kedua dibuat: ID = ${booking2Id}, kursi ${seat2.seatNumber} terkunci`)

  // Kirim webhook notifikasi 'expire'
  const expireNotifRes = await app.request('/api/payment/notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: `${booking2Code}-${Date.now()}`,
      status_code: '200',
      gross_amount: String(booking2Json.data.total_price),
      transaction_status: 'expire',
      fraud_status: 'accept',
      payment_type: 'bank_transfer',
      signature_key: '',
    }),
  })

  if (!expireNotifRes.ok) {
    throw new Error('Webhook expire notification gagal!')
  }

  // Verifikasi status booking2 menjadi cancelled dan seat2 dilepaskan (isAvailable = true)
  const [cancelledBooking2] = await db.select().from(bookings).where(eq(bookings.id, booking2Id)).limit(1)
  const [seat2Released] = await db.select().from(seats).where(eq(seats.id, seat2.id)).limit(1)

  if (cancelledBooking2.status !== 'cancelled') {
    throw new Error(`Booking seharusnya 'cancelled', tapi '${cancelledBooking2.status}'`)
  }
  if (!seat2Released.isAvailable) {
    throw new Error(`Kursi ${seat2.seatNumber} seharusnya dilepaskan (isAvailable = true)!`)
  }
  console.log(`✓ Booking ${booking2Code} menjadi 'cancelled' dan kursi ${seat2.seatNumber} berhasil dilepaskan (isAvailable = true)`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: CRON JOB AUTO-CANCEL BOOKING PENDING > 1 JAM (PAY-04)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 7] Auto-Cancel Job (PAY-04: Pending > 1 Jam) ---')
  // Buat booking ketiga
  const createBooking3Res = await app.request('/api/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      flight_schedule_id: schedule.id,
      passengers: [
        {
          full_name: 'Dewi Lestari',
          id_number: '3171012345670003',
          birth_date: '1995-10-10',
          gender: 'female',
          seat_class: 'economy',
          seat_id: seat2.id, // Gunakan seat2 yang baru dilepas
        },
      ],
    }),
  })

  const booking3Json = await createBooking3Res.json()
  const booking3Id = booking3Json.data.id

  // Ubah createdAt menjadi 2 jam yang lalu untuk simulasi kedaluwarsa
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  await db
    .update(bookings)
    .set({ createdAt: twoHoursAgo })
    .where(eq(bookings.id, booking3Id))

  console.log(`✓ Booking ID ${booking3Id} diset createdAt ke 2 jam yang lalu`)

  // Jalankan autoCancelPendingBookingsJob()
  const expireJobResult = await autoCancelPendingBookingsJob()
  console.log(`✓ Job hasil: expiredCount = ${expireJobResult.expiredCount}, seatsReleased = ${expireJobResult.seatsReleased}`)

  // Verifikasi booking3 dibatalkan dan kursi dilepas
  const [cancelledBooking3] = await db.select().from(bookings).where(eq(bookings.id, booking3Id)).limit(1)
  const [seat3Released] = await db.select().from(seats).where(eq(seats.id, seat2.id)).limit(1)

  if (cancelledBooking3.status !== 'cancelled') {
    throw new Error(`Booking3 seharusnya 'cancelled', tapi '${cancelledBooking3.status}'`)
  }
  if (!seat3Released.isAvailable) {
    throw new Error(`Kursi ${seat2.seatNumber} seharusnya dilepas oleh cron job!`)
  }
  console.log(`✓ Cron job berhasil membatalkan booking kadaluwarsa & melepaskan kursi ${seat2.seatNumber}`)

  console.log('\n========================================================')
  console.log('    SEMUA TEST INTEGRASI PHASE 5 BERHASIL (100% PASS)   ')
  console.log('========================================================\n')
  process.exit(0)
}

runPhase5Tests().catch((err) => {
  console.error('\n❌ TEST GAGAL DENGAN ERROR:', err)
  process.exit(1)
})
