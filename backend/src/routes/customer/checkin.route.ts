import { Hono } from 'hono'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  bookings,
  bookingPassengers,
  seats,
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  airplanes,
  checkIns,
} from '../../db/schema.js'
import { optionalAuthMiddleware, authMiddleware } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const checkinRoute = new Hono<{
  Variables: {
    user?: UserContext
    userId?: number
  }
}>()

function generateBoardingPassCode(pnr: string, passengerId: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let randomPart = ''
  for (let i = 0; i < 3; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `BP-${pnr}-${passengerId}-${randomPart}`
}

/**
 * GET /api/checkin/eligible
 * Ambil daftar pemesanan milik user yang memenuhi syarat check-in
 */
checkinRoute.get('/eligible', authMiddleware, async (c) => {
  const userId = c.get('userId')
  if (!userId) {
    return c.json({ error: true, message: 'Harap login terlebih dahulu' }, 401)
  }

  // Ambil booking milik user (paid & pending)
  const userBookings = await db
    .select({
      id: bookings.id,
      bookingCode: bookings.bookingCode,
      totalPrice: bookings.totalPrice,
      status: bookings.status,
      createdAt: bookings.createdAt,
      flightScheduleId: bookings.flightScheduleId,
    })
    .from(bookings)
    .where(and(eq(bookings.userId, userId), sql`${bookings.status} != 'cancelled'`))
    .orderBy(sql`${bookings.createdAt} DESC`)

  if (userBookings.length === 0) {
    return c.json({ error: false, data: [] })
  }

  const scheduleIds = userBookings.map((b) => b.flightScheduleId!).filter(Boolean)
  const bookingIds = userBookings.map((b) => b.id)

  const [schedules, allAirports, allAirlines, allAirplanes, allPassengers] = await Promise.all([
    scheduleIds.length > 0
      ? db.select().from(flightSchedules).where(inArray(flightSchedules.id, scheduleIds))
      : [],
    db.select().from(airports),
    db.select().from(airlines),
    db.select().from(airplanes),
    db.select().from(bookingPassengers).where(inArray(bookingPassengers.bookingId, bookingIds)),
  ])

  const scheduleMap = new Map(schedules.map((s) => [s.id, s]))
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))
  const airlineMap = new Map(allAirlines.map((a) => [a.id, a]))
  const airplaneMap = new Map(allAirplanes.map((a) => [a.id, a]))

  const allSegments = scheduleIds.length > 0
    ? await db
        .select()
        .from(flightSegments)
        .where(inArray(flightSegments.flightScheduleId, scheduleIds))
        .orderBy(sql`${flightSegments.segmentOrder} ASC`)
    : []

  const segmentsBySchedule = new Map<number, typeof allSegments>()
  for (const seg of allSegments) {
    const list = segmentsBySchedule.get(seg.flightScheduleId!) || []
    list.push(seg)
    segmentsBySchedule.set(seg.flightScheduleId!, list)
  }

  // Cek check-in status
  const passengerIds = allPassengers.map((p) => p.id)
  const existingCheckIns = passengerIds.length > 0
    ? await db.select().from(checkIns).where(inArray(checkIns.bookingPassengerId, passengerIds))
    : []
  const checkInMap = new Map(existingCheckIns.map((ci) => [ci.bookingPassengerId!, ci]))

  const passengersByBooking = new Map<number, typeof allPassengers>()
  for (const p of allPassengers) {
    const list = passengersByBooking.get(p.bookingId!) || []
    list.push(p)
    passengersByBooking.set(p.bookingId!, list)
  }

  const results = userBookings.map((b) => {
    const sched = scheduleMap.get(b.flightScheduleId!)
    const segs = segmentsBySchedule.get(b.flightScheduleId!) || []
    const firstSeg = segs[0]
    const lastSeg = segs[segs.length - 1]

    const orig = firstSeg ? airportMap.get(firstSeg.originAirportId!) : null
    const dest = lastSeg ? airportMap.get(lastSeg.destinationAirportId!) : null
    const airline = sched?.airlineId ? airlineMap.get(sched.airlineId) : null
    const airplane = sched?.airplaneId ? airplaneMap.get(sched.airplaneId) : null

    const bPassengers = passengersByBooking.get(b.id) || []
    const checkedInCount = bPassengers.filter((p) => checkInMap.has(p.id)).length
    const isFullyCheckedIn = bPassengers.length > 0 && checkedInCount === bPassengers.length

    return {
      id: b.id,
      booking_code: b.bookingCode,
      status: b.status,
      created_at: b.createdAt ? b.createdAt.toISOString() : null,
      passenger_count: bPassengers.length,
      checked_in_count: checkedInCount,
      is_fully_checked_in: isFullyCheckedIn,
      flight: sched
        ? {
            id: sched.id,
            flight_number: sched.flightNumber,
            airline: airline ? { name: airline.name, code: airline.code, logo: airline.logo } : null,
            airplane: airplane ? { model: airplane.model } : null,
            status: sched.status,
            delay_minutes: sched.delayMinutes,
            departure_time: firstSeg ? firstSeg.departureTime.toISOString() : null,
            arrival_time: lastSeg ? lastSeg.arrivalTime.toISOString() : null,
            origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
            destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
          }
        : null,
    }
  })

  return c.json({ error: false, data: results })
})

/**
 * GET /api/checkin/lookup
 * Ambil detail booking berdasarkan booking_code (PNR) atau bookingId untuk halaman check-in
 */
checkinRoute.get('/lookup', optionalAuthMiddleware, async (c) => {
  const pnr = c.req.query('booking_code')?.trim().toUpperCase()
  const bookingIdParam = c.req.query('booking_id')

  let bookingRecord: typeof bookings.$inferSelect | null = null

  if (pnr) {
    const [found] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.bookingCode, pnr))
      .limit(1)
    bookingRecord = found || null
  } else if (bookingIdParam && !isNaN(Number(bookingIdParam))) {
    const [found] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, Number(bookingIdParam)))
      .limit(1)
    bookingRecord = found || null
  }

  if (!bookingRecord) {
    return c.json(
      {
        error: true,
        message: 'Kode booking (PNR) tidak ditemukan. Mohon periksa kembali kode Anda.',
        code: 'BOOKING_NOT_FOUND',
      },
      404,
    )
  }

  // Cek apakah penerbangan dibatalkan
  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, bookingRecord.flightScheduleId!))
    .limit(1)

  if (!schedule) {
    return c.json({ error: true, message: 'Jadwal penerbangan tidak ditemukan', code: 'SCHEDULE_NOT_FOUND' }, 404)
  }

  if (schedule.status === 'cancelled') {
    return c.json(
      {
        error: true,
        message: 'Penerbangan ini telah dibatalkan oleh maskapai. Check-in online tidak dapat dilakukan.',
        code: 'FLIGHT_CANCELLED',
      },
      400,
    )
  }

  const [allAirports, [airline], [airplane]] = await Promise.all([
    db.select().from(airports),
    schedule.airlineId ? db.select().from(airlines).where(eq(airlines.id, schedule.airlineId)).limit(1) : [null],
    schedule.airplaneId ? db.select().from(airplanes).where(eq(airplanes.id, schedule.airplaneId)).limit(1) : [null],
  ])
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))

  const segments = await db
    .select()
    .from(flightSegments)
    .where(eq(flightSegments.flightScheduleId, schedule.id))
    .orderBy(sql`${flightSegments.segmentOrder} ASC`)

  const enrichedSegments = segments.map((s) => {
    const orig = airportMap.get(s.originAirportId!)
    const dest = airportMap.get(s.destinationAirportId!)
    return {
      id: s.id,
      segment_order: s.segmentOrder,
      origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
      destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
      departure_time: s.departureTime.toISOString(),
      arrival_time: s.arrivalTime.toISOString(),
      transit_duration_minutes: s.transitDurationMinutes,
    }
  })

  // Penumpang
  const passengers = await db
    .select()
    .from(bookingPassengers)
    .where(eq(bookingPassengers.bookingId, bookingRecord.id))

  const seatIds = passengers.map((p) => p.seatId!).filter(Boolean)
  const passengerIds = passengers.map((p) => p.id)

  const [seatRows, checkinRows, allFlightSeats] = await Promise.all([
    seatIds.length > 0 ? db.select().from(seats).where(inArray(seats.id, seatIds)) : [],
    passengerIds.length > 0 ? db.select().from(checkIns).where(inArray(checkIns.bookingPassengerId, passengerIds)) : [],
    db
      .select({
        id: seats.id,
        seat_number: seats.seatNumber,
        seat_class: seats.seatClass,
        is_available: seats.isAvailable,
      })
      .from(seats)
      .where(eq(seats.flightScheduleId, schedule.id))
      .orderBy(sql`${seats.seatNumber} ASC`),
  ])

  const seatMap = new Map(seatRows.map((s) => [s.id, s]))
  const checkinMap = new Map(checkinRows.map((ci) => [ci.bookingPassengerId!, ci]))

  const enrichedPassengers = passengers.map((p) => {
    const seat = p.seatId ? seatMap.get(p.seatId) : null
    const checkin = checkinMap.get(p.id)
    return {
      id: p.id,
      full_name: p.fullName,
      id_number: p.idNumber,
      birth_date: p.birthDate,
      gender: p.gender,
      seat_class: p.seatClass,
      seat_id: p.seatId,
      seat_number: seat?.seatNumber || null,
      is_checked_in: Boolean(checkin),
      boarding_pass_code: checkin?.boardingPassCode || null,
      checked_in_at: checkin?.checkedInAt ? checkin.checkedInAt.toISOString() : null,
    }
  })

  return c.json({
    error: false,
    data: {
      booking_id: bookingRecord.id,
      booking_code: bookingRecord.bookingCode,
      status: bookingRecord.status,
      flight: {
        id: schedule.id,
        flight_number: schedule.flightNumber,
        airline: airline ? { name: airline.name, code: airline.code, logo: airline.logo } : null,
        airplane: airplane ? { model: airplane.model, registration_number: airplane.registrationNumber } : null,
        status: schedule.status,
        delay_minutes: schedule.delayMinutes,
        segments: enrichedSegments,
      },
      passengers: enrichedPassengers,
      available_seats: allFlightSeats,
    },
  })
})

/**
 * POST /api/checkin
 * Melakukan check-in dan menerbitkan boarding pass digital resmi
 */
checkinRoute.post('/', optionalAuthMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))

  const schema = z.object({
    booking_id: z.number().int().positive(),
    seat_changes: z
      .array(
        z.object({
          passenger_id: z.number().int().positive(),
          seat_id: z.number().int().positive(),
        }),
      )
      .optional(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: 'Data check-in tidak valid',
        details: parsed.error.errors,
      },
      400,
    )
  }

  const { booking_id, seat_changes } = parsed.data

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking_id))
    .limit(1)

  if (!booking) {
    return c.json({ error: true, message: 'Pesanan tidak ditemukan', code: 'BOOKING_NOT_FOUND' }, 404)
  }

  // Cek status penerbangan
  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, booking.flightScheduleId!))
    .limit(1)

  if (!schedule || schedule.status === 'cancelled') {
    return c.json(
      {
        error: true,
        message: 'Penerbangan telah dibatalkan, check-in tidak dapat diproses',
        code: 'FLIGHT_CANCELLED',
      },
      400,
    )
  }

  const passengers = await db
    .select()
    .from(bookingPassengers)
    .where(eq(bookingPassengers.bookingId, booking.id))

  if (passengers.length === 0) {
    return c.json({ error: true, message: 'Tidak ada data penumpang pada pesanan ini' }, 400)
  }

  // Tangani perpindahan kursi jika ada
  if (seat_changes && seat_changes.length > 0) {
    for (const change of seat_changes) {
      const passenger = passengers.find((p) => p.id === change.passenger_id)
      if (passenger && passenger.seatId !== change.seat_id) {
        // Bebaskan kursi lama
        if (passenger.seatId) {
          await db
            .update(seats)
            .set({ isAvailable: true })
            .where(eq(seats.id, passenger.seatId))
        }
        // Ambil kursi baru
        await db
          .update(seats)
          .set({ isAvailable: false })
          .where(eq(seats.id, change.seat_id))

        // Update di bookingPassengers
        await db
          .update(bookingPassengers)
          .set({ seatId: change.seat_id })
          .where(eq(bookingPassengers.id, passenger.id))
      }
    }
  }

  // Refresh data penumpang setelah update kursi
  const updatedPassengers = await db
    .select()
    .from(bookingPassengers)
    .where(eq(bookingPassengers.bookingId, booking.id))

  const seatIds = updatedPassengers.map((p) => p.seatId!).filter(Boolean)
  const seatRows = seatIds.length > 0 ? await db.select().from(seats).where(inArray(seats.id, seatIds)) : []
  const seatMap = new Map(seatRows.map((s) => [s.id, s]))

  const now = new Date()
  const issuedBoardingPasses = []

  for (const p of updatedPassengers) {
    // Cek apakah sudah pernah check-in
    const [existing] = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.bookingPassengerId, p.id))
      .limit(1)

    let bpCode = existing?.boardingPassCode
    if (!existing) {
      bpCode = generateBoardingPassCode(booking.bookingCode, p.id)
      await db.insert(checkIns).values({
        bookingPassengerId: p.id,
        boardingPassCode: bpCode,
        checkedInAt: now,
        status: 'checked_in',
      })
    }

    const seat = p.seatId ? seatMap.get(p.seatId) : null
    issuedBoardingPasses.push({
      passenger_id: p.id,
      full_name: p.fullName,
      id_number: p.idNumber,
      seat_number: seat?.seatNumber || 'N/A',
      boarding_pass_code: bpCode,
      checked_in_at: existing?.checkedInAt ? existing.checkedInAt.toISOString() : now.toISOString(),
      gate: '3A',
      boarding_time: '07:10 WIB',
    })
  }

  return c.json({
    error: false,
    message: 'Check-in berhasil diselesaikan!',
    data: {
      booking_code: booking.bookingCode,
      boarding_passes: issuedBoardingPasses,
    },
  })
})

export default checkinRoute
