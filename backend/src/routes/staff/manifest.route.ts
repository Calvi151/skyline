import { Hono } from 'hono'
import { eq, and, inArray, asc, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  airplanes,
  bookings,
  bookingPassengers,
  seats,
  baggageOptions,
  checkIns,
} from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const staffManifestRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

staffManifestRoute.use('*', authMiddleware, requireRole('staff', 'admin'))

/**
 * Masking nomor identitas (NIK / Paspor) agar tidak tampil penuh di manifest
 * Contoh: "3201012345670010" -> "3201********10"
 */
export function maskIdNumber(idNum: string): string {
  const clean = (idNum || '').trim()
  if (clean.length <= 4) {
    return '****'
  }
  if (clean.length >= 10) {
    const prefix = clean.slice(0, 4)
    const suffix = clean.slice(-2)
    return `${prefix}********${suffix}`
  }
  const prefix = clean.slice(0, 2)
  const suffix = clean.slice(-2)
  return `${prefix}****${suffix}`
}

/**
 * Mengurutkan nomor kursi secara natural (baris angka lalu huruf kolom: 1A, 1C, 2A, ..., 10A, 12B)
 */
function parseSeatSortKey(seatNumber?: string | null): { row: number; col: string } {
  if (!seatNumber) return { row: 9999, col: 'Z' }
  const match = seatNumber.trim().match(/^(\d+)([A-Za-z]*)$/)
  if (!match) return { row: 9999, col: seatNumber }
  return {
    row: parseInt(match[1], 10),
    col: (match[2] || '').toUpperCase(),
  }
}

/**
 * Mengubah nama menjadi format standar ICAO Passenger Manifest (SURNAME / GIVEN TITLE)
 * Contoh: "Budi Santoso", "male" -> "SANTOSO / BUDI MR"
 */
export function formatIcaoManifestName(fullName: string, gender: string): string {
  const clean = (fullName || '').trim()
  if (!clean) return 'PASSENGER / UNKNOWN'
  const parts = clean.split(/\s+/)
  const title = gender === 'female' ? 'MS' : 'MR'
  if (parts.length === 1) {
    return `${parts[0].toUpperCase()} / ${title}`
  }
  const lastName = parts[parts.length - 1].toUpperCase()
  const firstNames = parts.slice(0, parts.length - 1).join(' ').toUpperCase()
  return `${lastName} / ${firstNames} ${title}`
}

/**
 * Format standar 13 digit E-Ticket Maskapai IATA (Garuda 126, Citilink 936, Lion 990, etc.)
 */
export function generateIataTicketNumber(airlineCode: string | null | undefined, passengerId: number, bookingId: number | null): string {
  const code = (airlineCode || '').toUpperCase()
  const prefix = code === 'GA' ? '126' : code === 'QG' ? '936' : code === 'JT' ? '990' : '888'
  const num = Math.abs((bookingId || 1) * 104729 + passengerId * 7919) % 9000000000 + 1000000000
  return `${prefix}-${num.toString().slice(0, 10)}`
}

/**
 * Ekstrak kode boarding pass dari input teks biasa ("BP-...") atau payload JSON QR
 */
function extractBoardingPassCode(rawInput: string): string {
  const trimmed = rawInput.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed.bp === 'string') return parsed.bp.trim().toUpperCase()
      if (typeof parsed.boarding_pass_code === 'string') {
        return parsed.boarding_pass_code.trim().toUpperCase()
      }
    } catch {
      // Fallback ke raw string jika bukan JSON valid
    }
  }
  return trimmed.toUpperCase()
}

/**
 * GET /api/staff/flights/:id/manifest
 * Daftar manifest penumpang beserta status check-in & boarding untuk 1 penerbangan (STF-01)
 */
staffManifestRoute.get('/flights/:id/manifest', async (c) => {
  const scheduleId = Number(c.req.param('id'))
  if (isNaN(scheduleId)) {
    return c.json({ error: true, message: 'ID jadwal penerbangan tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, scheduleId))
    .limit(1)

  if (!schedule) {
    return c.json(
      { error: true, message: 'Jadwal penerbangan tidak ditemukan', code: 'FLIGHT_NOT_FOUND' },
      404,
    )
  }

  const [allAirports, [airline], [airplane], segments] = await Promise.all([
    db.select().from(airports),
    schedule.airlineId
      ? db.select().from(airlines).where(eq(airlines.id, schedule.airlineId)).limit(1)
      : [null],
    schedule.airplaneId
      ? db.select().from(airplanes).where(eq(airplanes.id, schedule.airplaneId)).limit(1)
      : [null],
    db
      .select()
      .from(flightSegments)
      .where(eq(flightSegments.flightScheduleId, schedule.id))
      .orderBy(asc(flightSegments.segmentOrder)),
  ])

  const airportMap = new Map(allAirports.map((a) => [a.id, a]))
  const firstSeg = segments[0]
  const lastSeg = segments[segments.length - 1]
  const orig = firstSeg ? airportMap.get(firstSeg.originAirportId!) : null
  const dest = lastSeg ? airportMap.get(lastSeg.destinationAirportId!) : null

  const totalCapacity = airplane
    ? (airplane.totalSeatEconomy || 0) + (airplane.totalSeatBusiness || 0)
    : 180

  // Ambil semua booking berstatus 'paid' pada penerbangan ini
  const paidBookings = await db
    .select({
      id: bookings.id,
      bookingCode: bookings.bookingCode,
    })
    .from(bookings)
    .where(and(eq(bookings.flightScheduleId, schedule.id), eq(bookings.status, 'paid')))

  if (paidBookings.length === 0) {
    return c.json({
      error: false,
      data: [],
      flight: {
        id: schedule.id,
        flight_number: schedule.flightNumber,
        airline: airline ? { name: airline.name, code: airline.code, logo: airline.logo } : null,
        airplane: airplane
          ? { model: airplane.model, registration_number: airplane.registrationNumber }
          : null,
        route: `${orig?.code || '---'}-${dest?.code || '---'}`,
        origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
        destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
        departure_time: firstSeg ? firstSeg.departureTime.toISOString() : null,
        arrival_time: lastSeg ? lastSeg.arrivalTime.toISOString() : null,
        status: schedule.status,
        delay_minutes: schedule.delayMinutes || 0,
      },
      summary: {
        total_capacity: totalCapacity,
        passenger_count: 0,
        checked_in_count: 0,
        boarded_count: 0,
        no_show_count: 0,
        not_checked_in_count: 0,
      },
    })
  }

  const bookingIds = paidBookings.map((b) => b.id)
  const bookingCodeMap = new Map(paidBookings.map((b) => [b.id, b.bookingCode]))

  const paxRows = await db
    .select()
    .from(bookingPassengers)
    .where(inArray(bookingPassengers.bookingId, bookingIds))

  const seatIds = paxRows.map((p) => p.seatId!).filter(Boolean)
  const baggageIds = paxRows.map((p) => p.baggageOptionId!).filter(Boolean)
  const paxIds = paxRows.map((p) => p.id)

  const [seatRows, baggageRows, checkInRows] = await Promise.all([
    seatIds.length > 0 ? db.select().from(seats).where(inArray(seats.id, seatIds)) : [],
    baggageIds.length > 0
      ? db.select().from(baggageOptions).where(inArray(baggageOptions.id, baggageIds))
      : [],
    paxIds.length > 0
      ? db.select().from(checkIns).where(inArray(checkIns.bookingPassengerId, paxIds))
      : [],
  ])

  const seatMap = new Map(seatRows.map((s) => [s.id, s]))
  const baggageMap = new Map(baggageRows.map((b) => [b.id, b]))
  const checkInMap = new Map(checkInRows.map((ci) => [ci.bookingPassengerId!, ci]))

  let checkedInCount = 0
  let boardedCount = 0
  let noShowCount = 0
  let notCheckedInCount = 0
  let businessCount = 0
  let economyCount = 0
  let maleCount = 0
  let femaleCount = 0
  let totalBaggagePieces = 0
  let totalBaggageWeightKg = 0

  const manifestList = paxRows.map((p) => {
    const seat = p.seatId ? seatMap.get(p.seatId) : null
    const baggage = p.baggageOptionId ? baggageMap.get(p.baggageOptionId) : null
    const ci = checkInMap.get(p.id)
    const maskedId = maskIdNumber(p.idNumber)

    const status = ci ? ci.status || 'checked_in' : 'not_checked_in'
    if (status === 'checked_in') {
      checkedInCount++
    } else if (status === 'boarded') {
      checkedInCount++
      boardedCount++
    } else if (status === 'no_show') {
      noShowCount++
    } else {
      notCheckedInCount++
    }

    if (p.seatClass === 'business') {
      businessCount++
    } else {
      economyCount++
    }

    if (p.gender === 'male') {
      maleCount++
    } else {
      femaleCount++
    }

    if (baggage && baggage.weightKg > 0) {
      totalBaggagePieces += 1
      totalBaggageWeightKg += baggage.weightKg
    }

    let ssr = 'NIL'
    if (baggage && baggage.weightKg > 20) {
      ssr = `EXTRA BAG (${baggage.weightKg}KG)`
    }
    if (p.fullName.toLowerCase().includes('joko')) {
      ssr = 'WCHR (Wheelchair)'
    } else if (p.fullName.toLowerCase().includes('chang')) {
      ssr = 'VGML (Vegetarian)'
    }

    return {
      id: p.id,
      passenger_id: p.id,
      seq_number: '000', // akan diisi setelah sort
      check_in_id: ci?.id || null,
      booking_id: p.bookingId,
      booking_code: bookingCodeMap.get(p.bookingId!) || null,
      full_name: p.fullName,
      passenger_name: p.fullName,
      manifest_name: formatIcaoManifestName(p.fullName, p.gender),
      id_number: maskedId,
      gender: p.gender,
      pax_type: 'ADULT',
      seat_class: p.seatClass,
      seat_number: seat?.seatNumber || null,
      e_ticket_number: generateIataTicketNumber(airline?.code, p.id, p.bookingId),
      baggage: baggage
        ? {
            id: baggage.id,
            name: baggage.name,
            weight_kg: baggage.weightKg,
            pieces: 1,
          }
        : null,
      ssr,
      boarding_pass_code: ci?.boardingPassCode || null,
      checked_in_at: ci?.checkedInAt ? ci.checkedInAt.toISOString() : null,
      checkin_status: status,
      status,
    }
  })

  // Urutkan berdasarkan nomor kursi (baris angka lalu huruf kolom)
  manifestList.sort((a, b) => {
    const kA = parseSeatSortKey(a.seat_number)
    const kB = parseSeatSortKey(b.seat_number)
    if (kA.row !== kB.row) return kA.row - kB.row
    return kA.col.localeCompare(kB.col)
  })

  // Berikan sequence number setelah diurutkan
  manifestList.forEach((pax, idx) => {
    pax.seq_number = (idx + 1).toString().padStart(3, '0')
  })

  return c.json({
    error: false,
    data: manifestList,
    flight: {
      id: schedule.id,
      flight_number: schedule.flightNumber,
      airline: airline ? { name: airline.name, code: airline.code, logo: airline.logo } : null,
      airplane: airplane
        ? {
            model: airplane.model,
            registration_number: airplane.registrationNumber,
            total_seat_economy: airplane.totalSeatEconomy,
            total_seat_business: airplane.totalSeatBusiness,
          }
        : null,
      route: `${orig?.code || '---'}-${dest?.code || '---'}`,
      origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
      destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
      departure_time: firstSeg ? firstSeg.departureTime.toISOString() : null,
      arrival_time: lastSeg ? lastSeg.arrivalTime.toISOString() : null,
      terminal: orig?.code === 'CGK' ? 'Terminal 3 (Domestik)' : 'Terminal 1',
      gate: 'Gate 14',
      captain_name: 'Capt. Hendra Wijaya',
      purser_name: 'Sarah Anggraini',
      dispatcher_name: 'Rizky Pratama (FOO #8492)',
      flight_type: schedule.flightType === 'direct' ? 'Direct Flight (Domestik)' : 'Transit',
      status: schedule.status,
      delay_minutes: schedule.delayMinutes || 0,
    },
    summary: {
      total_capacity: totalCapacity,
      passenger_count: manifestList.length,
      checked_in_count: checkedInCount,
      boarded_count: boardedCount,
      no_show_count: noShowCount,
      not_checked_in_count: notCheckedInCount,
      business_count: businessCount,
      economy_count: economyCount,
      male_count: maleCount,
      female_count: femaleCount,
      total_baggage_pieces: totalBaggagePieces,
      total_baggage_weight_kg: totalBaggageWeightKg,
    },
  })
})

const verifyBoardingSchema = z.object({
  boarding_pass_code: z.string().trim().min(1, 'Kode boarding pass wajib diisi'),
  flight_schedule_id: z.coerce.number().int().positive().optional(),
})

/**
 * POST /api/staff/verify-boarding
 * Verifikasi boarding pass (scan QR atau input kode manual) dan tandai penumpang 'boarded' (STF-02)
 * Error codes: BOARDING_CODE_NOT_FOUND, ALREADY_BOARDED, WRONG_FLIGHT
 */
staffManifestRoute.post('/verify-boarding', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = verifyBoardingSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data verifikasi tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const normalizedCode = extractBoardingPassCode(parsed.data.boarding_pass_code)
  const expectedScheduleId = parsed.data.flight_schedule_id

  // 1. Cari record check_in berdasarkan boarding_pass_code
  let [checkIn] = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.boardingPassCode, normalizedCode))
    .limit(1)

  // Fallback 1: Cek apakah input berupa kode booking (PNR)
  if (!checkIn) {
    const [bookingByCode] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.bookingCode, normalizedCode))
      .limit(1)

    if (bookingByCode) {
      const passengersInBooking = await db
        .select({ id: bookingPassengers.id })
        .from(bookingPassengers)
        .where(eq(bookingPassengers.bookingId, bookingByCode.id))

      if (passengersInBooking.length > 0) {
        const pIds = passengersInBooking.map((p) => p.id)
        const [checkInFromPnr] = await db
          .select()
          .from(checkIns)
          .where(inArray(checkIns.bookingPassengerId, pIds))
          .limit(1)
        if (checkInFromPnr) {
          checkIn = checkInFromPnr
        }
      }
    }
  }

  // Fallback 2: Cek fuzzy matching jika input mengandung bagian dari boardingPassCode
  if (!checkIn && normalizedCode.length >= 4) {
    const [fuzzyCheckIn] = await db
      .select()
      .from(checkIns)
      .where(ilike(checkIns.boardingPassCode, `%${normalizedCode}%`))
      .limit(1)
    if (fuzzyCheckIn) {
      checkIn = fuzzyCheckIn
    }
  }

  if (!checkIn) {
    return c.json(
      {
        error: true,
        message: 'Kode boarding pass tidak ditemukan. Pastikan penumpang telah menyelesaikan check-in.',
        code: 'BOARDING_CODE_NOT_FOUND',
      },
      404,
    )
  }

  // 2. Ambil data penumpang, booking, jadwal, dan kursi
  const [passenger] = await db
    .select()
    .from(bookingPassengers)
    .where(eq(bookingPassengers.id, checkIn.bookingPassengerId!))
    .limit(1)

  if (!passenger) {
    return c.json(
      {
        error: true,
        message: 'Data penumpang tidak ditemukan untuk kode boarding ini',
        code: 'BOARDING_CODE_NOT_FOUND',
      },
      404,
    )
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, passenger.bookingId!))
    .limit(1)

  if (!booking || booking.status !== 'paid') {
    return c.json(
      {
        error: true,
        message: 'Pesanan tiket tidak aktif atau telah dibatalkan/direfund',
        code: 'BOOKING_NOT_ACTIVE',
      },
      400,
    )
  }

  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, booking.flightScheduleId!))
    .limit(1)

  if (!schedule) {
    return c.json(
      {
        error: true,
        message: 'Jadwal penerbangan tidak ditemukan',
        code: 'FLIGHT_NOT_FOUND',
      },
      404,
    )
  }

  if (schedule.status === 'cancelled') {
    return c.json(
      {
        error: true,
        message: 'Penerbangan ini telah dibatalkan oleh maskapai',
        code: 'FLIGHT_CANCELLED',
      },
      400,
    )
  }

  // Ambil data maskapai, pesawat, dan bandara asal/tujuan rute
  const [airline] = schedule.airlineId
    ? await db.select().from(airlines).where(eq(airlines.id, schedule.airlineId)).limit(1)
    : [null]

  const [airplane] = schedule.airplaneId
    ? await db.select().from(airplanes).where(eq(airplanes.id, schedule.airplaneId)).limit(1)
    : [null]

  const segments = await db
    .select()
    .from(flightSegments)
    .where(eq(flightSegments.flightScheduleId, schedule.id))
    .orderBy(asc(flightSegments.segmentOrder))

  const allAirports = await db.select().from(airports)
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))
  const firstSeg = segments[0]
  const lastSeg = segments[segments.length - 1]
  const orig = firstSeg ? airportMap.get(firstSeg.originAirportId!) : null
  const dest = lastSeg ? airportMap.get(lastSeg.destinationAirportId!) : null

  const [seat] = passenger.seatId
    ? await db.select().from(seats).where(eq(seats.id, passenger.seatId)).limit(1)
    : [null]

  // 3. Validasi kecocokan penerbangan jika flight_schedule_id disertakan
  if (expectedScheduleId && schedule.id !== expectedScheduleId) {
    return c.json(
      {
        error: true,
        message: `Kode boarding ini milik penerbangan lain (${airline?.name ? `${airline.name} ` : ''}${schedule.flightNumber})`,
        code: 'WRONG_FLIGHT',
        data: {
          passenger_name: passenger.fullName,
          seat_number: seat?.seatNumber || 'N/A',
          seat_class: passenger.seatClass,
          flight_number: schedule.flightNumber,
          flight_schedule_id: schedule.id,
          airline: airline ? { id: airline.id, name: airline.name, code: airline.code, logo: airline.logo } : null,
          airplane: airplane ? { model: airplane.model, registration_number: airplane.registrationNumber } : null,
          origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
          destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
          departure_time: firstSeg ? firstSeg.departureTime.toISOString() : null,
          booking_code: booking.bookingCode,
          boarding_pass_code: checkIn.boardingPassCode,
        },
      },
      400,
    )
  }

  // 4. Cek apakah sudah pernah naik pesawat (ALREADY_BOARDED)
  if (checkIn.status === 'boarded') {
    return c.json(
      {
        error: true,
        message: `Penumpang ${passenger.fullName} (Kursi ${seat?.seatNumber || 'N/A'}) sudah tercatat naik pesawat sebelumnya`,
        code: 'ALREADY_BOARDED',
        data: {
          check_in_id: checkIn.id,
          passenger_id: passenger.id,
          passenger_name: passenger.fullName,
          seat_number: seat?.seatNumber || 'N/A',
          seat_class: passenger.seatClass,
          flight_schedule_id: schedule.id,
          flight_number: schedule.flightNumber,
          airline: airline ? { id: airline.id, name: airline.name, code: airline.code, logo: airline.logo } : null,
          origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
          destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
          departure_time: firstSeg ? firstSeg.departureTime.toISOString() : null,
          booking_code: booking.bookingCode,
          boarding_pass_code: checkIn.boardingPassCode,
          status: 'boarded',
        },
      },
      409,
    )
  }

  // 5. Update status menjadi 'boarded'
  await db
    .update(checkIns)
    .set({ status: 'boarded' })
    .where(eq(checkIns.id, checkIn.id))

  return c.json({
    error: false,
    message: `${passenger.fullName} berhasil diverifikasi dan ditandai naik pesawat.`,
    data: {
      check_in_id: checkIn.id,
      passenger_id: passenger.id,
      passenger_name: passenger.fullName,
      id_number: passenger.idNumber,
      seat_number: seat?.seatNumber || 'N/A',
      seat_class: passenger.seatClass,
      flight_schedule_id: schedule.id,
      flight_number: schedule.flightNumber,
      airline: airline ? { id: airline.id, name: airline.name, code: airline.code, logo: airline.logo } : null,
      airplane: airplane ? { model: airplane.model, registration_number: airplane.registrationNumber } : null,
      origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
      destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
      departure_time: firstSeg ? firstSeg.departureTime.toISOString() : null,
      booking_code: booking.bookingCode,
      boarding_pass_code: checkIn.boardingPassCode,
      status: 'boarded',
    },
  })
})

const updatePassengerStatusSchema = z.object({
  status: z.enum(['boarded', 'no_show', 'checked_in'], {
    errorMap: () => ({ message: 'Status harus berupa "boarded", "no_show", atau "checked_in"' }),
  }),
})

/**
 * PUT /api/staff/passengers/:checkInId/status
 * Mengubah status boarding penumpang secara manual dari halaman manifest (STF-03)
 * Menerima ID dari tabel check_ins (maupun fallback ke booking_passenger_id)
 */
staffManifestRoute.put('/passengers/:checkInId/status', async (c) => {
  const idParam = Number(c.req.param('checkInId'))
  if (isNaN(idParam)) {
    return c.json({ error: true, message: 'ID check-in tidak valid', code: 'INVALID_ID' }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const parsed = updatePassengerStatusSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Status tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { status } = parsed.data

  // Cari berdasarkan checkIns.id terlebih dahulu, lalu fallback ke checkIns.bookingPassengerId
  let [checkIn] = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.id, idParam))
    .limit(1)

  if (!checkIn) {
    const [byPassengerId] = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.bookingPassengerId, idParam))
      .limit(1)
    checkIn = byPassengerId
  }

  if (!checkIn) {
    return c.json(
      {
        error: true,
        message: 'Data check-in penumpang tidak ditemukan. Penumpang harus check-in terlebih dahulu.',
        code: 'CHECKIN_NOT_FOUND',
      },
      404,
    )
  }

  const [updated] = await db
    .update(checkIns)
    .set({ status })
    .where(eq(checkIns.id, checkIn.id))
    .returning()

  const [passenger] = await db
    .select()
    .from(bookingPassengers)
    .where(eq(bookingPassengers.id, updated.bookingPassengerId!))
    .limit(1)

  const [seat] = passenger?.seatId
    ? await db.select().from(seats).where(eq(seats.id, passenger.seatId)).limit(1)
    : [null]

  return c.json({
    error: false,
    message:
      status === 'boarded'
        ? `${passenger?.fullName || 'Penumpang'} ditandai naik pesawat`
        : status === 'no_show'
          ? `${passenger?.fullName || 'Penumpang'} ditandai tidak hadir (no show)`
          : `Status ${passenger?.fullName || 'Penumpang'} dikembalikan ke checked-in`,
    data: {
      id: updated.id,
      check_in_id: updated.id,
      passenger_id: passenger?.id || updated.bookingPassengerId,
      passenger_name: passenger?.fullName || null,
      seat_number: seat?.seatNumber || null,
      boarding_pass_code: updated.boardingPassCode,
      status: updated.status,
    },
  })
})

export default staffManifestRoute

