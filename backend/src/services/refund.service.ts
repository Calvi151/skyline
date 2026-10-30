import { eq, desc, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  refunds,
  bookings,
  bookingPassengers,
  seats,
  checkIns,
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  users,
} from '../db/schema.js'

export interface CreateRefundParams {
  userId: number
  userRole?: string
  bookingId: number
  reason?: string
}

export class RefundService {
  /**
   * Mengajukan permintaan refund (Customer - POST /api/refunds)
   * Mendukung refund reguler (RFD-01, RFD-02: batas H-6 jam) dan
   * refund penerbangan dibatalkan (RFD-05: tanpa batas H-6 jam, jumlah penuh 100%, alasan otomatis).
   */
  async createRefundRequest(params: CreateRefundParams) {
    const { userId, userRole, bookingId, reason } = params

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Pesanan tidak ditemukan' }
    }

    if (booking.userId !== userId && userRole !== 'admin' && userRole !== 'staff') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Anda tidak memiliki hak akses untuk pesanan ini',
      }
    }

    // Cek apakah sudah ada pengajuan refund yang masih pending atau sudah disetujui
    const existingRefunds = await db
      .select()
      .from(refunds)
      .where(eq(refunds.bookingId, booking.id))

    const activeRefund = existingRefunds.find(
      (r) => r.status === 'pending' || r.status === 'approved' || r.status === 'refunded',
    )

    if (activeRefund) {
      throw {
        status: 400,
        code: 'REFUND_ALREADY_PENDING',
        message: 'Pengajuan refund untuk pesanan ini sudah ada atau sedang diproses oleh admin',
      }
    }

    // Ambil jadwal penerbangan
    const [schedule] = await db
      .select()
      .from(flightSchedules)
      .where(eq(flightSchedules.id, booking.flightScheduleId!))
      .limit(1)

    if (!schedule) {
      throw { status: 404, code: 'SCHEDULE_NOT_FOUND', message: 'Jadwal penerbangan tidak ditemukan' }
    }

    const isFlightCancelled = schedule.status === 'cancelled'

    // Pesanan harus berstatus 'paid'
    if (booking.status !== 'paid') {
      throw {
        status: 400,
        code: 'BOOKING_NOT_PAID',
        message: 'Hanya pesanan yang sudah dibayar (status paid) yang dapat diajukan refund',
      }
    }

    // Ambil segmen pertama untuk cek waktu keberangkatan
    const [firstSeg] = await db
      .select()
      .from(flightSegments)
      .where(eq(flightSegments.flightScheduleId, schedule.id))
      .orderBy(flightSegments.segmentOrder)
      .limit(1)

    const now = new Date()
    let kind: 'customer' | 'flight_cancelled' = 'customer'
    let refundAmount = Number(booking.totalPrice)
    let finalReason = reason?.trim() || ''

    if (isFlightCancelled) {
      // RFD-05: Penerbangan dibatalkan maskapai
      // Tanpa batas H-6 jam, jumlah penuh 100%, alasan otomatis jika kosong
      kind = 'flight_cancelled'
      refundAmount = Number(booking.totalPrice)
      if (!finalReason) {
        finalReason = 'Penerbangan dibatalkan maskapai'
      }
    } else {
      // RFD-01 & RFD-02: Refund normal atas permintaan pelanggan
      kind = 'customer'

      if (!finalReason || finalReason.length < 5) {
        throw {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Alasan pengajuan refund wajib diisi (minimal 5 karakter)',
        }
      }

      if (firstSeg?.departureTime) {
        const depTime = new Date(firstSeg.departureTime)
        const hoursRemaining = (depTime.getTime() - now.getTime()) / (1000 * 60 * 60)

        if (hoursRemaining < 6) {
          throw {
            status: 400,
            code: 'REFUND_WINDOW_CLOSED',
            message: 'Pengajuan refund ditutup. Refund hanya dapat diajukan minimal 6 jam sebelum jadwal keberangkatan',
          }
        }
      }

      // Potongan pembatalan reguler: 20% biaya pembatalan + Rp 25.000 biaya admin
      const cancellationFee = Math.round(refundAmount * 0.2)
      const adminFee = 25000
      refundAmount = Math.max(0, refundAmount - cancellationFee - adminFee)
    }

    const [newRefund] = await db
      .insert(refunds)
      .values({
        bookingId: booking.id,
        reason: finalReason,
        refundAmount: refundAmount.toString(),
        status: 'pending',
        kind,
        requestedAt: now,
      })
      .returning()

    return {
      id: newRefund.id,
      booking_id: newRefund.bookingId,
      status: newRefund.status,
      kind: newRefund.kind,
      reason: newRefund.reason,
      refund_amount: Number(newRefund.refundAmount),
      requested_at: newRefund.requestedAt?.toISOString() || now.toISOString(),
    }
  }

  /**
   * Ambil daftar refund milik customer yang sedang login (GET /api/refunds/my)
   */
  async getCustomerRefunds(userId: number) {
    const userBookings = await db
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        totalPrice: bookings.totalPrice,
        flightScheduleId: bookings.flightScheduleId,
      })
      .from(bookings)
      .where(eq(bookings.userId, userId))

    if (userBookings.length === 0) {
      return []
    }

    const bookingIds = userBookings.map((b) => b.id)
    const bookingMap = new Map(userBookings.map((b) => [b.id, b]))

    const userRefunds = await db
      .select()
      .from(refunds)
      .where(inArray(refunds.bookingId, bookingIds))
      .orderBy(desc(refunds.requestedAt))

    if (userRefunds.length === 0) {
      return []
    }

    const allAirports = await db.select().from(airports)
    const airportMap = new Map(allAirports.map((a) => [a.id, a]))

    const results = []
    for (const r of userRefunds) {
      const b = r.bookingId ? bookingMap.get(r.bookingId) : null
      let flightNumber: string | null = null
      let route: string | null = null
      let departureTime: string | null = null

      if (b?.flightScheduleId) {
        const [sched] = await db
          .select({ flightNumber: flightSchedules.flightNumber })
          .from(flightSchedules)
          .where(eq(flightSchedules.id, b.flightScheduleId))
          .limit(1)
        flightNumber = sched?.flightNumber || null

        const segs = await db
          .select()
          .from(flightSegments)
          .where(eq(flightSegments.flightScheduleId, b.flightScheduleId))
          .orderBy(flightSegments.segmentOrder)

        if (segs.length > 0) {
          const orig = airportMap.get(segs[0].originAirportId!)
          const dest = airportMap.get(segs[segs.length - 1].destinationAirportId!)
          route = `${orig?.code || '---'}-${dest?.code || '---'}`
          departureTime = segs[0].departureTime.toISOString()
        }
      }

      results.push({
        id: r.id,
        booking_id: r.bookingId,
        booking_code: b?.bookingCode || null,
        flight_number: flightNumber,
        route,
        departure_time: departureTime,
        reason: r.reason,
        refund_amount: Number(r.refundAmount),
        status: r.status,
        kind: r.kind,
        requested_at: r.requestedAt?.toISOString() || null,
        processed_at: r.processedAt?.toISOString() || null,
      })
    }

    return results
  }

  /**
   * Memproses persetujuan / penolakan refund oleh Admin (PUT /api/admin/refunds/:id)
   * Jika disetujui (approved / refunded), status booking menjadi 'refunded' dan kursi dilepaskan.
   */
  async processRefundByAdmin(params: {
    refundId: number
    adminUserId: number
    status: 'approved' | 'rejected' | 'refunded'
  }) {
    const { refundId, adminUserId, status } = params

    const [refundItem] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1)

    if (!refundItem) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Permintaan refund tidak ditemukan' }
    }

    if (refundItem.status === 'rejected') {
      throw {
        status: 400,
        code: 'ALREADY_PROCESSED',
        message: 'Permintaan refund yang sudah ditolak tidak dapat diubah kembali',
      }
    }

    const now = new Date()

    const updated = await db.transaction(async (tx) => {
      const [upd] = await tx
        .update(refunds)
        .set({
          status,
          processedBy: adminUserId,
          processedAt: now,
        })
        .where(eq(refunds.id, refundId))
        .returning()

      if ((status === 'approved' || status === 'refunded') && refundItem.bookingId) {
        // 1. Update status booking menjadi 'refunded'
        await tx
          .update(bookings)
          .set({ status: 'refunded' })
          .where(eq(bookings.id, refundItem.bookingId))

        // 2. Ambil penumpang dari booking ini untuk melepaskan kursi
        const paxRows = await tx
          .select({ id: bookingPassengers.id, seatId: bookingPassengers.seatId })
          .from(bookingPassengers)
          .where(eq(bookingPassengers.bookingId, refundItem.bookingId))

        const seatIds = paxRows
          .map((p) => p.seatId)
          .filter((id): id is number => typeof id === 'number')

        if (seatIds.length > 0) {
          await tx
            .update(seats)
            .set({ isAvailable: true })
            .where(inArray(seats.id, seatIds))
        }

        // 3. Hapus check-in jika penumpang sempat check-in sebelumnya
        const paxIds = paxRows.map((p) => p.id)
        if (paxIds.length > 0) {
          await tx.delete(checkIns).where(inArray(checkIns.bookingPassengerId, paxIds))
        }
      }

      return upd
    })

    return {
      id: updated.id,
      booking_id: updated.bookingId,
      reason: updated.reason,
      refund_amount: Number(updated.refundAmount),
      status: updated.status,
      kind: updated.kind,
      processed_by: updated.processedBy,
      requested_at: updated.requestedAt?.toISOString() || null,
      processed_at: updated.processedAt?.toISOString() || now.toISOString(),
    }
  }
}

export const refundService = new RefundService()

