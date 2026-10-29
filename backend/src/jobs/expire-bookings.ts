import { eq, and, lt, inArray } from 'drizzle-orm'
import cron from 'node-cron'
import { db } from '../db/index.js'
import { bookings, bookingPassengers, seats, payments } from '../db/schema.js'

export interface ExpireResult {
  expiredCount: number
  seatsReleased: number
  cancelledBookingCodes: string[]
}

/**
 * Job otomatis membatalkan pemesanan pending yang melewati batas waktu 1 jam (PAY-04),
 * dan melepaskan kursi yang terkunci agar dapat dipesan kembali oleh pengguna lain.
 */
export async function autoCancelPendingBookingsJob(): Promise<ExpireResult> {
  const result: ExpireResult = {
    expiredCount: 0,
    seatsReleased: 0,
    cancelledBookingCodes: [],
  }

  // Waktu cutoff: 1 jam yang lalu
  const cutoffTime = new Date(Date.now() - 60 * 60 * 1000)

  try {
    // 1. Cari booking yang masih pending dan dibuat sebelum cutoffTime
    const expiredBookings = await db
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
      })
      .from(bookings)
      .where(and(eq(bookings.status, 'pending'), lt(bookings.createdAt, cutoffTime)))

    if (expiredBookings.length === 0) {
      return result
    }

    const bookingIds = expiredBookings.map((b) => b.id)
    result.cancelledBookingCodes = expiredBookings.map((b) => b.bookingCode)

    await db.transaction(async (tx) => {
      // 2. Ambil semua seat_id penumpang dari booking tersebut
      const passengers = await tx
        .select({
          seatId: bookingPassengers.seatId,
        })
        .from(bookingPassengers)
        .where(inArray(bookingPassengers.bookingId, bookingIds))

      const seatIds = passengers
        .map((p) => p.seatId)
        .filter((id): id is number => typeof id === 'number')

      // 3. Batalkan status booking -> 'cancelled'
      await tx
        .update(bookings)
        .set({ status: 'cancelled' })
        .where(inArray(bookings.id, bookingIds))

      // 4. Lepaskan kursi: set is_available = true
      if (seatIds.length > 0) {
        await tx
          .update(seats)
          .set({ isAvailable: true })
          .where(inArray(seats.id, seatIds))

        result.seatsReleased = seatIds.length
      }

      // 5. Update status payment terkait jika masih pending -> failed
      await tx
        .update(payments)
        .set({ paymentStatus: 'failed' })
        .where(and(inArray(payments.bookingId, bookingIds), eq(payments.paymentStatus, 'pending')))
    })

    result.expiredCount = bookingIds.length
    console.log(
      `[AutoCancelBookings] Dibatalkan ${result.expiredCount} booking kedaluwarsa, ${result.seatsReleased} kursi dilepaskan:`,
      result.cancelledBookingCodes,
    )
  } catch (err) {
    console.error('[AutoCancelBookings] Gagal memproses pembatalan booking kedaluwarsa:', err)
  }

  return result
}

/**
 * Menjalankan scheduler cron setiap 15 menit untuk membatalkan booking pending > 1 jam
 */
export function startExpireBookingsCron(): cron.ScheduledTask {
  console.log('[Cron] Scheduler auto-cancel pending bookings diaktifkan (berjalan setiap 15 menit).')
  return cron.schedule('*/15 * * * *', async () => {
    try {
      await autoCancelPendingBookingsJob()
    } catch (err) {
      console.error('[Cron] Error running autoCancelPendingBookingsJob:', err)
    }
  })
}

