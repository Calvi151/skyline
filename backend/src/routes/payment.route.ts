import { Hono } from 'hono'
import { eq, inArray, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import {
  bookings,
  payments,
  flightSchedules,
  bookingPassengers,
  seats,
  users,
  baggageOptions,
  airlines,
} from '../db/schema.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
import { midtransService } from '../services/midtrans.service.js'
import type { UserContext } from '../types/index.js'

const paymentRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

const createPaymentSchema = z.object({
  booking_id: z.coerce.number().int().positive('ID pesanan wajib diisi'),
})

/**
 * POST /api/payment/create (atau /api/payments/create)
 * Menghasilkan token Snap & redirect_url dari Midtrans (PAY-01)
 */
paymentRoute.post('/create', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const userContext = c.get('user')
  const body = await c.req.json().catch(() => ({}))

  const parsed = createPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { booking_id } = parsed.data

  // 1. Ambil data booking
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking_id))
    .limit(1)

  if (!booking) {
    return c.json(
      {
        error: true,
        message: 'Pesanan tidak ditemukan',
        code: 'BOOKING_NOT_FOUND',
      },
      404,
    )
  }

  // Cek kepemilikan booking
  if (booking.userId !== userId && userContext?.role !== 'admin' && userContext?.role !== 'staff') {
    return c.json(
      {
        error: true,
        message: 'Anda tidak memiliki akses ke pesanan ini',
        code: 'FORBIDDEN',
      },
      403,
    )
  }

  // Cek status booking
  if (booking.status === 'paid') {
    return c.json(
      {
        error: true,
        message: 'Pesanan ini sudah dibayar sebelumnya',
        code: 'BOOKING_ALREADY_PAID',
      },
      400,
    )
  }

  if (booking.status === 'cancelled') {
    return c.json(
      {
        error: true,
        message: 'Pesanan ini telah dibatalkan',
        code: 'BOOKING_CANCELLED',
      },
      400,
    )
  }

  // Cek status penerbangan terkait
  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, booking.flightScheduleId!))
    .limit(1)

  if (schedule?.status === 'cancelled') {
    return c.json(
      {
        error: true,
        message: 'Penerbangan ini telah dibatalkan oleh maskapai',
        code: 'FLIGHT_CANCELLED',
      },
      409,
    )
  }

  // Ambil data user pembeli
  const [customerUser] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, booking.userId!))
    .limit(1)

  // Ambil data penumpang & kursi untuk item details
  const passengers = await db
    .select({
      fullName: bookingPassengers.fullName,
      seatClass: bookingPassengers.seatClass,
      seatNumber: seats.seatNumber,
      baggagePrice: baggageOptions.price,
      baggageWeight: baggageOptions.weightKg,
    })
    .from(bookingPassengers)
    .leftJoin(seats, eq(bookingPassengers.seatId, seats.id))
    .leftJoin(baggageOptions, eq(bookingPassengers.baggageOptionId, baggageOptions.id))
    .where(eq(bookingPassengers.bookingId, booking.id))

  // Siapkan item details Midtrans
  const itemDetails: Array<{ id: string; price: number; quantity: number; name: string }> = []

  const ticketPrice = passengers[0]?.seatClass === 'business'
    ? Number(schedule?.priceBusiness || schedule?.priceEconomy || 0)
    : Number(schedule?.priceEconomy || 0)

  passengers.forEach((p, idx) => {
    itemDetails.push({
      id: `TKT-${booking.id}-${idx + 1}`,
      name: `Tiket ${schedule?.flightNumber || 'Flight'} (${p.seatNumber || p.seatClass})`.substring(0, 50),
      price: ticketPrice,
      quantity: 1,
    })

    if (p.baggagePrice && Number(p.baggagePrice) > 0) {
      itemDetails.push({
        id: `BAG-${booking.id}-${idx + 1}`,
        name: `Bagasi Tambahan ${p.baggageWeight}kg`.substring(0, 50),
        price: Number(p.baggagePrice),
        quantity: 1,
      })
    }
  })

  // Pastikan total item details sama persis dengan booking.totalPrice
  const itemsSum = itemDetails.reduce((acc, it) => acc + it.price * it.quantity, 0)
  const bookingTotal = Math.round(Number(booking.totalPrice))

  // Jika ada selisih pembulatan, sesuaikan item details agar Midtrans menerima
  if (itemsSum !== bookingTotal && itemDetails.length > 0) {
    const diff = bookingTotal - itemsSum
    itemDetails[0].price += diff
  }

  const orderId = `${booking.bookingCode}-${Date.now()}`

  try {
    const snapResult = await midtransService.createTransaction({
      orderId,
      grossAmount: bookingTotal,
      customerDetails: {
        first_name: customerUser?.name || 'Customer',
        email: customerUser?.email,
        phone: customerUser?.phone || undefined,
      },
      itemDetails: itemDetails.length > 0 ? itemDetails : undefined,
      callbacks: {
        finish: `${process.env.APP_URL || 'http://localhost:5173'}/bookings/${booking.id}?status=finish`,
      },
    })

    // Simpan atau perbarui record payment dengan status pending
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, booking.id))
      .orderBy(desc(payments.id))
      .limit(1)

    if (existingPayment) {
      await db
        .update(payments)
        .set({
          transactionId: orderId,
          amount: booking.totalPrice,
          paymentStatus: 'pending',
        })
        .where(eq(payments.id, existingPayment.id))
    } else {
      await db.insert(payments).values({
        bookingId: booking.id,
        transactionId: orderId,
        amount: booking.totalPrice,
        paymentStatus: 'pending',
      })
    }

    return c.json({
      error: false,
      data: {
        token: snapResult.token,
        redirect_url: snapResult.redirect_url,
        order_id: snapResult.order_id,
        booking_code: booking.bookingCode,
        amount: bookingTotal,
      },
    })
  } catch (err: any) {
    console.error('[PaymentRoute] Gagal membuat transaksi Midtrans:', err)
    return c.json(
      {
        error: true,
        message: err.message || 'Gagal memproses transaksi ke payment gateway',
        code: 'PAYMENT_GATEWAY_ERROR',
      },
      500,
    )
  }
})

/**
 * POST /api/payment/notification (atau /api/payments/notification)
 * Webhook notification handler dari Midtrans (PAY-02, PAY-03)
 * Publik tanpa JWT auth middleware, divalidasi via signature_key
 */
paymentRoute.post('/notification', async (c) => {
  const payload = await c.req.json().catch(() => ({}))

  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    payment_type,
    transaction_id,
  } = payload

  if (!order_id || !status_code || !gross_amount) {
    return c.json({ error: true, message: 'Payload notifikasi tidak lengkap' }, 400)
  }

  // 1. Verifikasi Signature Key (jika signature_key disediakan)
  if (signature_key) {
    const isValid = midtransService.verifySignature(order_id, status_code, gross_amount, signature_key)
    if (!isValid) {
      console.warn('[PaymentNotification] Signature key tidak valid untuk order_id:', order_id)
      return c.json({ error: true, message: 'Invalid signature key' }, 400)
    }
  }

  // 2. Cari booking berdasarkan order_id (PNR bookingCode berada di awal order_id)
  const bookingCode = midtransService.parseBookingCodeFromOrderId(order_id)

  let [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingCode, bookingCode))
    .limit(1)

  // Jika tidak ketemu via bookingCode, coba cari via transactionId di payments
  if (!booking) {
    const [matchedPayment] = await db
      .select({ bookingId: payments.bookingId })
      .from(payments)
      .where(eq(payments.transactionId, order_id))
      .limit(1)

    if (matchedPayment?.bookingId) {
      const [foundBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, matchedPayment.bookingId))
        .limit(1)
      booking = foundBooking
    }
  }

  if (!booking) {
    console.warn('[PaymentNotification] Booking tidak ditemukan untuk order_id:', order_id)
    return c.json({ error: true, message: 'Booking not found' }, 404)
  }

  const now = new Date()
  let newBookingStatus: 'pending' | 'paid' | 'cancelled' | 'refunded' = booking.status || 'pending'
  let newPaymentStatus: 'pending' | 'success' | 'failed' = 'pending'
  let isPaidSuccess = false
  let shouldReleaseSeats = false

  // 3. Mapping status Midtrans (PAY-03)
  if (transaction_status === 'capture') {
    if (fraud_status === 'challenge') {
      newPaymentStatus = 'pending'
    } else if (fraud_status === 'accept') {
      newPaymentStatus = 'success'
      newBookingStatus = 'paid'
      isPaidSuccess = true
    }
  } else if (transaction_status === 'settlement') {
    newPaymentStatus = 'success'
    newBookingStatus = 'paid'
    isPaidSuccess = true
  } else if (
    transaction_status === 'cancel' ||
    transaction_status === 'deny' ||
    transaction_status === 'expire'
  ) {
    newPaymentStatus = 'failed'
    newBookingStatus = 'cancelled'
    shouldReleaseSeats = true
  } else if (transaction_status === 'pending') {
    newPaymentStatus = 'pending'
  }

  try {
    await db.transaction(async (tx) => {
      // Update status booking
      await tx
        .update(bookings)
        .set({ status: newBookingStatus })
        .where(eq(bookings.id, booking.id))

      // Update / insert pembayaran
      const [existingPayment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.bookingId, booking.id))
        .orderBy(desc(payments.id))
        .limit(1)

      if (existingPayment) {
        await tx
          .update(payments)
          .set({
            transactionId: transaction_id || order_id,
            paymentMethod: payment_type || existingPayment.paymentMethod,
            amount: gross_amount ? gross_amount.toString() : existingPayment.amount,
            paymentStatus: newPaymentStatus,
            paidAt: isPaidSuccess ? now : existingPayment.paidAt,
          })
          .where(eq(payments.id, existingPayment.id))
      } else {
        await tx.insert(payments).values({
          bookingId: booking.id,
          transactionId: transaction_id || order_id,
          paymentMethod: payment_type || 'midtrans',
          amount: gross_amount ? gross_amount.toString() : booking.totalPrice,
          paymentStatus: newPaymentStatus,
          paidAt: isPaidSuccess ? now : null,
        })
      }

      // Jika transaksi dibatalkan / gagal / kedaluwarsa, lepaskan kursi kembali!
      if (shouldReleaseSeats) {
        const passRows = await tx
          .select({ seatId: bookingPassengers.seatId })
          .from(bookingPassengers)
          .where(eq(bookingPassengers.bookingId, booking.id))

        const seatIds = passRows
          .map((p) => p.seatId)
          .filter((id): id is number => typeof id === 'number')

        if (seatIds.length > 0) {
          await tx
            .update(seats)
            .set({ isAvailable: true })
            .where(inArray(seats.id, seatIds))
        }
      }
    })

    console.log(
      `[PaymentNotification] Berhasil update booking ${booking.bookingCode}: status=${newBookingStatus}, paymentStatus=${newPaymentStatus}`,
    )

    return c.json({
      status: 'OK',
      message: 'Notification processed',
      data: {
        booking_code: booking.bookingCode,
        status: newBookingStatus,
        payment_status: newPaymentStatus,
      },
    })
  } catch (err: any) {
    console.error('[PaymentNotification] Gagal menyimpan notifikasi:', err)
    return c.json({ error: true, message: 'Gagal memproses notifikasi' }, 500)
  }
})

/**
 * POST /api/payment/simulate (atau /api/payments/simulate)
 * Simulasi pembayaran berhasil untuk booking pending (utility untuk dev/demo)
 */
paymentRoute.post('/simulate', optionalAuthMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))

  const schema = z.object({
    booking_id: z.coerce.number().int().positive(),
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
      booking_code: booking.bookingCode,
      status: 'paid',
      payment: newPayment,
    },
  })
})

export default paymentRoute
