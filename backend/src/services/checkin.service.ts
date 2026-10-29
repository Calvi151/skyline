import { eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  bookings,
  bookingPassengers,
  seats,
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  checkIns,
} from '../db/schema.js'
import { qrcodeService } from './qrcode.service.js'

export interface CheckInResult {
  booking_passenger_id: number
  passenger_name: string
  seat_number: string
  boarding_pass_code: string
  qr_code_url: string
  gate: string
  boarding_time: string
  checked_in_at: string
}

export class CheckinService {
  /**
   * Validasi jendela waktu check-in (H-24 jam sebelum keberangkatan asli).
   * Penerbangan tertunda tetap bisa check-in; waktu H-24 dihitung dari jadwal asli (ETK-04).
   */
  validateCheckInWindow(
    scheduledDepartureTime: Date,
    delayMinutes = 0,
    mockCurrentTime?: Date,
  ): {
    isOpen: boolean
    code?: string
    message?: string
    openAt?: Date
  } {
    const now = mockCurrentTime || new Date()
    const openTime = new Date(scheduledDepartureTime.getTime() - 24 * 60 * 60 * 1000)
    const actualDeparture = new Date(
      scheduledDepartureTime.getTime() + delayMinutes * 60 * 1000,
    )

    if (now < openTime) {
      return {
        isOpen: false,
        code: 'CHECKIN_NOT_OPEN',
        message: 'Check-in online baru dibuka H-24 jam sebelum jadwal keberangkatan',
        openAt: openTime,
      }
    }

    if (now > actualDeparture) {
      return {
        isOpen: false,
        code: 'FLIGHT_ALREADY_DEPARTED',
        message: 'Penerbangan telah berangkat, check-in online sudah ditutup',
      }
    }

    return { isOpen: true }
  }

  /**
   * Menghitung jam boarding pesawat.
   * Waktu boarding = keberangkatan (termasuk keterlambatan) dikurangi 30 menit.
   */
  calculateBoardingTime(scheduledDepartureTime: Date, delayMinutes = 0): string {
    const actualDepartureTime = new Date(
      scheduledDepartureTime.getTime() + delayMinutes * 60 * 1000,
    )
    const boardingTime = new Date(actualDepartureTime.getTime() - 30 * 60 * 1000)

    return (
      boardingTime.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' WIB'
    )
  }

  /**
   * Menghasilkan kode unik boarding pass
   */
  generateBoardingPassCode(pnr: string, passengerId: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let rand = ''
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `BP-${pnr}-${passengerId}-${rand}`
  }

  /**
   * Memproses check-in untuk satu penumpang (POST /api/check-in/:bookingId)
   */
  async processCheckIn(params: {
    bookingId: number
    passengerId: number
    seatId?: number
    mockCurrentTime?: Date
  }): Promise<CheckInResult> {
    const { bookingId, passengerId, seatId, mockCurrentTime } = params

    // 1. Ambil data booking
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Pesanan tidak ditemukan' }
    }

    // Wajib status 'paid'
    if (booking.status !== 'paid') {
      throw {
        status: 400,
        code: 'BOOKING_NOT_PAID',
        message: 'Check-in hanya dapat dilakukan untuk pesanan yang telah dibayar (status paid)',
      }
    }

    // 2. Ambil data jadwal penerbangan
    const [schedule] = await db
      .select()
      .from(flightSchedules)
      .where(eq(flightSchedules.id, booking.flightScheduleId!))
      .limit(1)

    if (!schedule) {
      throw { status: 404, code: 'SCHEDULE_NOT_FOUND', message: 'Jadwal penerbangan tidak ditemukan' }
    }

    // Revisi data real: Check-in menolak penerbangan dibatalkan (FLIGHT_CANCELLED)
    if (schedule.status === 'cancelled') {
      throw {
        status: 409,
        code: 'FLIGHT_CANCELLED',
        message: 'Penerbangan ini telah dibatalkan oleh maskapai. Check-in online ditutup.',
      }
    }

    // Ambil segmen pertama untuk waktu keberangkatan
    const [firstSegment] = await db
      .select()
      .from(flightSegments)
      .where(eq(flightSegments.flightScheduleId, schedule.id))
      .orderBy(sql`${flightSegments.segmentOrder} ASC`)
      .limit(1)

    if (!firstSegment) {
      throw { status: 500, code: 'SEGMENT_NOT_FOUND', message: 'Rincian segmen penerbangan tidak ditemukan' }
    }

    // 3. Validasi jendela waktu check-in (H-24 jam sebelum departureTime asli)
    const windowCheck = this.validateCheckInWindow(
      firstSegment.departureTime,
      schedule.delayMinutes || 0,
      mockCurrentTime,
    )
    if (!windowCheck.isOpen) {
      throw {
        status: 400,
        code: windowCheck.code,
        message: windowCheck.message,
      }
    }

    // 4. Ambil data penumpang
    const [passenger] = await db
      .select()
      .from(bookingPassengers)
      .where(and(eq(bookingPassengers.id, passengerId), eq(bookingPassengers.bookingId, booking.id)))
      .limit(1)

    if (!passenger) {
      throw {
        status: 404,
        code: 'PASSENGER_NOT_FOUND',
        message: 'Data penumpang tidak ditemukan pada pesanan ini',
      }
    }

    // Cek apakah sudah check-in sebelumnya
    const [existingCheckin] = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.bookingPassengerId, passenger.id))
      .limit(1)

    if (existingCheckin) {
      throw {
        status: 400,
        code: 'ALREADY_CHECKED_IN',
        message: 'Penumpang ini sudah melakukan check-in sebelumnya',
      }
    }

    // 5. Tangani pemilihan / pergantian kursi
    let activeSeatId = passenger.seatId
    if (seatId && seatId !== passenger.seatId) {
      const [targetSeat] = await db
        .select()
        .from(seats)
        .where(
          and(
            eq(seats.id, seatId),
            eq(seats.flightScheduleId, schedule.id),
            eq(seats.seatClass, passenger.seatClass),
          ),
        )
        .limit(1)

      if (!targetSeat) {
        throw {
          status: 400,
          code: 'SEAT_NOT_FOUND',
          message: 'Kursi yang dipilih tidak ditemukan pada penerbangan atau kelas ini',
        }
      }

      if (!targetSeat.isAvailable) {
        throw {
          status: 409,
          code: 'SEAT_NOT_AVAILABLE',
          message: `Kursi ${targetSeat.seatNumber} sudah tidak tersedia`,
        }
      }

      activeSeatId = targetSeat.id
    }

    // 6. Jalankan Database Transaction untuk lock/update kursi dan simpan checkin
    const result = await db.transaction(async (tx) => {
      // Jika ada pergantian kursi
      if (seatId && seatId !== passenger.seatId) {
        // Bebaskan kursi lama
        if (passenger.seatId) {
          await tx
            .update(seats)
            .set({ isAvailable: true })
            .where(eq(seats.id, passenger.seatId))
        }

        // Kunci kursi baru
        await tx
          .update(seats)
          .set({ isAvailable: false })
          .where(eq(seats.id, seatId))

        // Update kursi penumpang
        await tx
          .update(bookingPassengers)
          .set({ seatId })
          .where(eq(bookingPassengers.id, passenger.id))
      }

      // Generate boarding pass code
      const bpCode = this.generateBoardingPassCode(booking.bookingCode, passenger.id)
      const now = new Date()

      const [newCheckIn] = await tx
        .insert(checkIns)
        .values({
          bookingPassengerId: passenger.id,
          boardingPassCode: bpCode,
          checkedInAt: now,
          status: 'checked_in',
        })
        .returning()

      // Ambil nomor kursi
      const [seatRecord] = await tx
        .select({ seatNumber: seats.seatNumber })
        .from(seats)
        .where(eq(seats.id, activeSeatId!))
        .limit(1)

      return {
        checkIn: newCheckIn,
        seatNumber: seatRecord?.seatNumber || 'N/A',
        now,
      }
    })

    const boardingTimeStr = this.calculateBoardingTime(
      firstSegment.departureTime,
      schedule.delayMinutes || 0,
    )

    // Generate QR Code data URL untuk boarding pass
    const qrPayload = JSON.stringify({
      bp: result.checkIn.boardingPassCode,
      pnr: booking.bookingCode,
      passenger: passenger.fullName,
      seat: result.seatNumber,
      flight: schedule.flightNumber,
    })
    const qrCodeUrl = await qrcodeService.generateQrCodeDataUrl(qrPayload, 220)

    return {
      booking_passenger_id: passenger.id,
      passenger_name: passenger.fullName,
      seat_number: result.seatNumber,
      boarding_pass_code: result.checkIn.boardingPassCode!,
      qr_code_url: qrCodeUrl,
      gate: '3A',
      boarding_time: boardingTimeStr,
      checked_in_at: result.now.toISOString(),
    }
  }
}

export const checkinService = new CheckinService()

