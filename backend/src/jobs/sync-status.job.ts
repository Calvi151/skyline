import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  flightSchedules,
  flightSegments,
  bookings,
} from '../db/schema.js'
import { aeroDataBoxProvider } from '../providers/aerodatabox.provider.js'
import { flightNotificationService } from '../services/flight-notification.service.js'

interface SyncResult {
  checked: number
  changed: number
  notified: number
  units_used: number
  errors: string[]
}

/**
 * Job sinkron status penerbangan (DAT-06).
 * Hanya untuk jadwal source='api' yang berangkat dalam 24 jam dan punya booking paid.
 */
export async function syncStatusJob(specificScheduleId?: number): Promise<SyncResult> {
  const result: SyncResult = { checked: 0, changed: 0, notified: 0, units_used: 0, errors: [] }

  const now = new Date()
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  let schedulesToCheck: any[] = []

  if (specificScheduleId) {
    // Admin minta sinkron jadwal tertentu
    schedulesToCheck = await db
      .select()
      .from(flightSchedules)
      .where(eq(flightSchedules.id, specificScheduleId))
      .limit(1)
  } else {
    // Ambil jadwal source='api' yang berangkat dalam 24 jam ke depan
    const apiSchedules = await db
      .select()
      .from(flightSchedules)
      .where(eq(flightSchedules.source, 'api'))

    // Filter: hanya yang punya segmen berangkat dalam 24 jam
    for (const sched of apiSchedules) {
      const segments = await db
        .select()
        .from(flightSegments)
        .where(eq(flightSegments.flightScheduleId, sched.id))
        .orderBy(flightSegments.segmentOrder)
        .limit(1)

      if (segments.length === 0) continue

      const depTime = segments[0].departureTime
      if (depTime >= now && depTime <= next24h) {
        // Cek apakah punya booking paid
        const [hasPaidBooking] = await db
          .select({ id: bookings.id })
          .from(bookings)
          .where(and(eq(bookings.flightScheduleId, sched.id), eq(bookings.status, 'paid')))
          .limit(1)

        if (hasPaidBooking) {
          schedulesToCheck.push(sched)
        }
      }
    }
  }

  for (const sched of schedulesToCheck) {
    try {
      // Ambil tanggal keberangkatan dari segmen pertama
      const segments = await db
        .select()
        .from(flightSegments)
        .where(eq(flightSegments.flightScheduleId, sched.id))
        .orderBy(flightSegments.segmentOrder)
        .limit(1)

      if (segments.length === 0) continue

      const depDate = segments[0].departureTime.toISOString().split('T')[0]

      let statusData
      try {
        statusData = await aeroDataBoxProvider.getFlightStatus(sched.flightNumber, depDate)
        result.units_used++
      } catch (err: any) {
        if (err.message === 'PROVIDER_QUOTA_EXCEEDED') {
          result.errors.push('Kuota provider habis')
          break
        }
        result.errors.push(`Provider gagal untuk ${sched.flightNumber}: ${err.message}`)
        continue // DAT-08: graceful degradation
      }

      result.checked++

      if (!statusData) continue

      const prevStatus = sched.status || 'scheduled'
      const prevDelay = sched.delayMinutes || 0
      const newStatus = statusData.status
      const newDelay = statusData.delayMinutes

      if (newStatus !== prevStatus || newDelay !== prevDelay) {
        // Update status di database
        await db
          .update(flightSchedules)
          .set({
            status: newStatus,
            delayMinutes: newDelay,
            statusSyncedAt: new Date(),
          })
          .where(eq(flightSchedules.id, sched.id))

        result.changed++

        // Kirim notifikasi (NTF-01)
        try {
          await flightNotificationService.notifyFlightScheduleChange(
            sched.id,
            prevStatus,
            prevDelay,
            newStatus,
            newDelay,
          )
          result.notified++
        } catch {
          // NTF-01: kegagalan kirim tidak menggagalkan sync
        }
      }
    } catch (err: any) {
      result.errors.push(`Gagal sync ${sched.flightNumber}: ${err.message}`)
    }
  }

  console.log(
    `[SyncStatus] Selesai: checked=${result.checked}, changed=${result.changed}, notified=${result.notified}, units=${result.units_used}`,
  )
  return result
}
