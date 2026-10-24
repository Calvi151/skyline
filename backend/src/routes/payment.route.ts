import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { bookings, payments } from '../db/schema.js'
import { optionalAuthMiddleware } from '../middleware/auth.middleware.js'

const paymentRoute = new Hono()

/**
 * POST /api/payments/simulate
 * Simulasi pembayaran berhasil untuk booking pending
 */
paymentRoute.post('/simulate', optionalAuthMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))

  const schema = z.object({
    booking_id: z.number().int().positive(),
    payment_method: z.string().default('bca_va'),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: true, message: 'Data pembayaran tidak valid' }, 400)
  }

  const { booking_id, payment_method } = parsed.data

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking_id))
    .limit(1)

  if (!booking) {
    return c.json({ error: true, message: 'Pesanan tidak ditemukan' }, 404)
  }

  const now = new Date()

  // Update booking status ke paid
  await db
    .update(bookings)
    .set({ status: 'paid' })
    .where(eq(bookings.id, booking_id))

  // Catat transaksi pembayaran
  const [newPayment] = await db
    .insert(payments)
    .values({
      bookingId: booking.id,
      transactionId: `TRX-${Date.now()}`,
      paymentMethod: payment_method,
      amount: booking.totalPrice,
      paymentStatus: 'success',
      paidAt: now,
    })
    .returning()

  return c.json({
    error: false,
    message: 'Pembayaran berhasil diproses!',
    data: {
      booking_id: booking.id,
      status: 'paid',
      payment: newPayment,
    },
  })
})

export default paymentRoute
