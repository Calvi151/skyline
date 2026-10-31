import { Hono } from 'hono'
import { eq, sql, desc, asc, and, gte, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  bookings,
  bookingPassengers,
  payments,
  refunds,
  flightSchedules,
  flightSegments,
  airports,
  seats,
  users,
} from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const dashboardRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

dashboardRoute.use('*', authMiddleware, requireRole('admin'))

dashboardRoute.get('/', async (c) => {
  const rangeParam = c.req.query('range')
  const daysRange = rangeParam === '7' ? 7 : rangeParam === '90' ? 90 : 30

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // 1. Today Stats
  const [todayBookingsResult] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(case when ${bookings.status} = 'paid' then ${bookings.totalPrice} else 0 end), 0)`,
    })
    .from(bookings)
    .where(gte(bookings.createdAt, todayStart))

  const [pendingRefundsCount] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(refunds)
    .where(eq(refunds.status, 'pending'))

  const todayStats = {
    bookings: Number(todayBookingsResult?.count || 0),
    revenue: Number(todayBookingsResult?.revenue || 0),
    pending_refunds: Number(pendingRefundsCount?.count || 0),
  }

  // 2. Bookings by day (for chart)
  const rangeStartDate = new Date(todayStart)
  rangeStartDate.setDate(rangeStartDate.getDate() - (daysRange - 1))

  const dailyCounts = await db
    .select({
      day: sql<string>`to_char(${bookings.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(case when ${bookings.status} = 'paid' then ${bookings.totalPrice} else 0 end), 0)`,
    })
    .from(bookings)
    .where(gte(bookings.createdAt, rangeStartDate))
    .groupBy(sql`to_char(${bookings.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${bookings.createdAt}, 'YYYY-MM-DD')`)

  const countMap = new Map<string, number>()
  const revenueMap = new Map<string, number>()
  for (const row of dailyCounts) {
    if (row.day) {
      countMap.set(row.day, Number(row.count))
      revenueMap.set(row.day, Number(row.revenue))
    }
  }

  const bookingsByDay: Array<{ date: string; count: number; revenue: number }> = []
  for (let i = 0; i < daysRange; i++) {
    const cur = new Date(rangeStartDate)
    cur.setDate(cur.getDate() + i)
    const dateStr = cur.toISOString().split('T')[0]
    bookingsByDay.push({
      date: dateStr,
      count: countMap.get(dateStr) || 0,
      revenue: revenueMap.get(dateStr) || 0,
    })
  }

  // 2b. Booking status breakdown within range
  const statusRows = await db
    .select({ status: bookings.status, count: sql<number>`count(*)` })
    .from(bookings)
    .where(gte(bookings.createdAt, rangeStartDate))
    .groupBy(bookings.status)

  const statusBreakdown: Record<string, number> = { pending: 0, paid: 0, cancelled: 0, refunded: 0 }
  for (const r of statusRows) {
    if (r.status) statusBreakdown[r.status] = Number(r.count)
  }

  // 3. Upcoming departures (next flights)
  // Join first segment to get route and departure_time
  const schedules = await db
    .select({
      id: flightSchedules.id,
      flightNumber: flightSchedules.flightNumber,
      status: flightSchedules.status,
    })
    .from(flightSchedules)
    .orderBy(desc(flightSchedules.id))
    .limit(10)

  const upcomingDepartures: Array<{
    flight_schedule_id: number
    flight_number: string
    route: string
    departure_time: string
    seats_sold: number
    seats_total: number
  }> = []

  for (const s of schedules) {
    const segments = await db
      .select({
        segmentOrder: flightSegments.segmentOrder,
        departureTime: flightSegments.departureTime,
        originAirportId: flightSegments.originAirportId,
        destinationAirportId: flightSegments.destinationAirportId,
      })
      .from(flightSegments)
      .where(eq(flightSegments.flightScheduleId, s.id))
      .orderBy(asc(flightSegments.segmentOrder))

    if (segments.length > 0) {
      const firstSeg = segments[0]
      const lastSeg = segments[segments.length - 1]

      const [origAirport] = await db
        .select({ code: airports.code })
        .from(airports)
        .where(eq(airports.id, firstSeg.originAirportId!))
        .limit(1)

      const [destAirport] = await db
        .select({ code: airports.code })
        .from(airports)
        .where(eq(airports.id, lastSeg.destinationAirportId!))
        .limit(1)

      const [seatStats] = await db
        .select({
          total: sql<number>`count(*)`,
          sold: sql<number>`count(case when ${seats.isAvailable} = false then 1 end)`,
        })
        .from(seats)
        .where(eq(seats.flightScheduleId, s.id))

      upcomingDepartures.push({
        flight_schedule_id: s.id,
        flight_number: s.flightNumber,
        route: `${origAirport?.code || '---'}-${destAirport?.code || '---'}`,
        departure_time: firstSeg.departureTime.toISOString(),
        seats_sold: Number(seatStats?.sold || 0),
        seats_total: Number(seatStats?.total || 0),
      })
    }
  }

  // 4. Pending refunds
  const pendingRefundRows = await db
    .select({
      id: refunds.id,
      bookingId: refunds.bookingId,
      refundAmount: refunds.refundAmount,
      reason: refunds.reason,
      status: refunds.status,
      requestedAt: refunds.requestedAt,
    })
    .from(refunds)
    .where(eq(refunds.status, 'pending'))
    .orderBy(desc(refunds.requestedAt))
    .limit(10)

  const pendingRefunds: Array<{
    id: number
    booking_code: string
    passenger: string
    refund_amount: number
  }> = []

  for (const r of pendingRefundRows) {
    if (r.bookingId) {
      const [b] = await db
        .select({
          bookingCode: bookings.bookingCode,
          userId: bookings.userId,
        })
        .from(bookings)
        .where(eq(bookings.id, r.bookingId))
        .limit(1)

      let passengerName = 'Pelanggan'
      const [firstPass] = await db
        .select({ fullName: bookingPassengers.fullName })
        .from(bookingPassengers)
        .where(eq(bookingPassengers.bookingId, r.bookingId))
        .limit(1)

      if (firstPass?.fullName) {
        passengerName = firstPass.fullName
      } else if (b?.userId) {
        const [u] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, b.userId))
          .limit(1)
        if (u?.name) passengerName = u.name
      }

      pendingRefunds.push({
        id: r.id,
        booking_code: b?.bookingCode || `BK-${r.bookingId}`,
        passenger: passengerName,
        refund_amount: Number(r.refundAmount || 0),
      })
    }
  }

  return c.json({
    error: false,
    data: {
      today: todayStats,
      bookings_by_day: bookingsByDay,
      status_breakdown: statusBreakdown,
      upcoming_departures: upcomingDepartures.slice(0, 5),
      pending_refunds: pendingRefunds.slice(0, 5),
    },
  })
})

export default dashboardRoute
