import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  flightNotifications,
  bookings,
  flightSchedules,
  flightSegments,
  airports,
  users,
} from '../db/schema.js'
import { emailService } from './email.service.js'

export class FlightNotificationService {
  /**
   * Mengirim notifikasi email ke penumpang saat jadwal delay / cancelled (NTF-01).
   * Bersifat idempotent & dedupe via tabel flight_notifications.
   * Kegagalan kirim tidak melempar error agar alur utama sinkronisasi tidak terhenti.
   */
  async notifyFlightScheduleChange(
    scheduleId: number,
    prevStatus: string,
    prevDelay: number,
    newStatus: string,
    newDelay: number,
  ): Promise<void> {
    try {
      if (newStatus !== 'delayed' && newStatus !== 'cancelled') {
        return
      }

      const minDelayThreshold = Number(process.env.DELAY_NOTIFY_MIN_MINUTES || 15)

      if (newStatus === 'delayed' && newDelay < minDelayThreshold) {
        // Abaikan keterlambatan kecil di bawah batas minimum (default 15 menit)
        return
      }

      // Ambil detail jadwal penerbangan beserta info segmen pertama dan terakhir
      const [schedule] = await db
        .select()
        .from(flightSchedules)
        .where(eq(flightSchedules.id, scheduleId))
        .limit(1)

      if (!schedule) return

      const segments = await db
        .select({
          segmentOrder: flightSegments.segmentOrder,
          departureTime: flightSegments.departureTime,
          originAirportId: flightSegments.originAirportId,
          destinationAirportId: flightSegments.destinationAirportId,
        })
        .from(flightSegments)
        .where(eq(flightSegments.flightScheduleId, scheduleId))
        .orderBy(flightSegments.segmentOrder)

      if (segments.length === 0) return

      const firstSeg = segments[0]
      const lastSeg = segments[segments.length - 1]

      const [originAirport] = firstSeg.originAirportId
        ? await db.select().from(airports).where(eq(airports.id, firstSeg.originAirportId)).limit(1)
        : [null]

      const [destAirport] = lastSeg.destinationAirportId
        ? await db.select().from(airports).where(eq(airports.id, lastSeg.destinationAirportId)).limit(1)
        : [null]

      const originCity = originAirport ? `${originAirport.city} (${originAirport.code})` : 'Kota Asal'
      const destinationCity = destAirport ? `${destAirport.city} (${destAirport.code})` : 'Kota Tujuan'
      const departureTimeStr = firstSeg.departureTime
        ? new Date(firstSeg.departureTime).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : '-'

      // Cari seluruh booking dengan status 'paid'
      const paidBookings = await db
        .select({
          bookingId: bookings.id,
          userId: bookings.userId,
          userEmail: users.email,
          userName: users.name,
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.userId, users.id))
        .where(and(eq(bookings.flightScheduleId, scheduleId), eq(bookings.status, 'paid')))

      for (const b of paidBookings) {
        if (newStatus === 'cancelled') {
          // Cek apakah sudah pernah dikirim notifikasi cancel untuk booking ini
          const [alreadySent] = await db
            .select()
            .from(flightNotifications)
            .where(
              and(
                eq(flightNotifications.bookingId, b.bookingId),
                eq(flightNotifications.kind, 'cancel'),
              ),
            )
            .limit(1)

          if (alreadySent) continue

          const success = await emailService.sendFlightCancelledEmail({
            to: b.userEmail,
            name: b.userName,
            flightNumber: schedule.flightNumber,
            departureTime: departureTimeStr,
            originCity,
            destinationCity,
          })

          await db.insert(flightNotifications).values({
            bookingId: b.bookingId,
            flightScheduleId: schedule.id,
            kind: 'cancel',
            delayMinutes: 0,
            emailStatus: success ? 'sent' : 'failed',
          })
        } else if (newStatus === 'delayed') {
          // Cari notifikasi delay terakhir untuk booking ini
          const [lastDelayNotification] = await db
            .select()
            .from(flightNotifications)
            .where(
              and(
                eq(flightNotifications.bookingId, b.bookingId),
                eq(flightNotifications.kind, 'delay'),
              ),
            )
            .orderBy(desc(flightNotifications.delayMinutes))
            .limit(1)

          if (lastDelayNotification) {
            // NTF-01: keterlambatan lanjutan hanya diemail ulang jika bertambah minimal 30 menit
            const delayDiff = newDelay - lastDelayNotification.delayMinutes
            if (delayDiff < 30) {
              continue
            }
          }

          const success = await emailService.sendFlightDelayEmail({
            to: b.userEmail,
            name: b.userName,
            flightNumber: schedule.flightNumber,
            departureTime: departureTimeStr,
            delayMinutes: newDelay,
            originCity,
            destinationCity,
          })

          await db.insert(flightNotifications).values({
            bookingId: b.bookingId,
            flightScheduleId: schedule.id,
            kind: 'delay',
            delayMinutes: newDelay,
            emailStatus: success ? 'sent' : 'failed',
          })
        }
      }
    } catch (error) {
      console.error('[FlightNotificationService] Gagal memproses notifikasi perubahan jadwal:', error)
    }
  }
}

export const flightNotificationService = new FlightNotificationService()
