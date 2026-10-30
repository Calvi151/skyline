import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { refunds, bookings } from '../../db/schema.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { refundService } from '../../services/refund.service.js'
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
  reason: z.string().max(300, 'Alasan maksimal 300 karakter').optional().default(''),
  passenger_ids: z.array(z.number().int()).optional(),
})

/**
 * GET /api/refunds/my
 * Ambil daftar semua pengajuan refund milik user yang sedang login (API_SPEC.md)
 */
customerRefundsRoute.get('/my', async (c) => {
  const userId = c.get('userId')
  const data = await refundService.getCustomerRefunds(userId)

  return c.json({
    error: false,
    data,
  })
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
 * Ajukan refund untuk pesanan yang sudah dibayar (RFD-01, RFD-02)
 * atau penerbangan yang dibatalkan maskapai (RFD-05: tanpa batas H-6, penuh 100%, alasan otomatis)
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

  try {
    const result = await refundService.createRefundRequest({
      userId,
      userRole,
      bookingId: booking_id,
      reason,
    })

    return c.json({
      error: false,
      message:
        result.kind === 'flight_cancelled'
          ? 'Pengajuan refund penuh berhasil dikirim karena penerbangan dibatalkan.'
          : 'Pengajuan refund berhasil dikirim dan sedang ditinjau.',
      data: result,
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

    console.error('[CustomerRefundsRoute] Gagal mengajukan refund:', err)
    return c.json(
      {
        error: true,
        message: 'Gagal memproses pengajuan refund',
        code: 'REFUND_REQUEST_FAILED',
      },
      500,
    )
  }
})

export default customerRefundsRoute
