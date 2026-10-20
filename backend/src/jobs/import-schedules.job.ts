import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  flightSchedules,
  flightSegments,
  seats,
  airlines,
  airports,
  airplanes,
  bookings,
} from '../db/schema.js'
import { aeroDataBoxProvider } from '../providers/aerodatabox.provider.js'
import { generateSeatList } from '../services/seat-generator.service.js'
import type { ProviderScheduleItem } from '../providers/flight-provider.interface.js'

interface ImportResult {
  created: number
  updated: number
  skipped: number
  units_used: number
  errors: string[]
}

/**
 * Menghitung harga simulasi berdasarkan rumus deterministik (DAT-04).
 * formula: PRICING_BASE + (durationMinutes * PRICING_PER_MINUTE) + faktor jam berangkat
 */
function calculateSimulatedPrice(durationMinutes: number, departureHourUtc: number): number {
  const base = Number(process.env.PRICING_BASE || 500000)
  const perMinute = Number(process.env.PRICING_PER_MINUTE || 5000)

  // Faktor jam berangkat: pagi (06-09) +15%, sore (15-18) +10%, malam (20-05) -10%
  let hourFactor = 1.0
  if (departureHourUtc >= 6 && departureHourUtc < 9) {
    hourFactor = 1.15
  } else if (departureHourUtc >= 15 && departureHourUtc < 18) {
    hourFactor = 1.10
  } else if (departureHourUtc >= 20 || departureHourUtc < 5) {
    hourFactor = 0.90
  }

  return Math.round((base + durationMinutes * perMinute) * hourFactor)
}

/**
 * Job utama impor jadwal penerbangan dari provider eksternal (DAT-03).
 * Rute yang diimpor diambil dari env PROVIDER_IMPORT_ROUTES (format: "CGK-DPS,CGK-SUB,...").
 * Semua jadwal diimpor sebagai direct (satu segmen), transit tetap oleh admin manual.
 */
export async function importSchedulesJob(
  overrideRoutes?: string[],
  overrideDaysAhead?: number,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, units_used: 0, errors: [] }

  // Ambil rute dari env atau parameter override
  const routesStr = overrideRoutes
    ? overrideRoutes.join(',')
    : process.env.PROVIDER_IMPORT_ROUTES || 'CGK-DPS,CGK-SUB,SUB-DPS,CGK-KNO,CGK-YIA'
  const routes = routesStr
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean)

  const daysAhead = overrideDaysAhead ?? Number(process.env.PROVIDER_IMPORT_DAYS_AHEAD || 7)

  // Bangun lookup: airport IATA -> id
  const allAirports = await db.select().from(airports)
  const airportByIata = new Map(allAirports.map((a) => [a.code.toUpperCase(), a]))

  // Bangun lookup: airline code -> (airline + default airplane)
  const allAirlines = await db.select().from(airlines)
  const allAirplanes = await db.select().from(airplanes)
  const airlineByCode = new Map(allAirlines.map((a) => [a.code?.toUpperCase() || '', a]))
  const airplaneByAirlineId = new Map(allAirplanes.map((a) => [a.airlineId!, a]))

  // Rentang tanggal
  const today = new Date()
  const fromDate = today.toISOString().split('T')[0]
  const toDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  for (const routeStr of routes) {
    const [origin, dest] = routeStr.split('-')
    if (!origin || !dest) {
      result.errors.push(`Rute tidak valid: ${routeStr}`)
      continue
    }

    const originAirport = airportByIata.get(origin)
    const destAirport = airportByIata.get(dest)
    if (!originAirport) {
      result.errors.push(`Bandara asal tidak ditemukan di database: ${origin}`)
      continue
    }
    if (!destAirport) {
      result.errors.push(`Bandara tujuan tidak ditemukan di database: ${dest}`)
      continue
    }

    let items: ProviderScheduleItem[] = []
    try {
      items = await aeroDataBoxProvider.getSchedulesByRoute(origin, dest, fromDate, toDate)
      result.units_used++
    } catch (err: any) {
      if (err.message === 'PROVIDER_QUOTA_EXCEEDED') {
        result.errors.push(`Kuota provider habis saat mengambil rute ${routeStr}`)
        break // Stop semua rute
      }
      result.errors.push(`Provider gagal untuk rute ${routeStr}: ${err.message}`)
      continue // DAT-08: lanjutkan ke rute berikutnya
    }

    for (const item of items) {
      try {
        // Cari airline & airplane
        const airline = airlineByCode.get(item.airlineCode.toUpperCase())
        if (!airline) {
          result.skipped++
          continue // Skip jika maskapai tidak ada di database
        }

        const airplane = airplaneByAirlineId.get(airline.id)
        if (!airplane) {
          result.skipped++
          continue // Skip jika pesawat default tidak ada
        }

        const externalRef = item.externalRef

        // Cek jadwal eksisting berdasarkan (source='api', external_ref)
        const [existing] = await db
          .select()
          .from(flightSchedules)
          .where(
            and(
              eq(flightSchedules.source, 'api'),
              eq(flightSchedules.externalRef, externalRef),
            ),
          )
          .limit(1)

        if (existing) {
          // DAT-04: Jika sudah ada booking, skip perubahan harga/pesawat/kursi
          const [hasBooking] = await db
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.flightScheduleId, existing.id))
            .limit(1)

          if (hasBooking) {
            result.skipped++
            continue
          }

          // Update jadwal yang sudah ada (tanpa booking)
          const priceEconomy = calculateSimulatedPrice(
            item.durationMinutes,
            item.departureTimeUtc.getUTCHours(),
          )
          const priceBusiness = Math.round(priceEconomy * 2.5)

          await db
            .update(flightSchedules)
            .set({
              flightNumber: item.flightNumber,
              priceEconomy: priceEconomy.toString(),
              priceBusiness: priceBusiness.toString(),
            })
            .where(eq(flightSchedules.id, existing.id))

          result.updated++
        } else {
          // Buat jadwal baru beserta segmen dan kursi
          const priceEconomy = calculateSimulatedPrice(
            item.durationMinutes,
            item.departureTimeUtc.getUTCHours(),
          )
          const priceBusiness = Math.round(priceEconomy * 2.5)

          await db.transaction(async (tx) => {
            const [schedule] = await tx
              .insert(flightSchedules)
              .values({
                flightNumber: item.flightNumber,
                airlineId: airline.id,
                airplaneId: airplane.id,
                flightType: 'direct',
                priceEconomy: priceEconomy.toString(),
                priceBusiness: priceBusiness.toString(),
                status: 'scheduled',
                source: 'api',
                externalRef,
              })
              .returning()

            // 1 segmen (direct)
            await tx.insert(flightSegments).values({
              flightScheduleId: schedule.id,
              segmentOrder: 1,
              originAirportId: originAirport.id,
              destinationAirportId: destAirport.id,
              departureTime: item.departureTimeUtc,
              arrivalTime: item.arrivalTimeUtc,
            })

            // Generate kursi (reuse seat-generator)
            const seatRecords = generateSeatList({
              flightScheduleId: schedule.id,
              airplaneId: airplane.id,
              totalSeatEconomy: airplane.totalSeatEconomy,
              totalSeatBusiness: airplane.totalSeatBusiness || 0,
            })

            if (seatRecords.length > 0) {
              await tx.insert(seats).values(seatRecords)
            }
          })

          result.created++
        }
      } catch (err: any) {
        result.errors.push(`Gagal upsert ${item.flightNumber}: ${err.message}`)
        result.skipped++
      }
    }
  }

  console.log(
    `[ImportSchedules] Selesai: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, units=${result.units_used}, errors=${result.errors.length}`,
  )
  return result
}
