import { Hono } from 'hono'
import { eq, desc, and, count } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  flightSchedules,
  flightSegments,
  airplanes,
  airlines,
  airports,
  seats,
  bookings,
} from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import {
  flightScheduleSchema,
  flightScheduleUpdateSchema,
} from '../../utils/validators.js'
import { generateSeatList } from '../../services/seat-generator.service.js'
import { flightNotificationService } from '../../services/flight-notification.service.js'
import type { UserContext } from '../../types/index.js'

const flightsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

// Wajib admin
flightsRoute.use('*', authMiddleware, requireRole('admin'))

// GET /api/admin/flights
flightsRoute.get('/', async (c) => {
  const schedules = await db
    .select({
      id: flightSchedules.id,
      flightNumber: flightSchedules.flightNumber,
      flightType: flightSchedules.flightType,
      priceEconomy: flightSchedules.priceEconomy,
      priceBusiness: flightSchedules.priceBusiness,
      status: flightSchedules.status,
      delayMinutes: flightSchedules.delayMinutes,
      source: flightSchedules.source,
      externalRef: flightSchedules.externalRef,
      statusSyncedAt: flightSchedules.statusSyncedAt,
      createdAt: flightSchedules.createdAt,
      airline: {
        id: airlines.id,
        name: airlines.name,
        code: airlines.code,
        logo: airlines.logo,
      },
      airplane: {
        id: airplanes.id,
        registrationNumber: airplanes.registrationNumber,
        model: airplanes.model,
        totalSeatEconomy: airplanes.totalSeatEconomy,
        totalSeatBusiness: airplanes.totalSeatBusiness,
      },
    })
    .from(flightSchedules)
    .leftJoin(airlines, eq(flightSchedules.airlineId, airlines.id))
    .leftJoin(airplanes, eq(flightSchedules.airplaneId, airplanes.id))
    .orderBy(desc(flightSchedules.createdAt))

  // Fetch segments for each schedule
  const scheduleIds = schedules.map((s) => s.id)
  let allSegments: any[] = []

  if (scheduleIds.length > 0) {
    allSegments = await db
      .select({
        id: flightSegments.id,
        flightScheduleId: flightSegments.flightScheduleId,
        segmentOrder: flightSegments.segmentOrder,
        departureTime: flightSegments.departureTime,
        arrivalTime: flightSegments.arrivalTime,
        transitDurationMinutes: flightSegments.transitDurationMinutes,
        originAirportId: flightSegments.originAirportId,
        destinationAirportId: flightSegments.destinationAirportId,
      })
      .from(flightSegments)
      .orderBy(flightSegments.segmentOrder)
  }

  // Fetch airport names
  const allAirports = await db.select().from(airports)
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))

  const result = schedules.map((schedule) => {
    const segments = allSegments
      .filter((seg) => seg.flightScheduleId === schedule.id)
      .map((seg) => ({
        ...seg,
        originAirport: airportMap.get(seg.originAirportId!) || null,
        destinationAirport: airportMap.get(seg.destinationAirportId!) || null,
      }))

    return {
      ...schedule,
      segments,
    }
  })

  return c.json({
    error: false,
    data: result,
  })
})

// GET /api/admin/flights/:id
flightsRoute.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID jadwal tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [schedule] = await db
    .select({
      id: flightSchedules.id,
      flightNumber: flightSchedules.flightNumber,
      flightType: flightSchedules.flightType,
      priceEconomy: flightSchedules.priceEconomy,
      priceBusiness: flightSchedules.priceBusiness,
      status: flightSchedules.status,
      delayMinutes: flightSchedules.delayMinutes,
      source: flightSchedules.source,
      externalRef: flightSchedules.externalRef,
      statusSyncedAt: flightSchedules.statusSyncedAt,
      createdAt: flightSchedules.createdAt,
      airline: {
        id: airlines.id,
        name: airlines.name,
        code: airlines.code,
        logo: airlines.logo,
      },
      airplane: {
        id: airplanes.id,
        registrationNumber: airplanes.registrationNumber,
        model: airplanes.model,
        totalSeatEconomy: airplanes.totalSeatEconomy,
        totalSeatBusiness: airplanes.totalSeatBusiness,
      },
    })
    .from(flightSchedules)
    .leftJoin(airlines, eq(flightSchedules.airlineId, airlines.id))
    .leftJoin(airplanes, eq(flightSchedules.airplaneId, airplanes.id))
    .where(eq(flightSchedules.id, id))
    .limit(1)

  if (!schedule) {
    return c.json({ error: true, message: 'Jadwal penerbangan tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  // Segments
  const rawSegments = await db
    .select()
    .from(flightSegments)
    .where(eq(flightSegments.flightScheduleId, id))
    .orderBy(flightSegments.segmentOrder)

  const allAirports = await db.select().from(airports)
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))

  const segments = rawSegments.map((seg) => ({
    ...seg,
    originAirport: airportMap.get(seg.originAirportId!) || null,
    destinationAirport: airportMap.get(seg.destinationAirportId!) || null,
  }))

  // Seat counts
  const [totalSeats] = await db
    .select({ count: count() })
    .from(seats)
    .where(eq(seats.flightScheduleId, id))

  const [availableSeats] = await db
    .select({ count: count() })
    .from(seats)
    .where(and(eq(seats.flightScheduleId, id), eq(seats.isAvailable, true)))

  return c.json({
    error: false,
    data: {
      ...schedule,
      segments,
      seatStats: {
        total: Number(totalSeats?.count || 0),
        available: Number(availableSeats?.count || 0),
      },
    },
  })
})

// POST /api/admin/flights
flightsRoute.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = flightScheduleSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data jadwal penerbangan tidak valid',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      },
      400,
    )
  }

  const {
    flight_number,
    airline_id,
    airplane_id,
    flight_type,
    price_economy,
    price_business,
    status = 'scheduled',
    segments,
  } = parsed.data

  // Verifikasi maskapai
  const [airline] = await db
    .select({ id: airlines.id })
    .from(airlines)
    .where(eq(airlines.id, airline_id))
    .limit(1)

  if (!airline) {
    return c.json({ error: true, message: 'Maskapai tidak ditemukan', code: 'AIRLINE_NOT_FOUND' }, 404)
  }

  // Verifikasi pesawat
  const [airplane] = await db
    .select()
    .from(airplanes)
    .where(eq(airplanes.id, airplane_id))
    .limit(1)

  if (!airplane) {
    return c.json({ error: true, message: 'Pesawat tidak ditemukan', code: 'AIRPLANE_NOT_FOUND' }, 404)
  }

  // Jalankan transaksi database (Schedule + Segments + Auto-generate Seats)
  let createdScheduleId: number | null = null

  try {
    await db.transaction(async (tx) => {
      // 1. Insert Flight Schedule
      const [schedule] = await tx
        .insert(flightSchedules)
        .values({
          flightNumber: flight_number,
          airlineId: airline_id,
          airplaneId: airplane_id,
          flightType: flight_type,
          priceEconomy: price_economy.toString(),
          priceBusiness: price_business ? price_business.toString() : null,
          status,
          createdBy: userId,
        })
        .returning()

      createdScheduleId = schedule.id

      // 2. Insert Flight Segments
      const segmentValues = segments.map((seg) => ({
        flightScheduleId: schedule.id,
        segmentOrder: seg.segment_order,
        originAirportId: seg.origin_airport_id,
        destinationAirportId: seg.destination_airport_id,
        departureTime: new Date(seg.departure_time),
        arrivalTime: new Date(seg.arrival_time),
        transitDurationMinutes: seg.transit_duration_minutes || null,
      }))

      await tx.insert(flightSegments).values(segmentValues)

      // 3. Auto-generate seats berdasarkan kapasitas pesawat
      const seatRecords = generateSeatList({
        flightScheduleId: schedule.id,
        airplaneId: airplane.id,
        totalSeatEconomy: airplane.totalSeatEconomy,
        totalSeatBusiness: airplane.totalSeatBusiness || 0,
      })

      if (seatRecords.length > 0) {
        await tx.insert(seats).values(seatRecords)
      }
    })
  } catch (err: any) {
    console.error('[Create Flight Schedule Error]', err)
    return c.json(
      {
        error: true,
        message: 'Gagal menyimpan jadwal penerbangan dan kursi',
        code: 'SCHEDULE_CREATION_FAILED',
      },
      500,
    )
  }

  return c.json(
    {
      error: false,
      data: {
        message: 'Jadwal penerbangan dan kursi berhasil dibuat',
        flight_schedule_id: createdScheduleId,
      },
    },
    201,
  )
})

// PUT /api/admin/flights/:id
flightsRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID jadwal tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [existing] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, id))
    .limit(1)

  if (!existing) {
    return c.json({ error: true, message: 'Jadwal penerbangan tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json().catch(() => ({}))
  const parsed = flightScheduleUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data update tidak valid',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      },
      400,
    )
  }

  // Cek apakah jadwal sudah memiliki booking
  const [hasBooking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.flightScheduleId, id))
    .limit(1)

  if (hasBooking) {
    if (
      parsed.data.price_economy !== undefined ||
      parsed.data.price_business !== undefined ||
      parsed.data.airplane_id !== undefined ||
      parsed.data.segments !== undefined
    ) {
      return c.json(
        {
          error: true,
          message:
            'Harga, pesawat, dan segmen penerbangan tidak dapat diubah karena jadwal sudah memiliki pemesanan tiket',
          code: 'VALIDATION_ERROR',
        },
        400,
      )
    }
  }

  const { flight_number, price_economy, price_business, status, delay_minutes } = parsed.data
  const updateData: Partial<typeof flightSchedules.$inferInsert> = {}

  if (flight_number !== undefined) updateData.flightNumber = flight_number
  if (price_economy !== undefined) updateData.priceEconomy = price_economy.toString()
  if (price_business !== undefined)
    updateData.priceBusiness = price_business ? price_business.toString() : null
  if (status !== undefined) updateData.status = status

  if (delay_minutes !== undefined) {
    updateData.delayMinutes = delay_minutes ?? 0
  } else if (status === 'scheduled') {
    updateData.delayMinutes = 0
  }

  const [updated] = await db
    .update(flightSchedules)
    .set(updateData)
    .where(eq(flightSchedules.id, id))
    .returning()

  // Memicu notifikasi email (NTF-01) jika status atau keterlambatan berubah
  const newStatus = updated.status ?? 'scheduled'
  const newDelay = updated.delayMinutes ?? 0
  const oldStatus = existing.status ?? 'scheduled'
  const oldDelay = existing.delayMinutes ?? 0

  if (newStatus !== oldStatus || newDelay !== oldDelay) {
    flightNotificationService
      .notifyFlightScheduleChange(id, oldStatus, oldDelay, newStatus, newDelay)
      .catch((err) => console.error('[FlightNotification] Background notify error:', err))
  }

  return c.json({
    error: false,
    data: {
      message: 'Jadwal penerbangan berhasil diperbarui',
      schedule: updated,
    },
  })
})

// DELETE /api/admin/flights/:id
flightsRoute.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID jadwal tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [existing] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, id))
    .limit(1)

  if (!existing) {
    return c.json({ error: true, message: 'Jadwal penerbangan tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  // Cek apakah jadwal ini sudah memiliki booking
  const [hasBooking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.flightScheduleId, id))
    .limit(1)

  if (hasBooking) {
    return c.json(
      {
        error: true,
        message: 'Jadwal penerbangan tidak dapat dihapus karena sudah memiliki pemesanan tiket',
        code: 'FLIGHT_HAS_BOOKINGS',
      },
      409,
    )
  }

  // Hapus kursi, segmen, dan jadwal dalam transaksi
  await db.transaction(async (tx) => {
    await tx.delete(seats).where(eq(seats.flightScheduleId, id))
    await tx.delete(flightSegments).where(eq(flightSegments.flightScheduleId, id))
    await tx.delete(flightSchedules).where(eq(flightSchedules.id, id))
  })

  return c.json({
    error: false,
    data: {
      message: 'Jadwal penerbangan beserta kursi berhasil dihapus',
    },
  })
})

export default flightsRoute
