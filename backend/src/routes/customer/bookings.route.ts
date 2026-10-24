import { Hono } from 'hono'
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  bookings,
  bookingPassengers,
  seats,
  baggageOptions,
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  airplanes,
  payments,
} from '../../db/schema.js'
import { authMiddleware, requireVerifiedEmail } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const bookingsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

// Wajib autentikasi untuk semua endpoint booking
bookingsRoute.use('*', authMiddleware)

/**
 * Generate 6-character unique PNR alphanumeric code
 */
function generatePnr(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // Exclude ambiguous chars (0, 1, I, O)
  let pnr = ''
  for (let i = 0; i < 6; i++) {
    pnr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pnr
}

const passengerSchema = z.object({
  full_name: z.string().min(2, 'Nama penumpang minimal 2 karakter').max(100),
  id_number: z.string().min(4, 'Nomor identitas minimal 4 karakter').max(50),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir YYYY-MM-DD'),
  gender: z.enum(['male', 'female']),
  seat_class: z.enum(['economy', 'business']),
  seat_id: z.number().int().positive('Seat ID wajib diisi'),
  baggage_option_id: z.number().int().positive().optional().nullable(),
})

const createBookingSchema = z.object({
  flight_schedule_id: z.number().int().positive('ID jadwal penerbangan wajib diisi'),
  passengers: z.array(passengerSchema).min(1, 'Minimal 1 penumpang').max(9, 'Maksimal 9 penumpang sekaligus'),
})

/**
 * POST /api/bookings
 * Create booking with PostgreSQL row-level lock (SELECT ... FOR UPDATE) on seats
 */
bookingsRoute.post('/', requireVerifiedEmail, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data pemesanan tidak valid',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      },
      400,
    )
  }

  const { flight_schedule_id, passengers } = parsed.data

  // 1. Fetch flight schedule & check status
  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, flight_schedule_id))
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

  // Tolak penerbangan yang berstatus cancelled
  if (schedule.status === 'cancelled') {
    return c.json(
      {
        error: true,
        message: 'Penerbangan ini telah dibatalkan oleh maskapai dan tidak dapat dipesan',
        code: 'FLIGHT_CANCELLED',
      },
      409,
    )
  }

  // Check for duplicate seat IDs in the same request
  const seatIds = passengers.map((p) => p.seat_id)
  if (new Set(seatIds).size !== seatIds.length) {
    return c.json(
      {
        error: true,
        message: 'Terdapat duplikasi kursi dalam satu pemesanan',
        code: 'DUPLICATE_SEATS_IN_REQUEST',
      },
      400,
    )
  }

  try {
    // 2. PostgreSQL Transaction with SELECT ... FOR UPDATE (Race condition prevention)
    const bookingResult = await db.transaction(async (tx) => {
      // Lock requested seats
      const lockedSeats = await tx.execute(
        sql`SELECT id, seat_number, seat_class, is_available, flight_schedule_id
            FROM seats
            WHERE id IN (${sql.join(seatIds.map((id) => sql`${id}`), sql`, `)})
            FOR UPDATE`,
      )

      const seatList: any[] = Array.isArray(lockedSeats)
        ? lockedSeats
        : (lockedSeats as any).rows || []

      if (seatList.length !== seatIds.length) {
        throw new Error('SEAT_NOT_FOUND')
      }

      const seatMap = new Map<number, any>(
        seatList.map((row: any) => [Number(row.id), row]),
      )

      // Verify all seats belong to this flight, are available, and class matches
      for (const p of passengers) {
        const seat = seatMap.get(p.seat_id)
        if (!seat || Number(seat.flight_schedule_id) !== flight_schedule_id) {
          throw new Error('SEAT_INVALID')
        }
        if (!seat.is_available) {
          throw new Error(`SEAT_NOT_AVAILABLE:${seat.seat_number}`)
        }
        if (seat.seat_class !== p.seat_class) {
          throw new Error(`SEAT_CLASS_MISMATCH:${seat.seat_number}`)
        }
      }

      // Fetch baggage options
      const baggageIds = passengers
        .map((p) => p.baggage_option_id)
        .filter((id): id is number => typeof id === 'number')

      let baggageMap = new Map<number, number>()
      if (baggageIds.length > 0) {
        const baggageRows = await tx
          .select({ id: baggageOptions.id, price: baggageOptions.price })
          .from(baggageOptions)
          .where(inArray(baggageOptions.id, baggageIds))
        baggageMap = new Map(baggageRows.map((b) => [b.id, Number(b.price)]))
      }

      // Calculate total price
      let calculatedTotal = 0
      const passengerPayloads = passengers.map((p) => {
        const ticketPrice = p.seat_class === 'business'
          ? Number(schedule.priceBusiness || schedule.priceEconomy)
          : Number(schedule.priceEconomy)
        const baggagePrice = p.baggage_option_id ? (baggageMap.get(p.baggage_option_id) || 0) : 0
        const itemTotal = ticketPrice + baggagePrice
        calculatedTotal += itemTotal
        return {
          ...p,
          totalPrice: itemTotal,
        }
      })

      // Lock seats: mark is_available = false
      await tx
        .update(seats)
        .set({ isAvailable: false })
        .where(inArray(seats.id, seatIds))

      // Generate unique PNR booking_code
      let pnr = ''
      let isUnique = false
      let attempts = 0
      while (!isUnique && attempts < 10) {
        attempts++
        pnr = generatePnr()
        const [existing] = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.bookingCode, pnr))
          .limit(1)
        if (!existing) isUnique = true
      }

      const now = new Date()
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 jam countdown batas bayar

      // Insert booking record
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          bookingCode: pnr,
          userId,
          flightScheduleId: flight_schedule_id,
          totalPrice: calculatedTotal.toString(),
          status: 'pending',
          bookingDate: now,
          createdAt: now,
        })
        .returning()

      // Insert booking passengers
      for (const p of passengerPayloads) {
        await tx.insert(bookingPassengers).values({
          bookingId: newBooking.id,
          seatId: p.seat_id,
          baggageOptionId: p.baggage_option_id || null,
          fullName: p.full_name,
          idNumber: p.id_number,
          birthDate: p.birth_date,
          gender: p.gender,
          seatClass: p.seat_class,
        })
      }

      return {
        id: newBooking.id,
        booking_code: newBooking.bookingCode,
        total_price: Number(newBooking.totalPrice),
        status: newBooking.status,
        created_at: newBooking.createdAt ? newBooking.createdAt.toISOString() : now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }
    })

    return c.json({
      error: false,
      data: bookingResult,
    }, 201)
  } catch (err: any) {
    const msg: string = err.message || ''

    if (msg.startsWith('SEAT_NOT_AVAILABLE')) {
      const seatNum = msg.split(':')[1] || ''
      return c.json(
        {
          error: true,
          message: `Kursi ${seatNum} sudah dipilih oleh pengguna lain. Silakan pilih kursi lain.`,
          code: 'SEAT_NOT_AVAILABLE',
        },
        409,
      )
    }

    if (msg.startsWith('SEAT_CLASS_MISMATCH')) {
      return c.json(
        {
          error: true,
          message: 'Kelas kursi tidak sesuai dengan kelas tiket yang dipilih',
          code: 'SEAT_CLASS_MISMATCH',
        },
        400,
      )
    }

    if (msg === 'SEAT_INVALID' || msg === 'SEAT_NOT_FOUND') {
      return c.json(
        {
          error: true,
          message: 'Kursi yang dipilih tidak ditemukan pada penerbangan ini',
          code: 'SEAT_NOT_FOUND',
        },
        400,
      )
    }

    console.error('Booking transaction failed:', err)
    return c.json(
      {
        error: true,
        message: 'Gagal memproses pemesanan tiket',
        code: 'TRANSACTION_ERROR',
      },
      500,
    )
  }
})

/**
 * GET /api/bookings/my
 * List bookings of current authenticated user
 */
bookingsRoute.get('/my', async (c) => {
  const userId = c.get('userId')

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
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt))

  if (userBookings.length === 0) {
    return c.json({ error: false, data: [] })
  }

  const scheduleIds = userBookings.map((b) => b.flightScheduleId!).filter(Boolean)

  const [schedules, allAirports, allAirlines] = await Promise.all([
    db.select().from(flightSchedules).where(inArray(flightSchedules.id, scheduleIds)),
    db.select().from(airports),
    db.select().from(airlines),
  ])

  const scheduleMap = new Map(schedules.map((s) => [s.id, s]))
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))
  const airlineMap = new Map(allAirlines.map((a) => [a.id, a]))

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

  // Count passengers per booking
  const passengerCounts = await db
    .select({
      bookingId: bookingPassengers.bookingId,
      count: sql<number>`count(*)::int`,
    })
    .from(bookingPassengers)
    .where(inArray(bookingPassengers.bookingId, userBookings.map((b) => b.id)))
    .groupBy(bookingPassengers.bookingId)

  const passengerCountMap = new Map(passengerCounts.map((pc) => [pc.bookingId, Number(pc.count)]))

  const formattedBookings = userBookings.map((b) => {
    const sched = scheduleMap.get(b.flightScheduleId!)
    const segs = segmentsBySchedule.get(b.flightScheduleId!) || []
    const firstSeg = segs[0]
    const lastSeg = segs[segs.length - 1]

    const orig = firstSeg ? airportMap.get(firstSeg.originAirportId!) : null
    const dest = lastSeg ? airportMap.get(lastSeg.destinationAirportId!) : null
    const airline = sched?.airlineId ? airlineMap.get(sched.airlineId) : null

    const createdTime = b.createdAt ? new Date(b.createdAt) : new Date()
    const expiresAt = new Date(createdTime.getTime() + 60 * 60 * 1000)

    return {
      id: b.id,
      booking_code: b.bookingCode,
      total_price: Number(b.totalPrice),
      status: b.status,
      created_at: createdTime.toISOString(),
      expires_at: expiresAt.toISOString(),
      passenger_count: passengerCountMap.get(b.id) || 1,
      flight: sched
        ? {
            id: sched.id,
            flight_number: sched.flightNumber,
            airline: airline ? { name: airline.name, code: airline.code, logo: airline.logo } : null,
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

  return c.json({
    error: false,
    data: formattedBookings,
  })
})

/**
 * GET /api/bookings/:id
 * Detail booking with passengers, seats, flight and payment status
 */
bookingsRoute.get('/:id', async (c) => {
  const userId = c.get('userId')
  const userRole = c.get('user')?.role
  const id = Number(c.req.param('id'))

  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID booking tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1)

  if (!booking) {
    return c.json({ error: true, message: 'Pemesanan tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  // Ownership check: owner or staff/admin
  if (booking.userId !== userId && userRole !== 'admin' && userRole !== 'staff') {
    return c.json({ error: true, message: 'Anda tidak memiliki hak akses untuk pesanan ini', code: 'FORBIDDEN' }, 403)
  }

  // Fetch flight details
  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, booking.flightScheduleId!))
    .limit(1)

  const [allAirports, [airline], [airplane]] = await Promise.all([
    db.select().from(airports),
    schedule?.airlineId ? db.select().from(airlines).where(eq(airlines.id, schedule.airlineId)).limit(1) : [null],
    schedule?.airplaneId ? db.select().from(airplanes).where(eq(airplanes.id, schedule.airplaneId)).limit(1) : [null],
  ])

  const airportMap = new Map(allAirports.map((a) => [a.id, a]))

  const segments = await db
    .select()
    .from(flightSegments)
    .where(eq(flightSegments.flightScheduleId, booking.flightScheduleId!))
    .orderBy(asc(flightSegments.segmentOrder))

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

  // Fetch passengers with seats and baggage options
  const passRows = await db
    .select()
    .from(bookingPassengers)
    .where(eq(bookingPassengers.bookingId, id))

  const seatIds = passRows.map((p) => p.seatId!).filter(Boolean)
  const baggageIds = passRows.map((p) => p.baggageOptionId!).filter(Boolean)

  const [seatRows, baggageRows] = await Promise.all([
    seatIds.length > 0 ? db.select().from(seats).where(inArray(seats.id, seatIds)) : [],
    baggageIds.length > 0 ? db.select().from(baggageOptions).where(inArray(baggageOptions.id, baggageIds)) : [],
  ])

  const seatMap = new Map(seatRows.map((s) => [s.id, s]))
  const baggageMap = new Map(baggageRows.map((b) => [b.id, b]))

  const enrichedPassengers = passRows.map((p) => {
    const seat = p.seatId ? seatMap.get(p.seatId) : null
    const baggage = p.baggageOptionId ? baggageMap.get(p.baggageOptionId) : null
    return {
      id: p.id,
      full_name: p.fullName,
      id_number: p.idNumber,
      birth_date: p.birthDate,
      gender: p.gender,
      seat_class: p.seatClass,
      seat_number: seat?.seatNumber || null,
      baggage_option: baggage
        ? { id: baggage.id, name: baggage.name, weight_kg: baggage.weightKg, price: Number(baggage.price) }
        : null,
    }
  })

  // Fetch payment status if any
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, id))
    .orderBy(desc(payments.id))
    .limit(1)

  const createdTime = booking.createdAt ? new Date(booking.createdAt) : new Date()
  const expiresAt = new Date(createdTime.getTime() + 60 * 60 * 1000)

  return c.json({
    error: false,
    data: {
      id: booking.id,
      booking_code: booking.bookingCode,
      total_price: Number(booking.totalPrice),
      status: booking.status,
      created_at: createdTime.toISOString(),
      expires_at: expiresAt.toISOString(),
      flight: schedule
        ? {
            id: schedule.id,
            flight_number: schedule.flightNumber,
            airline: airline ? { name: airline.name, code: airline.code, logo: airline.logo } : null,
            airplane: airplane ? { model: airplane.model, registration_number: airplane.registrationNumber } : null,
            status: schedule.status,
            delay_minutes: schedule.delayMinutes,
            segments: enrichedSegments,
          }
        : null,
      passengers: enrichedPassengers,
      payment: payment
        ? {
            id: payment.id,
            payment_status: payment.paymentStatus,
            payment_method: payment.paymentMethod,
            amount: Number(payment.amount),
            paid_at: payment.paidAt ? payment.paidAt.toISOString() : null,
          }
        : null,
    },
  })
})

export default bookingsRoute
