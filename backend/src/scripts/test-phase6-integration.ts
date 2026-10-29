process.env.NODE_ENV = 'test'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { eq, inArray, sql } from 'drizzle-orm'
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
  payments,
} from '../db/schema.js'
import { checkinService } from '../services/checkin.service.js'

async function runPhase6Tests() {
  console.log('========================================================')
  console.log('   TESTING PHASE 6 INTEGRATION: SELF CHECK-IN & PASS    ')
  console.log('========================================================\n')

  // 1. Dapatkan atau siapkan test user
  let [testUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'test_phase6_customer@skybook.com'))
    .limit(1)

  if (!testUser) {
    const [created] = await db
      .insert(users)
      .values({
        name: 'Phase 6 Tester',
        email: 'test_phase6_customer@skybook.com',
        role: 'customer',
        isActive: true,
        emailVerifiedAt: new Date(),
      })
      .returning()
    testUser = created
  }

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

  // 2. Siapkan Airport & Airline referensi
  const [origAirport] = await db.select().from(airports).limit(1)
  const [destAirport] = await db.select().from(airports).where(sql`${airports.id} != ${origAirport.id}`).limit(1)
  const [airline] = await db.select().from(airlines).limit(1)
  const [airplane] = await db.select().from(airplanes).limit(1)

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: VALIDASI JENDELA WAKTU CHECK-IN (H-24 JAM) - ETK-04
  // ─────────────────────────────────────────────────────────────────
  console.log('--- [TEST 1] Validasi Jendela Waktu Check-in (H-24 Jam) ---')

  // Buat penerbangan yang berangkat 48 jam lagi (belum buka check-in)
  const depTimeFuture = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const arrTimeFuture = new Date(depTimeFuture.getTime() + 90 * 60 * 1000)

  const [futureFlight] = await db
    .insert(flightSchedules)
    .values({
      flightNumber: `SB-TEST-FUTURE-${Date.now().toString().slice(-4)}`,
      airlineId: airline.id,
      airplaneId: airplane.id,
      flightType: 'direct',
      priceEconomy: '1000000',
      status: 'scheduled',
      source: 'manual',
    })
    .returning()

  await db.insert(flightSegments).values({
    flightScheduleId: futureFlight.id,
    segmentOrder: 1,
    originAirportId: origAirport.id,
    destinationAirportId: destAirport.id,
    departureTime: depTimeFuture,
    arrivalTime: arrTimeFuture,
  })

  const [futureSeat] = await db
    .insert(seats)
    .values({
      flightScheduleId: futureFlight.id,
      airplaneId: airplane.id,
      seatNumber: '1A',
      seatClass: 'economy',
      isAvailable: false,
    })
    .returning()

  // Buat booking paid untuk penerbangan masa depan ini
  const [futureBooking] = await db
    .insert(bookings)
    .values({
      bookingCode: `FUT${Date.now().toString().slice(-3)}`,
      userId: testUser.id,
      flightScheduleId: futureFlight.id,
      totalPrice: '1000000',
      status: 'paid',
    })
    .returning()

  const [futurePassenger] = await db
    .insert(bookingPassengers)
    .values({
      bookingId: futureBooking.id,
      seatId: futureSeat.id,
      fullName: 'Ahmad Dahlan',
      idNumber: '3171012345670010',
      birthDate: '1990-05-15',
      gender: 'male',
      seatClass: 'economy',
    })
    .returning()

  // Coba check-in untuk penerbangan > 24 jam lagi
  const earlyCheckInRes = await app.request(`/api/check-in/${futureBooking.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      passenger_id: futurePassenger.id,
    }),
  })

  if (earlyCheckInRes.status !== 400) {
    throw new Error(`Seharusnya ditolak 400 (CHECKIN_NOT_OPEN), tapi status: ${earlyCheckInRes.status}`)
  }
  const earlyJson = await earlyCheckInRes.json()
  if (earlyJson.code !== 'CHECKIN_NOT_OPEN') {
    throw new Error(`Code error salah: ${earlyJson.code}`)
  }
  console.log(`✓ Berhasil ditolak 400 (code: CHECKIN_NOT_OPEN): "${earlyJson.message}"`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: PENOLAKAN CHECK-IN PENERBANGAN DIBATALKAN (FLIGHT_CANCELLED)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 2] Penolakan Check-in Penerbangan Dibatalkan ---')

  const depTimeCancelled = new Date(Date.now() + 10 * 60 * 60 * 1000)
  const [cancelledFlight] = await db
    .insert(flightSchedules)
    .values({
      flightNumber: `SB-TEST-CANC-${Date.now().toString().slice(-4)}`,
      airlineId: airline.id,
      airplaneId: airplane.id,
      flightType: 'direct',
      priceEconomy: '1000000',
      status: 'cancelled', // DIBATALKAN
      source: 'manual',
    })
    .returning()

  await db.insert(flightSegments).values({
    flightScheduleId: cancelledFlight.id,
    segmentOrder: 1,
    originAirportId: origAirport.id,
    destinationAirportId: destAirport.id,
    departureTime: depTimeCancelled,
    arrivalTime: new Date(depTimeCancelled.getTime() + 90 * 60 * 1000),
  })

  const [cancelledBooking] = await db
    .insert(bookings)
    .values({
      bookingCode: `CNC${Date.now().toString().slice(-3)}`,
      userId: testUser.id,
      flightScheduleId: cancelledFlight.id,
      totalPrice: '1000000',
      status: 'paid',
    })
    .returning()

  const [cancelledPassenger] = await db
    .insert(bookingPassengers)
    .values({
      bookingId: cancelledBooking.id,
      seatId: futureSeat.id,
      fullName: 'Ahmad Dahlan',
      idNumber: '3171012345670010',
      birthDate: '1990-05-15',
      gender: 'male',
      seatClass: 'economy',
    })
    .returning()

  const cancelledCheckInRes = await app.request(`/api/check-in/${cancelledBooking.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      passenger_id: cancelledPassenger.id,
    }),
  })

  if (cancelledCheckInRes.status !== 409 && cancelledCheckInRes.status !== 400) {
    throw new Error(`Seharusnya ditolak jika penerbangan cancelled, tapi status: ${cancelledCheckInRes.status}`)
  }
  const cancelledJson = await cancelledCheckInRes.json()
  if (cancelledJson.code !== 'FLIGHT_CANCELLED') {
    throw new Error(`Code error harus FLIGHT_CANCELLED, tapi: ${cancelledJson.code}`)
  }
  console.log(`✓ Berhasil ditolak (code: FLIGHT_CANCELLED): "${cancelledJson.message}"`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: CHECK-IN BERHASIL & GENERATE BOARDING PASS CODE + QR (ETK-04, ETK-06)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 3] Check-in Berhasil (Jendela H-12 Jam, Status Scheduled) ---')

  // Buat penerbangan yang berangkat 12 jam lagi (dalam jendela H-24 jam)
  const depTimeValid = new Date(Date.now() + 12 * 60 * 60 * 1000)
  const arrTimeValid = new Date(depTimeValid.getTime() + 90 * 60 * 1000)

  const [validFlight] = await db
    .insert(flightSchedules)
    .values({
      flightNumber: `SB-TEST-OK-${Date.now().toString().slice(-4)}`,
      airlineId: airline.id,
      airplaneId: airplane.id,
      flightType: 'direct',
      priceEconomy: '1200000',
      status: 'scheduled',
      source: 'manual',
    })
    .returning()

  await db.insert(flightSegments).values({
    flightScheduleId: validFlight.id,
    segmentOrder: 1,
    originAirportId: origAirport.id,
    destinationAirportId: destAirport.id,
    departureTime: depTimeValid,
    arrivalTime: arrTimeValid,
  })

  // Buat 3 kursi: kursi penumpang 1, kursi penumpang 2, dan kursi kosong untuk pergantian
  const [seatA] = await db
    .insert(seats)
    .values({
      flightScheduleId: validFlight.id,
      airplaneId: airplane.id,
      seatNumber: '12A',
      seatClass: 'economy',
      isAvailable: false,
    })
    .returning()

  const [seatB] = await db
    .insert(seats)
    .values({
      flightScheduleId: validFlight.id,
      airplaneId: airplane.id,
      seatNumber: '12B',
      seatClass: 'economy',
      isAvailable: false,
    })
    .returning()

  const [seatC] = await db
    .insert(seats)
    .values({
      flightScheduleId: validFlight.id,
      airplaneId: airplane.id,
      seatNumber: '12C',
      seatClass: 'economy',
      isAvailable: true, // Masih kosong
    })
    .returning()

  // Buat booking paid dengan 2 penumpang
  const [activeBooking] = await db
    .insert(bookings)
    .values({
      bookingCode: `OK${Date.now().toString().slice(-4)}`,
      userId: testUser.id,
      flightScheduleId: validFlight.id,
      totalPrice: '2400000',
      status: 'paid',
    })
    .returning()

  const [passenger1] = await db
    .insert(bookingPassengers)
    .values({
      bookingId: activeBooking.id,
      seatId: seatA.id,
      fullName: 'Rizwan Fahri',
      idNumber: '3171012345670020',
      birthDate: '1995-08-20',
      gender: 'male',
      seatClass: 'economy',
    })
    .returning()

  const [passenger2] = await db
    .insert(bookingPassengers)
    .values({
      bookingId: activeBooking.id,
      seatId: seatB.id,
      fullName: 'Nadya Putri',
      idNumber: '3171012345670021',
      birthDate: '1997-12-10',
      gender: 'female',
      seatClass: 'economy',
    })
    .returning()

  // Eksekusi Check-in penumpang 1
  const checkIn1Res = await app.request(`/api/check-in/${activeBooking.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      passenger_id: passenger1.id,
    }),
  })

  const checkIn1Json = await checkIn1Res.json()
  if (!checkIn1Res.ok || checkIn1Json.error) {
    throw new Error(`Check-in 1 gagal: ${JSON.stringify(checkIn1Json)}`)
  }

  console.log(`✓ Check-in Penumpang 1 Sukses:`)
  console.log(`  - Nama: ${checkIn1Json.data.passenger_name}`)
  console.log(`  - Kursi: ${checkIn1Json.data.seat_number}`)
  console.log(`  - Boarding Pass Code: ${checkIn1Json.data.boarding_pass_code}`)
  console.log(`  - Gate: ${checkIn1Json.data.gate}`)
  console.log(`  - Boarding Time: ${checkIn1Json.data.boarding_time}`)
  console.log(`  - QR Code Data URL length: ${checkIn1Json.data.qr_code_url?.length} chars`)

  if (!checkIn1Json.data.boarding_pass_code.startsWith('BP-')) {
    throw new Error(`Format boarding pass code tidak valid: ${checkIn1Json.data.boarding_pass_code}`)
  }
  if (!checkIn1Json.data.qr_code_url.startsWith('data:image/png;base64,')) {
    throw new Error('QR Code harus berupa format data URL PNG base64')
  }

  // Verifikasi record di database check_ins
  const [dbCheckin1] = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.bookingPassengerId, passenger1.id))
    .limit(1)

  if (!dbCheckin1 || dbCheckin1.status !== 'checked_in') {
    throw new Error('Data checkin penumpang 1 tidak tercatat dengan benar di DB!')
  }
  console.log(`✓ Record check-in tercatat di database dengan status 'checked_in'`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: TOLAK DUPLIKASI CHECK-IN (ALREADY_CHECKED_IN)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 4] Tolak Duplikasi Check-in (ALREADY_CHECKED_IN) ---')
  const dupCheckInRes = await app.request(`/api/check-in/${activeBooking.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      passenger_id: passenger1.id,
    }),
  })

  if (dupCheckInRes.status !== 400) {
    throw new Error(`Duplikasi check-in harus ditolak 400, tapi status: ${dupCheckInRes.status}`)
  }
  const dupJson = await dupCheckInRes.json()
  if (dupJson.code !== 'ALREADY_CHECKED_IN') {
    throw new Error(`Code error harus ALREADY_CHECKED_IN, tapi: ${dupJson.code}`)
  }
  console.log(`✓ Duplikasi check-in berhasil ditolak: "${dupJson.message}"`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: CHECK-IN DENGAN GANTI KURSI (ETK-05) & ROW LOCKING
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 5] Check-in Penumpang 2 dengan Ganti Kursi (12B -> 12C) ---')

  // Penumpang 2 pindah dari 12B ke 12C
  const changeSeatCheckInRes = await app.request(`/api/check-in/${activeBooking.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      passenger_id: passenger2.id,
      seat_id: seatC.id, // Pindah ke 12C
    }),
  })

  const changeSeatJson = await changeSeatCheckInRes.json()
  if (!changeSeatCheckInRes.ok || changeSeatJson.error) {
    throw new Error(`Ganti kursi gagal: ${JSON.stringify(changeSeatJson)}`)
  }

  console.log(`✓ Penumpang 2 berhasil ganti kursi ke: ${changeSeatJson.data.seat_number}`)

  // Verifikasi ketersediaan kursi di database:
  // seatB (kursi lama) harus dilepas -> isAvailable = true
  // seatC (kursi baru) harus dikunci -> isAvailable = false
  const [updatedSeatB] = await db.select().from(seats).where(eq(seats.id, seatB.id)).limit(1)
  const [updatedSeatC] = await db.select().from(seats).where(eq(seats.id, seatC.id)).limit(1)

  if (!updatedSeatB.isAvailable) {
    throw new Error('Kursi lama 12B seharusnya dilepaskan (isAvailable = true)!')
  }
  if (updatedSeatC.isAvailable) {
    throw new Error('Kursi baru 12C seharusnya dikunci (isAvailable = false)!')
  }
  console.log(`✓ Kursi lama (12B) dilepaskan (isAvailable = true)`)
  console.log(`✓ Kursi baru (12C) dikunci (isAvailable = false)`)

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: WAKTU BOARDING MENGIKUTI KETERLAMBATAN (DELAY)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 6] Waktu Boarding Mengikuti Keterlambatan Penerbangan ---')
  const schedTime = new Date('2026-11-01T10:00:00Z')
  // Tanpa delay: boarding time = 10:00 - 30 mnt = 09:30
  const normalBoarding = checkinService.calculateBoardingTime(schedTime, 0)
  // Dengan delay 45 menit: keberangkatan baru = 10:45, boarding time = 10:45 - 30 mnt = 10:15
  const delayedBoarding = checkinService.calculateBoardingTime(schedTime, 45)

  console.log(`✓ Waktu keberangkatan asli: 10:00 -> Jam Boarding: ${normalBoarding}`)
  console.log(`✓ Tertunda 45 menit: keberangkatan baru 10:45 -> Jam Boarding: ${delayedBoarding}`)

  if (normalBoarding === delayedBoarding) {
    throw new Error('Jam boarding seharusnya bergeser saat penerbangan tertunda!')
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: DOWNLOAD BOARDING PASS PDF (GET /api/check-in/:bookingId/boarding-pass)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST 7] GET /api/check-in/:bookingId/boarding-pass (Download PDF) ---')
  const bpPdfRes = await app.request(
    `/api/check-in/${activeBooking.id}/boarding-pass?passenger_id=${passenger1.id}`,
    {
      method: 'GET',
      headers: authHeaders,
    },
  )

  if (!bpPdfRes.ok) {
    const errText = await bpPdfRes.text()
    throw new Error(`Gagal mengunduh Boarding Pass PDF: ${bpPdfRes.status} - ${errText}`)
  }

  const bpContentType = bpPdfRes.headers.get('Content-Type')
  const bpContentDisp = bpPdfRes.headers.get('Content-Disposition')
  const bpArrayBuffer = await bpPdfRes.arrayBuffer()
  const bpBuffer = Buffer.from(bpArrayBuffer)

  console.log(`✓ Boarding Pass PDF berhasil dihasilkan:`)
  console.log(`  - Content-Type: ${bpContentType}`)
  console.log(`  - Content-Disposition: ${bpContentDisp}`)
  console.log(`  - Ukuran file: ${bpBuffer.length} bytes`)

  const bpHeader = bpBuffer.slice(0, 5).toString()
  if (bpHeader !== '%PDF-') {
    throw new Error(`File bukan format PDF valid (Header: ${bpHeader})`)
  }
  console.log(`✓ Header file PDF valid (${bpHeader})`)

  console.log('\n========================================================')
  console.log('    SEMUA TEST INTEGRASI PHASE 6 BERHASIL (100% PASS)   ')
  console.log('========================================================\n')
  process.exit(0)
}

runPhase6Tests().catch((err) => {
  console.error('\n❌ TEST GAGAL DENGAN ERROR:', err)
  process.exit(1)
})

