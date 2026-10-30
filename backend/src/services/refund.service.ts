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
   * Logika Cerdas & Otomatis:
   * 1. Kendala Penerbangan / Dibatalkan (RFD-05): Auto-Approved Instan 100% penuh tanpa potongan.
   * 2. Aturan Cooling-Off 24 Jam: Jika booking <= 24 jam dan jadwal >= 24 jam sebelum terbang -> Auto-Approved Instan.
   * 3. Di luar kondisi di atas: Reguler pending untuk ditinjau admin (minimal H-6 jam sebelum terbang).
   * 4. Transaksi atomik database untuk mencegah race condition / double-refund.
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
        message: 'Pengajuan refund untuk pesanan ini sudah ada atau sedang diproses',
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

    // Hitung usia pesanan sejak dibuat (cooling-off rule 24 jam)
    const bookingCreatedAt = booking.createdAt ? new Date(booking.createdAt).getTime() : now.getTime()
    const bookingAgeHours = (now.getTime() - bookingCreatedAt) / (1000 * 60 * 60)

    let hoursRemaining = 999
    if (firstSeg?.departureTime) {
      const depTime = new Date(firstSeg.departureTime)
      hoursRemaining = (depTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    }

    let shouldAutoApprove = false

    if (isFlightCancelled) {
      // Kondisi 1: Penerbangan dibatalkan maskapai (RFD-05)
      // Tanpa batas H-6 jam, jumlah penuh 100%, alasan otomatis jika kosong
      // Auto-Approved instan oleh sistem
      kind = 'flight_cancelled'
      refundAmount = Number(booking.totalPrice)
      if (!finalReason) {
        finalReason = 'Penerbangan dibatalkan maskapai'
      }
      shouldAutoApprove = true
    } else {
      // Kondisi 2: Refund normal atas permintaan pelanggan (RFD-01 & RFD-02)
      kind = 'customer'

      if (!finalReason || finalReason.length < 5) {
        throw {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Alasan pengajuan refund wajib diisi (minimal 5 karakter)',
        }
      }

      if (hoursRemaining <= 0) {
        throw {
          status: 400,
          code: 'FLIGHT_ALREADY_DEPARTED',
          message: 'Pengajuan refund ditutup karena penerbangan sudah berangkat',
        }
      }

      if (hoursRemaining < 6) {
        throw {
          status: 400,
          code: 'REFUND_WINDOW_CLOSED',
          message: 'Pengajuan refund ditutup. Refund hanya dapat diajukan minimal 6 jam sebelum jadwal keberangkatan',
        }
      }

      // Potongan pembatalan reguler: 20% biaya pembatalan + Rp 25.000 biaya admin
      const cancellationFee = Math.round(refundAmount * 0.2)
      const adminFee = 25000
      refundAmount = Math.max(0, refundAmount - cancellationFee - adminFee)

      // Aturan Cooling-off 24 Jam:
      // Jika pesanan dibuat belum lebih dari 24 jam yang lalu (1 hari)
      // dan jadwal terbang masih aman (>= 24 jam sebelum jam terbang),
      // refund langsung disetujui otomatis oleh sistem tanpa perlu verifikasi manual admin.
      if (bookingAgeHours <= 24 && hoursRemaining >= 24) {
        shouldAutoApprove = true
      }
    }

    // Eksekusi atomik dalam transaksi database untuk menjamin integritas dan mencegah race condition
    const newRefund = await db.transaction(async (tx) => {
      // Re-verifikasi status pesanan di dalam transaksi
      const [freshBooking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, booking.id))
        .limit(1)

      if (!freshBooking || freshBooking.status !== 'paid') {
        throw {
          status: 400,
          code: 'INVALID_BOOKING_STATUS',
          message: 'Status pesanan tidak valid untuk pengajuan refund',
        }
      }

      const txRefunds = await tx
        .select()
        .from(refunds)
        .where(eq(refunds.bookingId, booking.id))

      const hasActive = txRefunds.some(
        (r) => r.status === 'pending' || r.status === 'approved' || r.status === 'refunded',
      )

      if (hasActive) {
        throw {
          status: 400,
          code: 'REFUND_ALREADY_PENDING',
          message: 'Pengajuan refund untuk pesanan ini sudah ada atau sedang diproses',
        }
      }

      const [inserted] = await tx
        .insert(refunds)
        .values({
          bookingId: booking.id,
          reason: finalReason,
          refundAmount: refundAmount.toString(),
          status: shouldAutoApprove ? 'approved' : 'pending',
          kind,
          requestedAt: now,
          processedAt: shouldAutoApprove ? now : null,
          processedBy: null,
        })
        .returning()

      // Jika disetujui otomatis: langsung ubah status booking, lepaskan kursi, dan bersihkan check-in
      if (shouldAutoApprove) {
        // 1. Status booking menjadi 'refunded'
        await tx
          .update(bookings)
          .set({ status: 'refunded' })
          .where(eq(bookings.id, booking.id))

        // 2. Lepaskan kursi penumpang
        const paxRows = await tx
          .select({ id: bookingPassengers.id, seatId: bookingPassengers.seatId })
          .from(bookingPassengers)
          .where(eq(bookingPassengers.bookingId, booking.id))

        const seatIds = paxRows
          .map((p) => p.seatId)
          .filter((id): id is number => typeof id === 'number')

        if (seatIds.length > 0) {
          await tx
            .update(seats)
            .set({ isAvailable: true })
            .where(inArray(seats.id, seatIds))
        }

        // 3. Batalkan check-in jika penumpang sudah pernah check-in
        const paxIds = paxRows.map((p) => p.id)
        if (paxIds.length > 0) {
          await tx.delete(checkIns).where(inArray(checkIns.bookingPassengerId, paxIds))
        }
      }

      return inserted
    })

    return {
      id: newRefund.id,
      booking_id: newRefund.bookingId,
      status: newRefund.status,
      kind: newRefund.kind,
      reason: newRefund.reason,
      refund_amount: Number(newRefund.refundAmount),
      requested_at: newRefund.requestedAt?.toISOString() || now.toISOString(),
      processed_at: newRefund.processedAt?.toISOString() || null,
      is_auto_approved: shouldAutoApprove,
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
        is_auto_approved: (r.status === 'approved' || r.status === 'refunded') && !r.processedBy,
      })
    }

    return results
  }

  /**
   * Memproses persetujuan / penolakan refund oleh Admin (PUT /api/admin/refunds/:id)
   * Jika disetujui (approved / refunded), status booking menjadi 'refunded' dan kursi dilepaskan.
   * Dilengkapi proteksi keamanan: refund yang sudah disetujui tidak bisa ditolak untuk mencegah inkonsistensi inventaris.
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

    if (refundItem.status === 'approved' || refundItem.status === 'refunded') {
      if (status === 'rejected') {
        throw {
          status: 400,
          code: 'ALREADY_APPROVED',
          message: 'Permintaan refund yang sudah disetujui tidak dapat ditolak karena kursi telah dilepaskan',
        }
      }

      // Idempotent: jika sudah disetujui atau auto-approved, pastikan processedBy tercatat jika belum ada
      if (!refundItem.processedBy) {
        await db
          .update(refunds)
          .set({ processedBy: adminUserId })
          .where(eq(refunds.id, refundId))
      }

      return {
        id: refundItem.id,
        booking_id: refundItem.bookingId,
        reason: refundItem.reason,
        refund_amount: Number(refundItem.refundAmount),
        status: refundItem.status,
        kind: refundItem.kind,
        processed_by: refundItem.processedBy || adminUserId,
        requested_at: refundItem.requestedAt?.toISOString() || null,
        processed_at: refundItem.processedAt?.toISOString() || null,
        is_auto_approved: !refundItem.processedBy,
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

