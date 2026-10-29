import { Hono } from 'hono'
import { eq, desc, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  refunds,
  bookings,
  flightSchedules,
  flightSegments,
} from '../../db/schema.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const customerRefundsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

customerRefundsRoute.use('*', authMiddleware)

const requestRefundSchema = z.object({
  booking_id: z.coerce.number().int().positive('ID pesanan wajib diisi'),
  reason: z.string().min(10, 'Alasan pembatalan minimal 10 karakter').max(300, 'Alasan maksimal 300 karakter'),
  passenger_ids: z.array(z.number().int()).optional(),
})

/**
 * GET /api/refunds/booking/:bookingId
 * Ambil status refund untuk pesanan tertentu
 */
customerRefundsRoute.get('/booking/:bookingId', async (c) => {
  const userId = c.get('userId')
  const userRole = c.get('user')?.role
  const bookingId = Number(c.req.param('bookingId'))

  if (isNaN(bookingId)) {
    return c.json({ error: true, message: 'ID booking tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)

  if (!booking) {
    return c.json({ error: true, message: 'Pesanan tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  if (booking.userId !== userId && userRole !== 'admin' && userRole !== 'staff') {
    return c.json({ error: true, message: 'Akses ditolak', code: 'FORBIDDEN' }, 403)
  }

  const [refundItem] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.bookingId, bookingId))
    .orderBy(desc(refunds.requestedAt))
    .limit(1)

  return c.json({
    error: false,
    data: refundItem
      ? {
          id: refundItem.id,
          booking_id: refundItem.bookingId,
          reason: refundItem.reason,
          refund_amount: Number(refundItem.refundAmount),
          status: refundItem.status,
          kind: refundItem.kind,
          requested_at: refundItem.requestedAt?.toISOString(),
          processed_at: refundItem.processedAt?.toISOString() || null,
        }
      : null,
  })
})

/**
 * POST /api/refunds
 * Ajukan refund untuk pesanan yang sudah dibayar (atau penerbangan dibatalkan)
 */
customerRefundsRoute.post('/', async (c) => {
  const userId = c.get('userId')
  const userRole = c.get('user')?.role
  const body = await c.req.json().catch(() => ({}))

  const parsed = requestRefundSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data pengajuan refund tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { booking_id, reason } = parsed.data

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking_id))
    .limit(1)

  if (!booking) {
    return c.json({ error: true, message: 'Pesanan tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  if (booking.userId !== userId && userRole !== 'admin' && userRole !== 'staff') {
    return c.json({ error: true, message: 'Anda tidak memiliki hak akses untuk pesanan ini', code: 'FORBIDDEN' }, 403)
  }

  // Cek apakah sudah ada refund pending atau approved
  const [existingRefund] = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.bookingId, booking.id), eq(refunds.status, 'pending')))
    .limit(1)

  if (existingRefund) {
    return c.json(
      {
        error: true,
        message: 'Pengajuan refund untuk pesanan ini sedang diproses oleh admin',
        code: 'REFUND_ALREADY_PENDING',
      },
      400,
    )
  }

  // Cek status jadwal penerbangan
  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, booking.flightScheduleId!))
    .limit(1)

  const isFlightCancelled = schedule?.status === 'cancelled'

  // Jika bukan dibatalkan maskapai, pesanan harus berstatus 'paid'
  if (!isFlightCancelled && booking.status !== 'paid') {
    return c.json(
      {
        error: true,
        message: 'Hanya tiket berstatus lunas yang dapat diajukan refund',
        code: 'BOOKING_NOT_PAID',
      },
      400,
    )
  }

  // Cek aturan batas waktu: 6 jam sebelum keberangkatan (kecuali penerbangan dibatalkan maskapai)
  const [firstSeg] = await db
    .select()
    .from(flightSegments)
    .where(eq(flightSegments.flightScheduleId, booking.flightScheduleId!))
    .orderBy(flightSegments.segmentOrder)
    .limit(1)

  const now = new Date()
  let kind: 'customer' | 'flight_cancelled' = 'customer'
  let refundAmount = Number(booking.totalPrice)

  if (isFlightCancelled) {
    kind = 'flight_cancelled'
    // Refund penuh 100% tanpa potongan
    refundAmount = Number(booking.totalPrice)
  } else {
    kind = 'customer'
    if (firstSeg?.departureTime) {
      const depTime = new Date(firstSeg.departureTime)
      const hoursRemaining = (depTime.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursRemaining < 6) {
        return c.json(
          {
            error: true,
            message: 'Batas waktu pengajuan refund maksimal 6 jam sebelum keberangkatan',
            code: 'REFUND_TIME_LIMIT_EXCEEDED',
          },
          400,
        )
      }

      // Potongan pembatalan mandiri: 20% biaya maskapai + Rp 25.000 administrasi
      const cancellationFee = Math.round(refundAmount * 0.2)
      const adminFee = 25000
      refundAmount = Math.max(0, refundAmount - cancellationFee - adminFee)
    }
  }

  const [newRefund] = await db
    .insert(refunds)
    .values({
      bookingId: booking.id,
      reason,
      refundAmount: refundAmount.toString(),
      status: 'pending',
      kind,
      requestedAt: now,
    })
    .returning()

  return c.json({
    error: false,
    message: isFlightCancelled
      ? 'Pengajuan refund penuh berhasil dikirim karena penerbangan dibatalkan.'
      : 'Pengajuan refund berhasil dikirim dan sedang ditinjau.',
    data: {
      id: newRefund.id,
      booking_id: newRefund.bookingId,
      refund_amount: Number(newRefund.refundAmount),
      status: newRefund.status,
      kind: newRefund.kind,
      requested_at: newRefund.requestedAt?.toISOString(),
    },
  })
})

export default customerRefundsRoute

