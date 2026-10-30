import { Hono } from 'hono'
import { eq, and, inArray, asc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  airplanes,
  bookings,
  bookingPassengers,
  checkIns,
} from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const staffFlightsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

staffFlightsRoute.use('*', authMiddleware, requireRole('staff', 'admin'))

function formatDateInJakarta(d: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/**
 * GET /api/staff/flights
 * Daftar penerbangan untuk staff (default: hari ini, diurutkan berdasarkan jam berangkat)
 * Query: ?date=YYYY-MM-DD (atau ?date=all untuk semua tanggal)
 */
staffFlightsRoute.get('/', async (c) => {
  const dateParam = c.req.query('date')?.trim()
  const now = new Date()
  const targetDate = dateParam || formatDateInJakarta(now)

  const [allSchedules, allAirports, allAirlines, allAirplanes] = await Promise.all([
    db.select().from(flightSchedules),
    db.select().from(airports),
    db.select().from(airlines),
    db.select().from(airplanes),
  ])

  if (allSchedules.length === 0) {
    return c.json({ error: false, data: [] })
  }

  const airportMap = new Map(allAirports.map((a) => [a.id, a]))
  const airlineMap = new Map(allAirlines.map((a) => [a.id, a]))
  const airplaneMap = new Map(allAirplanes.map((a) => [a.id, a]))

  const scheduleIds = allSchedules.map((s) => s.id)
  const allSegments = await db
    .select()
    .from(flightSegments)
    .where(inArray(flightSegments.flightScheduleId, scheduleIds))
    .orderBy(asc(flightSegments.segmentOrder))

  const segmentsBySchedule = new Map<number, typeof allSegments>()
  for (const seg of allSegments) {
    const list = segmentsBySchedule.get(seg.flightScheduleId!) || []
    list.push(seg)
    segmentsBySchedule.set(seg.flightScheduleId!, list)
  }

  // Filter jadwal berdasarkan tanggal keberangkatan segmen pertama (jika bukan date=all)
  const matchingSchedules = allSchedules.filter((sched) => {
    const segs = segmentsBySchedule.get(sched.id) || []
    if (segs.length === 0) return false
    if (targetDate.toLowerCase() === 'all') return true

    const depTime = new Date(segs[0].departureTime)
    const utcDateStr = depTime.toISOString().slice(0, 10)
    const jktDateStr = formatDateInJakarta(depTime)
    return utcDateStr === targetDate || jktDateStr === targetDate
  })

  if (matchingSchedules.length === 0) {
    return c.json({ error: false, data: [] })
  }

  const matchedIds = matchingSchedules.map((s) => s.id)

  // Ambil semua booking berstatus 'paid' untuk penerbangan tersebut
  const paidBookings = await db
    .select({
      id: bookings.id,
      flightScheduleId: bookings.flightScheduleId,
    })
    .from(bookings)
    .where(and(inArray(bookings.flightScheduleId, matchedIds), eq(bookings.status, 'paid')))

  const bookingIds = paidBookings.map((b) => b.id)
  const bookingToScheduleMap = new Map(paidBookings.map((b) => [b.id, b.flightScheduleId!]))

  const passengers =
    bookingIds.length > 0
      ? await db
          .select({
            id: bookingPassengers.id,
            bookingId: bookingPassengers.bookingId,
          })
          .from(bookingPassengers)
          .where(inArray(bookingPassengers.bookingId, bookingIds))
      : []

  const passengerIds = passengers.map((p) => p.id)
  const checkInRows =
    passengerIds.length > 0
      ? await db
          .select({
            bookingPassengerId: checkIns.bookingPassengerId,
            status: checkIns.status,
          })
          .from(checkIns)
          .where(inArray(checkIns.bookingPassengerId, passengerIds))
      : []

  const checkInByPaxId = new Map(checkInRows.map((ci) => [ci.bookingPassengerId!, ci]))

  // Hitung jumlah penumpang, check-in, dan boarded per jadwal penerbangan
  const statsBySchedule = new Map<
    number,
    { passengerCount: number; checkedInCount: number; boardedCount: number }
  >()

  for (const pax of passengers) {
    const schedId = bookingToScheduleMap.get(pax.bookingId!)
    if (!schedId) continue

    const cur = statsBySchedule.get(schedId) || {
      passengerCount: 0,
      checkedInCount: 0,
      boardedCount: 0,
    }
    cur.passengerCount++

    const ci = checkInByPaxId.get(pax.id)
    if (ci && (ci.status === 'checked_in' || ci.status === 'boarded')) {
      cur.checkedInCount++
    }
    if (ci && ci.status === 'boarded') {
      cur.boardedCount++
    }

    statsBySchedule.set(schedId, cur)
  }

  const results = matchingSchedules.map((sched) => {
    const segs = segmentsBySchedule.get(sched.id) || []
    const firstSeg = segs[0]
    const lastSeg = segs[segs.length - 1]

    const orig = firstSeg ? airportMap.get(firstSeg.originAirportId!) : null
    const dest = lastSeg ? airportMap.get(lastSeg.destinationAirportId!) : null
    const airline = sched.airlineId ? airlineMap.get(sched.airlineId) : null
    const airplane = sched.airplaneId ? airplaneMap.get(sched.airplaneId) : null

    const stats = statsBySchedule.get(sched.id) || {
      passengerCount: 0,
      checkedInCount: 0,
      boardedCount: 0,
    }

    const totalCapacity = airplane
      ? (airplane.totalSeatEconomy || 0) + (airplane.totalSeatBusiness || 0)
      : 180

    return {
      id: sched.id,
      flight_number: sched.flightNumber,
      airline: airline ? { name: airline.name, code: airline.code, logo: airline.logo } : null,
      airplane: airplane
        ? { model: airplane.model, registration_number: airplane.registrationNumber }
        : null,
      route: `${orig?.code || '---'}-${dest?.code || '---'}`,
      origin: orig ? { code: orig.code, city: orig.city, name: orig.name } : null,
      destination: dest ? { code: dest.code, city: dest.city, name: dest.name } : null,
      departure_time: firstSeg ? firstSeg.departureTime.toISOString() : null,
      arrival_time: lastSeg ? lastSeg.arrivalTime.toISOString() : null,
      status: sched.status,
      delay_minutes: sched.delayMinutes || 0,
      checked_in_count: stats.checkedInCount,
      boarded_count: stats.boardedCount,
      passenger_count: stats.passengerCount,
      total_capacity: totalCapacity,
    }
  })

  // Urutkan berdasarkan jam keberangkatan paling awal
  results.sort((a, b) => {
    const tA = a.departure_time ? new Date(a.departure_time).getTime() : 0
    const tB = b.departure_time ? new Date(b.departure_time).getTime() : 0
    return tA - tB
  })

  return c.json({
    error: false,
    data: results,
  })
})

export default staffFlightsRoute

