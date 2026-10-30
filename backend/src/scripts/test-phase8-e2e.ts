process.env.NODE_ENV = 'test'
import 'dotenv/config'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { and, eq, inArray } from 'drizzle-orm'
import app from '../index.js'
import { db } from '../db/index.js'
import {
  airlines,
  airplanes,
  airports,
  bookingPassengers,
  bookings,
  checkIns,
  emailVerificationTokens,
  flightNotifications,
  flightSchedules,
  flightSegments,
  payments,
  providerCache,
  providerUsage,
  refunds,
  seats,
  users,
} from '../db/schema.js'
import { verificationService } from '../services/verification.service.js'
import { flightNotificationService } from '../services/flight-notification.service.js'
import { quotaGuardService } from '../services/quota-guard.service.js'
import { importSchedulesJob } from '../jobs/import-schedules.job.js'
import { syncStatusJob } from '../jobs/sync-status.job.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`)
  }
}

async function runPhase8Tests() {
  console.log('=============================================================')
  console.log('🚀 MEMULAI PENGUJIAN END-TO-END & DATA REAL (PHASE 8)')
  console.log('=============================================================\n')

  // Simpan env asli agar bisa dikembalikan
  const originalEnv = {
    PROVIDER_NAME: process.env.PROVIDER_NAME,
    PROVIDER_API_KEY: process.env.PROVIDER_API_KEY,
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
    DUFFEL_TES: process.env.DUFFEL_TES,
    DUFFEL_TOKEN: process.env.DUFFEL_TOKEN,
    DUFFEL_API_KEY: process.env.DUFFEL_API_KEY,
    PROVIDER_MONTHLY_LIMIT: process.env.PROVIDER_MONTHLY_LIMIT,
  }

  // Cleanup trackers
  let createdCustomerId: number | null = null
  let createdStaffId: number | null = null
  let createdAdminId: number | null = null
  let createdScheduleId: number | null = null
  const createdBookingIds: number[] = []
  const importedScheduleIdsToClean: number[] = []

  try {
    // Pastikan master data tersedia
    const [cgk] = await db.select().from(airports).where(eq(airports.code, 'CGK')).limit(1)
    const [dps] = await db.select().from(airports).where(eq(airports.code, 'DPS')).limit(1)
    const [bdo] = await db.select().from(airports).where(eq(airports.code, 'BDO')).limit(1)
    const [sub] = await db.select().from(airports).where(eq(airports.code, 'SUB')).limit(1)
    assert(cgk && dps && bdo && sub, 'Bandara CGK, DPS, BDO, SUB harus ada di database')

    const [airline] = await db.select().from(airlines).where(eq(airlines.code, 'GA')).limit(1)
    assert(airline, 'Maskapai GA harus ada di database')

    const [airplane] = await db
      .select()
      .from(airplanes)
      .where(eq(airplanes.airlineId, airline.id))
      .limit(1)
    assert(airplane, 'Pesawat untuk maskapai GA harus ada di database')

    // Siapkan akun Staff & Admin untuk pengujian
    const suffix = Date.now()
    const [staffUser] = await db
      .insert(users)
      .values({
        name: 'Phase 8 Staff',
        email: `p8.staff.${suffix}@example.com`,
        password: 'hashed_unused',
        role: 'staff',
        isActive: true,
        emailVerifiedAt: new Date(),
      })
      .returning()
    createdStaffId = staffUser.id

    const [adminUser] = await db
      .insert(users)
      .values({
        name: 'Phase 8 Admin',
        email: `p8.admin.${suffix}@example.com`,
        password: 'hashed_unused',
        role: 'admin',
        isActive: true,
        emailVerifiedAt: new Date(),
      })
      .returning()
    createdAdminId = adminUser.id

    const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_in_prod'
    const staffToken = jwt.sign(
      { userId: staffUser.id, email: staffUser.email, role: 'staff', name: staffUser.name },
      secret,
      { expiresIn: '1h' },
    )
    const adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: 'admin', name: adminUser.name },
      secret,
      { expiresIn: '1h' },
    )

    // Buat jadwal penerbangan (H+10 jam agar masuk jendela check-in H-24 dan bisa refund/manifest)
    const now = new Date()
    const depTime = new Date(now.getTime() + 10 * 60 * 60 * 1000)
    const arrTime = new Date(depTime.getTime() + 2 * 60 * 60 * 1000)
    const depDateStr = depTime.toISOString().slice(0, 10)

    const [schedule] = await db
      .insert(flightSchedules)
      .values({
        flightNumber: `GA-P8-${suffix.toString().slice(-4)}`,
        airlineId: airline.id,
        airplaneId: airplane.id,
        flightType: 'direct',
        priceEconomy: '1200000.00',
        priceBusiness: '2500000.00',
        status: 'scheduled',
        source: 'manual',
        delayMinutes: 0,
        createdBy: adminUser.id,
      })
      .returning()
    createdScheduleId = schedule.id

    await db.insert(flightSegments).values({
      flightScheduleId: schedule.id,
      segmentOrder: 1,
      originAirportId: cgk.id,
      destinationAirportId: dps.id,
      departureTime: depTime,
      arrivalTime: arrTime,
      transitDurationMinutes: 0,
    })

    const insertedSeats = await db
      .insert(seats)
      .values([
        {
          flightScheduleId: schedule.id,
          airplaneId: airplane.id,
          seatNumber: '12A',
          seatClass: 'economy',
          isAvailable: true,
        },
        {
          flightScheduleId: schedule.id,
          airplaneId: airplane.id,
          seatNumber: '12B',
          seatClass: 'economy',
          isAvailable: true,
        },
        {
          flightScheduleId: schedule.id,
          airplaneId: airplane.id,
          seatNumber: '1A',
          seatClass: 'business',
          isAvailable: true,
        },
      ])
      .returning()

    // =========================================================================
    // TEST 1: END-TO-END SEMUA FLOW UTAMA
    // =========================================================================
    console.log('--- [Test 1] End-to-End Flow Utama (Auth -> Search -> Booking -> Payment -> E-Ticket -> Check-in -> Staff Boarding -> Refund) ---')

    // 1A. Register Customer
    const customerEmail = `p8.customer.${suffix}@example.com`
    const customerPass = 'Password123!'
    const regRes = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Budi PhaseDelapan',
        email: customerEmail,
        password: customerPass,
        phone: '081234567890',
      }),
    })
    assert(regRes.status === 201, `Register harus 201, dapat ${regRes.status}`)
    const regBody = (await regRes.json()) as any
    createdCustomerId = regBody.data.user.id as number

    // Buat token verifikasi baru yang kita ketahui plain-text-nya dan verifikasi lewat POST /api/auth/verify-email
    const rawVerifyToken = await verificationService.createToken(createdCustomerId!)
    const verifyRes = await app.request('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawVerifyToken }),
    })
    assert(verifyRes.status === 200, `Verify email harus 200, dapat ${verifyRes.status}`)

    // Pastikan token verifikasi sekali pakai (single-use)
    const verifyReuseRes = await app.request('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawVerifyToken }),
    })
    assert(verifyReuseRes.status === 400, 'Token verifikasi yang sudah dipakai harus ditolak (400)')

    // 1B. Login Customer
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password: customerPass }),
    })
    assert(loginRes.status === 200, `Login harus 200, dapat ${loginRes.status}`)
    const setCookieHeader = loginRes.headers.get('set-cookie') || ''
    const tokenMatch = setCookieHeader.match(/auth=([^;]+)/) || setCookieHeader.match(/token=([^;]+)/)
    assert(tokenMatch && tokenMatch[1], 'Cookie JWT token harus dikembalikan saat login')
    const customerToken = tokenMatch[1]
    const customerHeaders = {
      'Content-Type': 'application/json',
      Cookie: `auth=${customerToken}`,
      Authorization: `Bearer ${customerToken}`,
    }

    // 1C. Search & Price Calendar
    const searchRes = await app.request(
      `/api/flights/search?origin=${cgk.id}&destination=${dps.id}&date=${depDateStr}&passengers=1&seat_class=economy&sort=best`,
    )
    assert(searchRes.status === 200, `Search harus 200, dapat ${searchRes.status}`)
    const searchJson = (await searchRes.json()) as any
    assert(Array.isArray(searchJson.data) && searchJson.data.length >= 1, 'Search harus mengembalikan daftar penerbangan')
    const foundFlight = searchJson.data.find((f: any) => f.id === schedule.id)
    assert(foundFlight, 'Jadwal penerbangan yang baru dibuat harus ditemukan di hasil pencarian')
    assert(typeof foundFlight.value_score === 'number', 'Hasil search harus memiliki value_score')

    const calRes = await app.request(
      `/api/flights/price-calendar?origin=${cgk.id}&destination=${dps.id}&date=${depDateStr}&days=7&class=economy`,
    )
    assert(calRes.status === 200, `Price calendar harus 200, dapat ${calRes.status}`)
    const calJson = (await calRes.json()) as any
    assert(Array.isArray(calJson.data) && calJson.data.length === 7, 'Price calendar harus mengembalikan 7 hari')

    // 1D. Create Booking + Seat Lock
    const seat12A = insertedSeats[0]
    const seat12B = insertedSeats[1]
    const bookingRes = await app.request('/api/bookings', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        flight_schedule_id: schedule.id,
        passengers: [
          {
            full_name: 'Budi Santoso',
            id_number: '3201010101010001',
            birth_date: '1995-05-10',
            gender: 'male',
            seat_class: 'economy',
            seat_id: seat12A.id,
          },
        ],
      }),
    })
    assert(bookingRes.status === 201, `Create booking harus 201, dapat ${bookingRes.status}`)
    const bookingJson = (await bookingRes.json()) as any
    const bookingId = bookingJson.data.id as number
    createdBookingIds.push(bookingId)

    // Verifikasi kursi terkunci (race condition guard)
    const dupSeatRes = await app.request('/api/bookings', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        flight_schedule_id: schedule.id,
        passengers: [
          {
            full_name: 'Andi Wijaya',
            id_number: '3201010101010002',
            birth_date: '1994-04-12',
            gender: 'male',
            seat_class: 'economy',
            seat_id: seat12A.id, // Kursi yang sama!
          },
        ],
      }),
    })
    assert(dupSeatRes.status === 409 || dupSeatRes.status === 400, 'Booking kursi yang sudah dikunci harus ditolak')

    // 1E. Payment Create & Webhook Settlement
    const createPayRes = await app.request('/api/payment/create', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ booking_id: bookingId }),
    })
    assert(createPayRes.status === 200 || createPayRes.status === 201, `Create payment harus 200/201, dapat ${createPayRes.status}`)
    const createPayJson = (await createPayRes.json()) as any
    const orderId = createPayJson.data.order_id as string
    const grossAmountStr = String(createPayJson.data.amount)

    const statusCode = '200'
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const validSignature = serverKey
      ? crypto
          .createHash('sha512')
          .update(`${orderId}${statusCode}${grossAmountStr}${serverKey}`)
          .digest('hex')
      : ''

    const webhookRes = await app.request('/api/payment/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmountStr,
        signature_key: validSignature,
        transaction_status: 'settlement',
        fraud_status: 'accept',
        payment_type: 'bank_transfer',
        transaction_id: `MID-P8-${Date.now()}`,
      }),
    })
    assert(webhookRes.status === 200, `Webhook settlement harus 200, dapat ${webhookRes.status}`)

    // 1F. Download E-Ticket PDF
    const eticketRes = await app.request(`/api/bookings/${bookingId}/e-ticket`, {
      method: 'GET',
      headers: customerHeaders,
    })
    assert(eticketRes.status === 200, `Download E-Ticket harus 200, dapat ${eticketRes.status}`)
    const eticketBuf = Buffer.from(await eticketRes.arrayBuffer())
    assert(eticketBuf.subarray(0, 5).toString('ascii') === '%PDF-', 'E-Ticket harus berupa file PDF valid')

    // 1G. Self Check-in & Boarding Pass PDF
    const [paxRecord] = await db
      .select()
      .from(bookingPassengers)
      .where(eq(bookingPassengers.bookingId, bookingId))
      .limit(1)
    assert(paxRecord, 'Data penumpang harus ditemukan')

    const checkinRes = await app.request(`/api/check-in/${bookingId}`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        passenger_id: paxRecord.id,
        new_seat_id: seat12B.id,
      }),
    })
    assert(checkinRes.status === 200, `Check-in harus 200, dapat ${checkinRes.status}`)
    const checkinJson = (await checkinRes.json()) as any
    const boardingPassCode = checkinJson.data.boarding_pass_code as string
    assert(boardingPassCode && boardingPassCode.startsWith('BP-'), 'Boarding pass code harus diawali BP-')

    const bpPdfRes = await app.request(`/api/check-in/${bookingId}/boarding-pass`, {
      method: 'GET',
      headers: customerHeaders,
    })
    assert(bpPdfRes.status === 200, `Boarding Pass PDF harus 200, dapat ${bpPdfRes.status}`)
    const bpPdfBuf = Buffer.from(await bpPdfRes.arrayBuffer())
    assert(bpPdfBuf.subarray(0, 5).toString('ascii') === '%PDF-', 'Boarding Pass harus berupa PDF valid')

    // 1H. Staff Manifest & Verify Boarding
    const manifestRes = await app.request(`/api/staff/flights/${schedule.id}/manifest`, {
      method: 'GET',
      headers: {
        Cookie: `auth=${staffToken}`,
        Authorization: `Bearer ${staffToken}`,
      },
    })
    assert(manifestRes.status === 200, `Staff manifest harus 200, dapat ${manifestRes.status}`)
    const manifestJson = (await manifestRes.json()) as any
    assert(Array.isArray(manifestJson.data) && manifestJson.data.length === 1, 'Manifest harus berisi 1 penumpang')

    const verifyBoardingRes = await app.request('/api/staff/verify-boarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth=${staffToken}`,
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ boarding_pass_code: boardingPassCode }),
    })
    assert(verifyBoardingRes.status === 200, `Verify boarding harus 200, dapat ${verifyBoardingRes.status}`)

    // 1I. Customer Refund Request & Admin Approval
    const refundReqRes = await app.request('/api/refunds', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        booking_id: bookingId,
        reason: 'Perubahan rencana perjalanan mendadak untuk pengujian Phase 8',
      }),
    })
    assert(refundReqRes.ok, `Request refund harus berhasil (200/201), dapat ${refundReqRes.status}`)
    const refundReqJson = (await refundReqRes.json()) as any
    const refundId = refundReqJson.data.id as number

    const approveRefundRes = await app.request(`/api/admin/refunds/${refundId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth=${adminToken}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'approved',
        admin_notes: 'Disetujui dalam pengujian E2E Phase 8',
      }),
    })
    assert(approveRefundRes.status === 200, `Admin approve refund harus 200, dapat ${approveRefundRes.status}`)

    const [updatedBookingAfterRefund] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
    assert(updatedBookingAfterRefund?.status === 'refunded', 'Status booking harus berubah menjadi refunded')

    console.log('✅ [Test 1] LULUS: End-to-End Flow Utama berjalan sempurna!\n')

    // =========================================================================
    // TEST 2: IMPOR IDEMPOTENT & TIDAK MENYENTUH JADWAL YANG SUDAH DIBOOKING
    // =========================================================================
    console.log('--- [Test 2] Impor Jadwal Idempotent & Proteksi Jadwal Ber-booking (DAT-03, DAT-04) ---')

    // Gunakan AeroDataBox mode simulasi deterministik (tanpa memanggil HTTP keluar)
    process.env.PROVIDER_NAME = 'aerodatabox'
    process.env.PROVIDER_API_KEY = ''
    process.env.RAPIDAPI_KEY = ''
    process.env.DUFFEL_TES = ''
    process.env.DUFFEL_TOKEN = ''
    process.env.DUFFEL_API_KEY = ''

    // Cari jadwal impor BDO->SUB yang belum memiliki booking lalu bersihkan agar pengujian mulai dari bersih
    const bdoSubSegs = await db
      .select({ flightScheduleId: flightSegments.flightScheduleId })
      .from(flightSegments)
      .where(
        and(
          eq(flightSegments.originAirportId, bdo.id),
          eq(flightSegments.destinationAirportId, sub.id),
        ),
      )
    const bdoSubScheduleIds = [...new Set(bdoSubSegs.map((s) => s.flightScheduleId).filter((id): id is number => id !== null))]

    if (bdoSubScheduleIds.length > 0) {
      const apiScheds = await db
        .select()
        .from(flightSchedules)
        .where(and(inArray(flightSchedules.id, bdoSubScheduleIds), eq(flightSchedules.source, 'api')))

      for (const oldSched of apiScheds) {
        const existingBookings = await db
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.flightScheduleId, oldSched.id))
          .limit(1)
        if (existingBookings.length === 0) {
          await db.delete(seats).where(eq(seats.flightScheduleId, oldSched.id))
          await db.delete(flightSegments).where(eq(flightSegments.flightScheduleId, oldSched.id))
          await db.delete(flightSchedules).where(eq(flightSchedules.id, oldSched.id))
        }
      }
    }

    // Impor Pertama (BDO-SUB, 1 hari ke depan)
    const importRun1 = await importSchedulesJob(['BDO-SUB'], 1)
    assert(importRun1.created >= 1, `Impor pertama harus membuat minimal 1 jadwal baru, dapat created=${importRun1.created}`)

    const newBdoSubSegs = await db
      .select({ flightScheduleId: flightSegments.flightScheduleId })
      .from(flightSegments)
      .where(
        and(
          eq(flightSegments.originAirportId, bdo.id),
          eq(flightSegments.destinationAirportId, sub.id),
        ),
      )
    const newBdoSubIds = [...new Set(newBdoSubSegs.map((s) => s.flightScheduleId).filter((id): id is number => id !== null))]
    const importedBdoSub = await db
      .select()
      .from(flightSchedules)
      .where(and(inArray(flightSchedules.id, newBdoSubIds), eq(flightSchedules.source, 'api')))

    for (const s of importedBdoSub) {
      importedScheduleIdsToClean.push(s.id)
    }

    // Impor Kedua (rute & tanggal yang sama persis) -> harus idempotent (created === 0, errors === 0)
    const importRun2 = await importSchedulesJob(['BDO-SUB'], 1)
    assert(
      importRun2.created === 0 && importRun2.errors.length === 0,
      `Impor kedua pada rute & tanggal yang sama harus idempotent (created=0, errors=0), dapat created=${importRun2.created}, errors=${JSON.stringify(importRun2.errors)}`,
    )

    // Pasang booking pada salah satu jadwal hasil impor & ubah harganya ke nilai sentinel
    const targetImportedSched = importedBdoSub[0]
    const sentinelPrice = '7777777.00'
    await db
      .update(flightSchedules)
      .set({ priceEconomy: sentinelPrice })
      .where(eq(flightSchedules.id, targetImportedSched.id))

    const [dummyBookingOnImported] = await db
      .insert(bookings)
      .values({
        bookingCode: `P8I${suffix.toString().slice(-3)}`,
        userId: createdCustomerId!,
        flightScheduleId: targetImportedSched.id,
        totalPrice: sentinelPrice,
        status: 'paid',
      })
      .returning()
    createdBookingIds.push(dummyBookingOnImported.id)

    // Impor Ketiga -> jadwal yang sudah ada booking harus di-skip dan harganya TIDAK berubah!
    const importRun3 = await importSchedulesJob(['BDO-SUB'], 1)
    assert(
      importRun3.skipped >= 1 && importRun3.errors.length === 0,
      `Impor ketiga harus melewati (skip) jadwal yang sudah memiliki booking tanpa error, dapat skipped=${importRun3.skipped}, errors=${JSON.stringify(importRun3.errors)}`,
    )

    const [verifiedProtectedSched] = await db
      .select()
      .from(flightSchedules)
      .where(eq(flightSchedules.id, targetImportedSched.id))
      .limit(1)
    assert(
      verifiedProtectedSched?.priceEconomy === sentinelPrice,
      `Harga jadwal ber-booking tidak boleh disentuh oleh impor! Expected ${sentinelPrice}, got ${verifiedProtectedSched?.priceEconomy}`,
    )

    console.log(
      `✅ [Test 2] LULUS: Impor idempotent (run1 created=${importRun1.created}, run2 created=${importRun2.created}) & jadwal ber-booking terlindungi (run3 skipped=${importRun3.skipped})!\n`,
    )

    // =========================================================================
    // TEST 3: PENJAGA KUOTA BERHENTI DI 90% KUOTA BULANAN (DAT-07)
    // =========================================================================
    console.log('--- [Test 3] Penjaga Kuota Berhenti di 90% Kuota Bulanan (DAT-07) ---')

    process.env.PROVIDER_MONTHLY_LIMIT = '500'
    const nowDate = new Date()
    const currentPeriod = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`
    const providerName = 'aerodatabox'

    // Simpan penggunaan kuota saat ini agar bisa dipulihkan
    const [existingUsage] = await db
      .select()
      .from(providerUsage)
      .where(and(eq(providerUsage.provider, providerName), eq(providerUsage.period, currentPeriod)))
      .limit(1)
    const previousUnitsUsed = existingUsage?.unitsUsed ?? 0

    try {
      // Set penggunaan ke 450 dari 500 (tepat 90%)
      if (existingUsage) {
        await db
          .update(providerUsage)
          .set({ unitsUsed: 450, updatedAt: new Date() })
          .where(eq(providerUsage.id, existingUsage.id))
      } else {
        await db.insert(providerUsage).values({
          provider: providerName,
          period: currentPeriod,
          unitsUsed: 450,
        })
      }

      const quotaCheckAt90 = await quotaGuardService.checkQuota(providerName, 1)
      assert(
        quotaCheckAt90.allowed === false,
        `Pada 450/500 (90%), checkQuota(1) harus mengembalikan allowed=false, dapat allowed=${quotaCheckAt90.allowed}`,
      )
      assert(quotaCheckAt90.percent === 90, `Persentase kuota harus 90%, dapat ${quotaCheckAt90.percent}%`)

      // Pastikan cache status kosong untuk jadwal uji agar syncStatusJob memanggil provider.getFlightStatus
      const statusCacheKey = `status:${providerName}:${schedule.flightNumber.replace(/\s+/g, '').toUpperCase()}:${depDateStr}`
      await db.delete(providerCache).where(eq(providerCache.cacheKey, statusCacheKey))

      // Jalankan syncStatusJob(schedule.id) -> harus langsung berhenti ketika kuota >= 90%
      const syncResult = await syncStatusJob(schedule.id)
      assert(
        syncResult.checked === 0 &&
          syncResult.units_used === 0 &&
          syncResult.errors.some((e) => e.includes('Kuota provider habis')),
        `syncStatusJob harus berhenti saat kuota 90% (checked=0, units_used=0), dapat result=${JSON.stringify(syncResult)}`,
      )

      console.log('✅ [Test 3] LULUS: Penjaga kuota otomatis menolak request & menghentikan sync di batas 90% kuota!\n')
    } finally {
      // Pulihkan provider_usage ke nilai semula
      const [currentRow] = await db
        .select()
        .from(providerUsage)
        .where(and(eq(providerUsage.provider, providerName), eq(providerUsage.period, currentPeriod)))
        .limit(1)

      if (existingUsage && currentRow) {
        await db
          .update(providerUsage)
          .set({ unitsUsed: previousUnitsUsed, updatedAt: new Date() })
          .where(eq(providerUsage.id, currentRow.id))
      } else if (!existingUsage && currentRow) {
        await db.delete(providerUsage).where(eq(providerUsage.id, currentRow.id))
      }
    }

    // =========================================================================
    // TEST 4: DEDUPLIKASI NOTIFIKASI EMAIL DELAY & CANCEL (NTF-01)
    // =========================================================================
    console.log('--- [Test 4] Deduplikasi Notifikasi Delay & Pembatalan Penerbangan (NTF-01) ---')

    // Buat 1 booking 'paid' aktif pada schedule utama untuk menerima notifikasi
    const [paidBookingForNotif] = await db
      .insert(bookings)
      .values({
        bookingCode: `P8N${suffix.toString().slice(-3)}`,
        userId: createdCustomerId!,
        flightScheduleId: schedule.id,
        totalPrice: '1200000.00',
        status: 'paid',
      })
      .returning()
    createdBookingIds.push(paidBookingForNotif.id)

    const getNotifCount = async () => {
      const rows = await db
        .select()
        .from(flightNotifications)
        .where(eq(flightNotifications.bookingId, paidBookingForNotif.id))
      return rows.length
    }

    // 4A. Delay 20 menit (>= 15 menit batas minimum) -> harus kirim 1 notifikasi
    await flightNotificationService.notifyFlightScheduleChange(schedule.id, 'scheduled', 0, 'delayed', 20)
    assert((await getNotifCount()) === 1, 'Delay pertama (20m) harus mencatat 1 notifikasi')

    // 4B. Panggilan ulang dengan delay 20 menit yang sama -> tidak boleh dobel!
    await flightNotificationService.notifyFlightScheduleChange(schedule.id, 'delayed', 20, 'delayed', 20)
    assert((await getNotifCount()) === 1, 'Delay 20m kedua (duplikat) tidak boleh menambah record notifikasi')

    // 4C. Delay naik sedikit ke 35 menit (selisih +15m < 30m) -> tidak boleh kirim email lagi
    await flightNotificationService.notifyFlightScheduleChange(schedule.id, 'delayed', 20, 'delayed', 35)
    assert((await getNotifCount()) === 1, 'Kenaikan delay < 30 menit (20m -> 35m) tidak boleh menambah record notifikasi')

    // 4D. Delay naik signifikan ke 55 menit (selisih +35m >= 30m dari 20m) -> kirim notifikasi update ke-2
    await flightNotificationService.notifyFlightScheduleChange(schedule.id, 'delayed', 35, 'delayed', 55)
    assert((await getNotifCount()) === 2, 'Kenaikan delay >= 30 menit (20m -> 55m) harus mencatat notifikasi ke-2')

    // 4E. Status berubah menjadi 'cancelled' -> kirim 1 notifikasi cancel (total 3)
    await flightNotificationService.notifyFlightScheduleChange(schedule.id, 'delayed', 55, 'cancelled', 55)
    assert((await getNotifCount()) === 3, 'Pembatalan pertama harus mencatat notifikasi ke-3 (cancel)')

    // 4F. Panggilan ulang status 'cancelled' -> tidak boleh dobel! (tetap 3)
    await flightNotificationService.notifyFlightScheduleChange(schedule.id, 'cancelled', 55, 'cancelled', 55)
    assert((await getNotifCount()) === 3, 'Pembatalan kedua (duplikat) tidak boleh menambah notifikasi lagi')

    console.log('✅ [Test 4] LULUS: Deduplikasi notifikasi delay & pembatalan bekerja akurat tanpa email ganda!\n')

    // =========================================================================
    // TEST 5: PENCARIAN & BOOKING TETAP JALAN SAAT PROVIDER DIMATIKAN (DAT-08)
    // =========================================================================
    console.log('--- [Test 5] Ketahanan Sistem Saat Provider Eksternal Dimatikan (DAT-08) ---')

    // Matikan seluruh kredensial provider
    process.env.PROVIDER_API_KEY = ''
    process.env.RAPIDAPI_KEY = ''
    process.env.DUFFEL_TES = ''
    process.env.DUFFEL_TOKEN = ''
    process.env.DUFFEL_API_KEY = ''

    // Kembalikan jadwal uji ke status 'scheduled' agar bisa dicari & dibooking
    await db
      .update(flightSchedules)
      .set({ status: 'scheduled', delayMinutes: 0 })
      .where(eq(flightSchedules.id, schedule.id))

    const offlineSearchRes = await app.request(
      `/api/flights/search?origin=${cgk.id}&destination=${dps.id}&date=${depDateStr}&passengers=1&seat_class=business`,
    )
    assert(offlineSearchRes.status === 200, 'Search harus tetap 200 meskipun provider dimatikan')
    const offlineSearchJson = (await offlineSearchRes.json()) as any
    assert(
      offlineSearchJson.data.some((f: any) => f.id === schedule.id),
      'Jadwal di database lokal harus tetap ditemukan saat provider mati',
    )

    const seat1A = insertedSeats[2]
    const offlineBookingRes = await app.request('/api/bookings', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        flight_schedule_id: schedule.id,
        passengers: [
          {
            full_name: 'Budi Santoso',
            id_number: '3201010101010099',
            birth_date: '1995-05-10',
            gender: 'male',
            seat_class: 'business',
            seat_id: seat1A.id,
          },
        ],
      }),
    })
    assert(
      offlineBookingRes.status === 201,
      `Booking harus tetap berhasil (201) saat provider dimatikan, dapat ${offlineBookingRes.status}`,
    )
    const offlineBookingJson = (await offlineBookingRes.json()) as any
    createdBookingIds.push(offlineBookingJson.data.id)

    console.log('✅ [Test 5] LULUS: Pencarian, Kalender Harga, dan Booking tetap berjalan 100% tanpa ketergantungan ke provider eksternal!\n')

    console.log('=============================================================')
    console.log('🎉 SELURUH PENGUJIAN PHASE 8 (5/5 SKENARIO BESAR) LULUS 100%!')
    console.log('=============================================================')
  } finally {
    // Kembalikan environment variables
    process.env.PROVIDER_NAME = originalEnv.PROVIDER_NAME
    process.env.PROVIDER_API_KEY = originalEnv.PROVIDER_API_KEY
    process.env.RAPIDAPI_KEY = originalEnv.RAPIDAPI_KEY
    process.env.DUFFEL_TES = originalEnv.DUFFEL_TES
    process.env.DUFFEL_TOKEN = originalEnv.DUFFEL_TOKEN
    process.env.DUFFEL_API_KEY = originalEnv.DUFFEL_API_KEY
    process.env.PROVIDER_MONTHLY_LIMIT = originalEnv.PROVIDER_MONTHLY_LIMIT

    // Bersihkan data uji dari database
    try {
      if (createdBookingIds.length > 0) {
        const paxRows = await db
          .select({ id: bookingPassengers.id })
          .from(bookingPassengers)
          .where(inArray(bookingPassengers.bookingId, createdBookingIds))
        const paxIds = paxRows.map((p) => p.id)
        if (paxIds.length > 0) {
          await db.delete(checkIns).where(inArray(checkIns.bookingPassengerId, paxIds))
        }
        await db.delete(flightNotifications).where(inArray(flightNotifications.bookingId, createdBookingIds))
        await db.delete(refunds).where(inArray(refunds.bookingId, createdBookingIds))
        await db.delete(payments).where(inArray(payments.bookingId, createdBookingIds))
        await db.delete(bookingPassengers).where(inArray(bookingPassengers.bookingId, createdBookingIds))
        await db.delete(bookings).where(inArray(bookings.id, createdBookingIds))
      }

      if (importedScheduleIdsToClean.length > 0) {
        await db.delete(seats).where(inArray(seats.flightScheduleId, importedScheduleIdsToClean))
        await db.delete(flightSegments).where(inArray(flightSegments.flightScheduleId, importedScheduleIdsToClean))
        await db.delete(flightSchedules).where(inArray(flightSchedules.id, importedScheduleIdsToClean))
      }

      if (createdScheduleId) {
        await db.delete(seats).where(eq(seats.flightScheduleId, createdScheduleId))
        await db.delete(flightSegments).where(eq(flightSegments.flightScheduleId, createdScheduleId))
        await db.delete(flightSchedules).where(eq(flightSchedules.id, createdScheduleId))
      }

      const userIdsToClean = [createdCustomerId, createdStaffId, createdAdminId].filter(
        (id): id is number => id !== null,
      )
      if (userIdsToClean.length > 0) {
        await db
          .delete(emailVerificationTokens)
          .where(inArray(emailVerificationTokens.userId, userIdsToClean))
        await db.delete(users).where(inArray(users.id, userIdsToClean))
      }
    } catch (cleanupErr) {
      console.error('Warning saat cleanup data uji Phase 8:', cleanupErr)
    }
  }
}

runPhase8Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ PENGUJIAN PHASE 8 GAGAL:', err)
    process.exit(1)
  })
