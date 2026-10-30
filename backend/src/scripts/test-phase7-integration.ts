process.env.NODE_ENV = 'test'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import app from '../index.js'
import {
  users,
  airports,
  airlines,
  airplanes,
  flightSchedules,
  flightSegments,
  seats,
  bookings,
  bookingPassengers,
  checkIns,
  refunds,
} from '../db/schema.js'

async function runPhase7Tests() {
  console.log('========================================================')
  console.log('   TESTING PHASE 7 INTEGRATION: STAFF & REFUND MODULE   ')
  console.log('========================================================\n')

  const jwtSecret = process.env.JWT_SECRET || 'skybook_super_secret_jwt_key_2026_x89a4b2c'

  // 1. Siapkan 3 akun: Customer, Staff, Admin
  const ensureUser = async (
    email: string,
    name: string,
    role: 'customer' | 'staff' | 'admin',
  ) => {
    let [u] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!u) {
      const [created] = await db
        .insert(users)
        .values({
          name,
          email,
          role,
          isActive: true,
          emailVerifiedAt: new Date(),
        })
        .returning()
      u = created
    } else if (u.role !== role || !u.emailVerifiedAt) {
      const [updated] = await db
        .update(users)
        .set({ role, isActive: true, emailVerifiedAt: new Date() })
        .where(eq(users.id, u.id))
        .returning()
      u = updated
    }
    const token = jwt.sign(
      { userId: u.id, email: u.email, role: u.role, name: u.name },
      jwtSecret,
      { expiresIn: '1h' },
    )
    return {
      user: u,
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth=${token}`,
        Authorization: `Bearer ${token}`,
      },
    }
  }

  const customerAuth = await ensureUser('test_p7_customer@skybook.com', 'Customer Phase 7', 'customer')
  const staffAuth = await ensureUser('test_p7_staff@skybook.com', 'Staff Phase 7', 'staff')
  const adminAuth = await ensureUser('test_p7_admin@skybook.com', 'Admin Phase 7', 'admin')

  const [origAirport] = await db.select().from(airports).limit(1)
  const [destAirport] = await db
    .select()
    .from(airports)
    .where(sql`${airports.id} != ${origAirport.id}`)
    .limit(1)
  const [airline] = await db.select().from(airlines).limit(1)
  const [airplane] = await db.select().from(airplanes).limit(1)

  // ─────────────────────────────────────────────────────────────────
  // SETUP FLIGHT & PENUMPANG HARI INI UNTUK UJI STAFF
  // ─────────────────────────────────────────────────────────────────
  const depToday = new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 jam dari sekarang
  const arrToday = new Date(depToday.getTime() + 90 * 60 * 1000)
  const todayDateStr = depToday.toISOString().slice(0, 10)

  const [staffFlight] = await db
    .insert(flightSchedules)
    .values({
      flightNumber: `SB-STF-${Date.now().toString().slice(-4)}`,
      airlineId: airline.id,
      airplaneId: airplane.id,
      flightType: 'direct',
      priceEconomy: '1500000',
      status: 'scheduled',
      source: 'manual',
    })
    .returning()

  await db.insert(flightSegments).values({
    flightScheduleId: staffFlight.id,
    segmentOrder: 1,
    originAirportId: origAirport.id,
    destinationAirportId: destAirport.id,
    departureTime: depToday,
    arrivalTime: arrToday,
  })

  const [stfSeat1] = await db
    .insert(seats)
    .values({
      flightScheduleId: staffFlight.id,
      airplaneId: airplane.id,
      seatNumber: '14B',
      seatClass: 'economy',
      isAvailable: false,
    })
    .returning()

  const [stfSeat2] = await db
    .insert(seats)
    .values({
      flightScheduleId: staffFlight.id,
      airplaneId: airplane.id,
      seatNumber: '2A',
      seatClass: 'economy',
      isAvailable: false,
    })
    .returning()

  const [stfBooking] = await db
    .insert(bookings)
    .values({
      bookingCode: `ST${Date.now().toString().slice(-4)}`,
      userId: customerAuth.user.id,
      flightScheduleId: staffFlight.id,
      totalPrice: '3000000',
      status: 'paid',
    })
    .returning()

  const [pax1] = await db
    .insert(bookingPassengers)
    .values({
      bookingId: stfBooking.id,
      seatId: stfSeat1.id,
      fullName: 'Rina Wulandari',
      idNumber: '3201012345670010',
      birthDate: '1994-03-12',
      gender: 'female',
      seatClass: 'economy',
    })
    .returning()

  const [pax2] = await db
    .insert(bookingPassengers)
    .values({
      bookingId: stfBooking.id,
      seatId: stfSeat2.id,
      fullName: 'Dimas Pratama',
      idNumber: '3171098765430022',
      birthDate: '1991-07-25',
      gender: 'male',
      seatClass: 'economy',
    })
    .returning()

  // Check-in kedua penumpang
  const bpCode1 = `BP-${stfBooking.bookingCode}-${pax1.id}-AA11`
  const bpCode2 = `BP-${stfBooking.bookingCode}-${pax2.id}-BB22`

  const [ci1] = await db
    .insert(checkIns)
    .values({
      bookingPassengerId: pax1.id,
      boardingPassCode: bpCode1,
      status: 'checked_in',
    })
    .returning()

  const [ci2] = await db
    .insert(checkIns)
    .values({
      bookingPassengerId: pax2.id,
      boardingPassCode: bpCode2,
      status: 'checked_in',
    })
    .returning()

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: ROLE GUARD & GET /api/staff/flights
  // ─────────────────────────────────────────────────────────────────
  console.log('--- [TEST 1] Role Guard & GET /api/staff/flights ---')
  const forbiddenRes = await app.request('/api/staff/flights', {
    method: 'GET',
    headers: customerAuth.headers,
  })
  if (forbiddenRes.status !== 403) {
    throw new Error(`Customer seharusnya ditolak 403 di /api/staff/flights, dapat: ${forbiddenRes.status}`)
  }
  console.log('✓ Customer ditolak 403 FORBIDDEN saat mengakses endpoint staff')

  const staffFlightsRes = await app.request(`/api/staff/flights?date=${todayDateStr}`, {
    method: 'GET',
    headers: staffAuth.headers,
  })
  const staffFlightsJson = await staffFlightsRes.json()
  if (!staffFlightsRes.ok || staffFlightsJson.error) {
    throw new Error(`GET /api/staff/flights gagal: ${JSON.stringify(staffFlightsJson)}`)
  }

  const foundFlight = staffFlightsJson.data.find((f: any) => f.id === staffFlight.id)
  if (!foundFlight) {
    throw new Error('Penerbangan hari ini tidak ditemukan di GET /api/staff/flights!')
  }
  if (foundFlight.passenger_count !== 2 || foundFlight.checked_in_count !== 2) {
    throw new Error(
      `Hitungan penumpang/check-in tidak sesuai: passenger_count=${foundFlight.passenger_count}, checked_in_count=${foundFlight.checked_in_count}`,
    )
  }
  console.log(
    `✓ GET /api/staff/flights sukses: ${foundFlight.flight_number} (${foundFlight.route}) -> ${foundFlight.checked_in_count}/${foundFlight.passenger_count} check-in`,
  )

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: GET /api/staff/flights/:id/manifest (STF-01 & Masking NIK)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 2] GET /api/staff/flights/:id/manifest (STF-01) ---')
  const manifestRes = await app.request(`/api/staff/flights/${staffFlight.id}/manifest`, {
    method: 'GET',
    headers: staffAuth.headers,
  })
  const manifestJson = await manifestRes.json()
  if (!manifestRes.ok || manifestJson.error) {
    throw new Error(`GET manifest gagal: ${JSON.stringify(manifestJson)}`)
  }

  const manifestPax = manifestJson.data
  if (manifestPax.length !== 2) {
    throw new Error(`Manifest seharusnya berisi 2 penumpang, dapat: ${manifestPax.length}`)
  }

  // Pastikan urutan berdasarkan kursi: 2A (pax2) harus sebelum 14B (pax1)
  if (manifestPax[0].seat_number !== '2A' || manifestPax[1].seat_number !== '14B') {
    throw new Error(
      `Urutan kursi manifest salah: ${manifestPax[0].seat_number}, ${manifestPax[1].seat_number}`,
    )
  }
  console.log(`✓ Manifest terurut berdasarkan kursi: ${manifestPax[0].seat_number} lalu ${manifestPax[1].seat_number}`)

  // Pastikan nomor identitas dimasking (tidak tampil penuh)
  if (manifestPax[1].id_number !== '3201********10') {
    throw new Error(`Masking NIK tidak sesuai: ${manifestPax[1].id_number}`)
  }
  console.log(`✓ Nomor identitas penumpang ter-masking aman: ${manifestPax[1].id_number}`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: POST /api/staff/verify-boarding (STF-02)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 3] POST /api/staff/verify-boarding (STF-02) ---')

  // 3a. Kode tidak ditemukan -> BOARDING_CODE_NOT_FOUND
  const notFoundVerifyRes = await app.request('/api/staff/verify-boarding', {
    method: 'POST',
    headers: staffAuth.headers,
    body: JSON.stringify({ boarding_pass_code: 'BP-INVALID-9999' }),
  })
  const notFoundVerifyJson = await notFoundVerifyRes.json()
  if (notFoundVerifyRes.status !== 404 || notFoundVerifyJson.code !== 'BOARDING_CODE_NOT_FOUND') {
    throw new Error(`Seharusnya 404 BOARDING_CODE_NOT_FOUND, dapat: ${JSON.stringify(notFoundVerifyJson)}`)
  }
  console.log(`✓ Kode tidak dikenal ditolak 404 (code: ${notFoundVerifyJson.code})`)

  // 3b. Salah penerbangan -> WRONG_FLIGHT
  const wrongFlightRes = await app.request('/api/staff/verify-boarding', {
    method: 'POST',
    headers: staffAuth.headers,
    body: JSON.stringify({
      boarding_pass_code: bpCode1,
      flight_schedule_id: staffFlight.id + 9999,
    }),
  })
  const wrongFlightJson = await wrongFlightRes.json()
  if (wrongFlightRes.status !== 400 || wrongFlightJson.code !== 'WRONG_FLIGHT') {
    throw new Error(`Seharusnya 400 WRONG_FLIGHT, dapat: ${JSON.stringify(wrongFlightJson)}`)
  }
  console.log(`✓ Penerbangan berbeda ditolak 400 (code: ${wrongFlightJson.code})`)

  // 3c. Verifikasi boarding sukses
  const okVerifyRes = await app.request('/api/staff/verify-boarding', {
    method: 'POST',
    headers: staffAuth.headers,
    body: JSON.stringify({
      boarding_pass_code: bpCode1,
      flight_schedule_id: staffFlight.id,
    }),
  })
  const okVerifyJson = await okVerifyRes.json()
  if (!okVerifyRes.ok || okVerifyJson.data?.status !== 'boarded') {
    throw new Error(`Verifikasi boarding gagal: ${JSON.stringify(okVerifyJson)}`)
  }
  console.log(
    `✓ Verifikasi boarding sukses: ${okVerifyJson.data.passenger_name} (Kursi ${okVerifyJson.data.seat_number}) -> status: ${okVerifyJson.data.status}`,
  )

  // 3d. Scan ulang kode yang sama -> ALREADY_BOARDED
  const dupVerifyRes = await app.request('/api/staff/verify-boarding', {
    method: 'POST',
    headers: staffAuth.headers,
    body: JSON.stringify({ boarding_pass_code: bpCode1 }),
  })
  const dupVerifyJson = await dupVerifyRes.json()
  if (dupVerifyRes.status !== 409 || dupVerifyJson.code !== 'ALREADY_BOARDED') {
    throw new Error(`Scan duplikat seharusnya 409 ALREADY_BOARDED, dapat: ${JSON.stringify(dupVerifyJson)}`)
  }
  console.log(`✓ Scan kedua untuk kode yang sama ditolak 409 (code: ${dupVerifyJson.code})`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: PUT /api/staff/passengers/:checkInId/status (STF-03)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 4] PUT /api/staff/passengers/:checkInId/status (STF-03) ---')

  const noShowRes = await app.request(`/api/staff/passengers/${ci2.id}/status`, {
    method: 'PUT',
    headers: staffAuth.headers,
    body: JSON.stringify({ status: 'no_show' }),
  })
  const noShowJson = await noShowRes.json()
  if (!noShowRes.ok || noShowJson.data?.status !== 'no_show') {
    throw new Error(`Update status no_show gagal: ${JSON.stringify(noShowJson)}`)
  }
  console.log(`✓ Penumpang 2 (${noShowJson.data.passenger_name}) berhasil diubah ke status: ${noShowJson.data.status}`)

  // Ubah ke boarded menggunakan passenger_id (fallback support)
  const boardPax2Res = await app.request(`/api/staff/passengers/${pax2.id}/status`, {
    method: 'PUT',
    headers: staffAuth.headers,
    body: JSON.stringify({ status: 'boarded' }),
  })
  const boardPax2Json = await boardPax2Res.json()
  if (!boardPax2Res.ok || boardPax2Json.data?.status !== 'boarded') {
    throw new Error(`Update status boarded via passengerId gagal: ${JSON.stringify(boardPax2Json)}`)
  }
  console.log(`✓ Penumpang 2 berhasil diubah ke status: ${boardPax2Json.data.status}`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: CUSTOMER REFUND REGULER & ATURAN BATAS H-6 JAM (RFD-01, RFD-02)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 5] Customer Refund Reguler & Batas H-6 Jam (RFD-01, RFD-02) ---')

  // 5a. stfBooking berangkat 4 jam lagi (< 6 jam) dan flight scheduled -> harus ditolak REFUND_WINDOW_CLOSED
  const lateRefundRes = await app.request('/api/refunds', {
    method: 'POST',
    headers: customerAuth.headers,
    body: JSON.stringify({
      booking_id: stfBooking.id,
      reason: 'Saya ingin membatalkan karena ada perubahan jadwal rapat mendadak',
    }),
  })
  const lateRefundJson = await lateRefundRes.json()
  if (lateRefundRes.status !== 400 || lateRefundJson.code !== 'REFUND_WINDOW_CLOSED') {
    throw new Error(`Refund < H-6 jam harus ditolak REFUND_WINDOW_CLOSED, dapat: ${JSON.stringify(lateRefundJson)}`)
  }
  console.log(`✓ Refund reguler < H-6 jam ditolak 400 (code: ${lateRefundJson.code})`)

  // 5b. Buat penerbangan H+24 jam untuk uji refund reguler yang sah
  const depTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const [normalFlight] = await db
    .insert(flightSchedules)
    .values({
      flightNumber: `SB-RFD-${Date.now().toString().slice(-4)}`,
      airlineId: airline.id,
      airplaneId: airplane.id,
      flightType: 'direct',
      priceEconomy: '1000000',
      status: 'scheduled',
      source: 'manual',
    })
    .returning()

  await db.insert(flightSegments).values({
    flightScheduleId: normalFlight.id,
    segmentOrder: 1,
    originAirportId: origAirport.id,
    destinationAirportId: destAirport.id,
    departureTime: depTomorrow,
    arrivalTime: new Date(depTomorrow.getTime() + 90 * 60 * 1000),
  })

  const [rfdSeat] = await db
    .insert(seats)
    .values({
      flightScheduleId: normalFlight.id,
      airplaneId: airplane.id,
      seatNumber: '8A',
      seatClass: 'economy',
      isAvailable: false,
    })
    .returning()

  const [normalBooking] = await db
    .insert(bookings)
    .values({
      bookingCode: `RF${Date.now().toString().slice(-4)}`,
      userId: customerAuth.user.id,
      flightScheduleId: normalFlight.id,
      totalPrice: '1000000',
      status: 'paid',
    })
    .returning()

  await db.insert(bookingPassengers).values({
    bookingId: normalBooking.id,
    seatId: rfdSeat.id,
    fullName: 'Customer Phase 7',
    idNumber: '3171012345670099',
    birthDate: '1993-04-10',
    gender: 'male',
    seatClass: 'economy',
  })

  const normalRefundRes = await app.request('/api/refunds', {
    method: 'POST',
    headers: customerAuth.headers,
    body: JSON.stringify({
      booking_id: normalBooking.id,
      reason: 'Perjalanan dinas ditunda minggu depan oleh perusahaan',
    }),
  })
  const normalRefundJson = await normalRefundRes.json()
  if (!normalRefundRes.ok || normalRefundJson.error) {
    throw new Error(`Pengajuan refund reguler gagal: ${JSON.stringify(normalRefundJson)}`)
  }
  // 1.000.000 - 20% (200.000) - 25.000 = 775.000
  if (normalRefundJson.data.kind !== 'customer' || normalRefundJson.data.refund_amount !== 775000) {
    throw new Error(`Perhitungan refund reguler tidak sesuai: ${JSON.stringify(normalRefundJson.data)}`)
  }
  console.log(
    `✓ Refund reguler berhasil diajukan: ID=${normalRefundJson.data.id}, kind=${normalRefundJson.data.kind}, refund_amount=Rp ${normalRefundJson.data.refund_amount.toLocaleString('id-ID')}`,
  )

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: REFUND PENERBANGAN DIBATALKAN MASKAPAI (RFD-05)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 6] Refund Penerbangan Dibatalkan Maskapai (RFD-05) ---')

  // Ubah staffFlight menjadi 'cancelled' (walaupun keberangkatan tinggal 4 jam lagi / < H-6 jam)
  await db
    .update(flightSchedules)
    .set({ status: 'cancelled' })
    .where(eq(flightSchedules.id, staffFlight.id))

  // Ajukan refund tanpa mengisi reason (reason kosong)
  const cancelFlightRefundRes = await app.request('/api/refunds', {
    method: 'POST',
    headers: customerAuth.headers,
    body: JSON.stringify({
      booking_id: stfBooking.id,
      reason: '', // Kosong, server otomatis mengisi "Penerbangan dibatalkan maskapai"
    }),
  })
  const cancelFlightRefundJson = await cancelFlightRefundRes.json()
  if (!cancelFlightRefundRes.ok || cancelFlightRefundJson.error) {
    throw new Error(`Refund RFD-05 gagal: ${JSON.stringify(cancelFlightRefundJson)}`)
  }
  if (
    cancelFlightRefundJson.data.kind !== 'flight_cancelled' ||
    cancelFlightRefundJson.data.refund_amount !== 3000000 ||
    cancelFlightRefundJson.data.reason !== 'Penerbangan dibatalkan maskapai'
  ) {
    throw new Error(`Data RFD-05 tidak sesuai spesifikasi: ${JSON.stringify(cancelFlightRefundJson.data)}`)
  }
  console.log(
    `✓ Refund RFD-05 sukses tanpa batas H-6: kind=${cancelFlightRefundJson.data.kind}, refund penuh=Rp ${cancelFlightRefundJson.data.refund_amount.toLocaleString('id-ID')}, reason="${cancelFlightRefundJson.data.reason}"`,
  )

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: GET /api/refunds/my & ADMIN APPROVE/REJECT (RFD-03, RFD-04)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 7] GET /api/refunds/my & Admin Approve/Reject (RFD-03, RFD-04) ---')

  const myRefundsRes = await app.request('/api/refunds/my', {
    method: 'GET',
    headers: customerAuth.headers,
  })
  const myRefundsJson = await myRefundsRes.json()
  if (!myRefundsRes.ok || !Array.isArray(myRefundsJson.data) || myRefundsJson.data.length < 2) {
    throw new Error(`GET /api/refunds/my gagal: ${JSON.stringify(myRefundsJson)}`)
  }
  console.log(`✓ GET /api/refunds/my mengembalikan ${myRefundsJson.data.length} riwayat refund customer`)

  // Admin melihat daftar refund pending
  const adminListRes = await app.request('/api/admin/refunds?status=pending', {
    method: 'GET',
    headers: adminAuth.headers,
  })
  const adminListJson = await adminListRes.json()
  if (!adminListRes.ok || !Array.isArray(adminListJson.data)) {
    throw new Error(`GET /api/admin/refunds gagal: ${JSON.stringify(adminListJson)}`)
  }
  console.log(`✓ GET /api/admin/refunds?status=pending mengembalikan ${adminListJson.data.length} pengajuan`)

  // Admin menyetujui refund normalBooking -> kursi rfdSeat (8A) harus otomatis dilepas & booking.status = 'refunded'
  const approveRes = await app.request(`/api/admin/refunds/${normalRefundJson.data.id}`, {
    method: 'PUT',
    headers: adminAuth.headers,
    body: JSON.stringify({ status: 'approved' }),
  })
  const approveJson = await approveRes.json()
  if (!approveRes.ok || approveJson.data?.status !== 'approved') {
    throw new Error(`Approve refund gagal: ${JSON.stringify(approveJson)}`)
  }

  const [refundedBooking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, normalBooking.id))
    .limit(1)
  const [releasedSeat] = await db.select().from(seats).where(eq(seats.id, rfdSeat.id)).limit(1)

  if (refundedBooking.status !== 'refunded') {
    throw new Error(`Status booking setelah refund approved harus 'refunded', dapat: ${refundedBooking.status}`)
  }
  if (!releasedSeat.isAvailable) {
    throw new Error('Kursi dari booking yang direfund seharusnya otomatis dilepaskan (isAvailable = true)!')
  }
  console.log(
    `✓ Admin approve refund sukses: booking.status='${refundedBooking.status}', kursi ${releasedSeat.seatNumber} dilepaskan (isAvailable=true)`,
  )

  console.log('\n========================================================')
  console.log('    SEMUA TEST INTEGRASI PHASE 7 BERHASIL (100% PASS)   ')
  console.log('========================================================\n')
  process.exit(0)
}

runPhase7Tests().catch((err) => {
  console.error('\n❌ TEST GAGAL DENGAN ERROR:', err)
  process.exit(1)
})

