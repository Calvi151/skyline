import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  refunds,
  bookings,
  bookingPassengers,
  flightSegments,
  airports,
  users,
} from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import { refundService } from '../../services/refund.service.js'
import type { UserContext } from '../../types/index.js'

const refundsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

refundsRoute.use('*', authMiddleware, requireRole('admin'))

// GET /api/admin/refunds
refundsRoute.get('/', async (c) => {
  const statusParam = c.req.query('status')

  const query = db
    .select({
      id: refunds.id,
      bookingId: refunds.bookingId,
      reason: refunds.reason,
      refundAmount: refunds.refundAmount,
      status: refunds.status,
      kind: refunds.kind,
      requestedAt: refunds.requestedAt,
      processedAt: refunds.processedAt,
      processedBy: refunds.processedBy,
    })
    .from(refunds)
    .orderBy(desc(refunds.requestedAt))

  let refundRows
  if (statusParam && ['pending', 'approved', 'rejected', 'refunded'].includes(statusParam)) {
    refundRows = await query.where(eq(refunds.status, statusParam as any))
  } else {
    refundRows = await query
  }

  const result: any[] = []

  for (const r of refundRows) {
    let bookingCode = `BK-${r.bookingId}`
    let passengerName = 'Pelanggan'
    let route = '---'
    let departureTime: string | null = null

    if (r.bookingId) {
      const [b] = await db
        .select({
          id: bookings.id,
          bookingCode: bookings.bookingCode,
          userId: bookings.userId,
          flightScheduleId: bookings.flightScheduleId,
        })
        .from(bookings)
        .where(eq(bookings.id, r.bookingId))
        .limit(1)

      if (b) {
        bookingCode = b.bookingCode

        const [p] = await db
          .select({ fullName: bookingPassengers.fullName })
          .from(bookingPassengers)
          .where(eq(bookingPassengers.bookingId, b.id))
          .limit(1)

        if (p?.fullName) {
          passengerName = p.fullName
        } else if (b.userId) {
          const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, b.userId)).limit(1)
          if (u?.name) passengerName = u.name
        }

        if (b.flightScheduleId) {
          const segments = await db
            .select({
              originAirportId: flightSegments.originAirportId,
              destinationAirportId: flightSegments.destinationAirportId,
              departureTime: flightSegments.departureTime,
            })
            .from(flightSegments)
            .where(eq(flightSegments.flightScheduleId, b.flightScheduleId))
            .orderBy(flightSegments.segmentOrder)

          if (segments.length > 0) {
            const firstSeg = segments[0]
            const lastSeg = segments[segments.length - 1]
            departureTime = firstSeg.departureTime.toISOString()

            const [orig] = await db.select({ code: airports.code }).from(airports).where(eq(airports.id, firstSeg.originAirportId!)).limit(1)
            const [dest] = await db.select({ code: airports.code }).from(airports).where(eq(airports.id, lastSeg.destinationAirportId!)).limit(1)
            route = `${orig?.code || '---'} ke ${dest?.code || '---'}`
          }
        }
      }
    }

    result.push({
      id: r.id,
      booking_id: r.bookingId,
      booking_code: bookingCode,
      passenger: passengerName,
      route,
      reason: r.reason,
      refund_amount: Number(r.refundAmount || 0),
      status: r.status,
      kind: r.kind,
      requested_at: r.requestedAt?.toISOString() || null,
      processed_at: r.processedAt?.toISOString() || null,
      departure_time: departureTime,
      is_auto_approved: (r.status === 'approved' || r.status === 'refunded') && !r.processedBy,
    })
  }

  return c.json({
    error: false,
    data: result,
  })
})

// PUT /api/admin/refunds/:id
refundsRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const adminUserId = c.get('userId')

  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID refund tidak valid', code: 'INVALID_ID' }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const { status } = body

  if (!status || !['approved', 'rejected', 'refunded'].includes(status)) {
    return c.json(
      {
        error: true,
        message: 'Status refund harus "approved", "rejected", atau "refunded"',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  try {
    const updated = await refundService.processRefundByAdmin({
      refundId: id,
      adminUserId,
      status: status as 'approved' | 'rejected' | 'refunded',
    })

    return c.json({
      error: false,
      message:
        status === 'rejected'
          ? 'Pengajuan refund berhasil ditolak'
          : 'Pengajuan refund berhasil disetujui',
      data: updated,
    })
  } catch (err: any) {
    if (err && err.status && err.code) {
      return c.json(
        {
          error: true,
          message: err.message,
          code: err.code,
        },
        err.status,
      )
    }

    console.error('[AdminRefundsRoute] Gagal memproses refund:', err)
    return c.json(
      {
        error: true,
        message: 'Gagal memproses pengajuan refund',
        code: 'PROCESS_REFUND_FAILED',
      },
      500,
    )
  }
})

export default refundsRoute
