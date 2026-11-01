import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  airplanes,
  seats,
} from '../db/schema.js'
import { GLOBAL_AIRPORTS_DATA } from '../db/global-airports.js'

/**
 * Pastikan bandara terdaftar di tabel airports PostgreSQL.
 * Jika belum ada, auto-insert dari kamus GLOBAL_AIRPORTS_DATA.
 */
export async function ensureAirportInDb(codeOrCity: string) {
  const clean = codeOrCity.trim().toUpperCase()

  // 1. Cek by code
  const [byCode] = await db
    .select()
    .from(airports)
    .where(eq(airports.code, clean))
    .limit(1)
  if (byCode) return byCode

  // 2. Cek kamus global
  const qLower = codeOrCity.trim().toLowerCase()
  const globalMatch = GLOBAL_AIRPORTS_DATA.find(
    (g) =>
      g.code.toUpperCase() === clean ||
      g.aliases.includes(qLower) ||
      g.city.toLowerCase() === qLower ||
      g.primaryCity.toLowerCase().includes(qLower) ||
      g.name.toLowerCase().includes(qLower),
  )

  if (globalMatch) {
    try {
      const [inserted] = await db
        .insert(airports)
        .values({
          code: globalMatch.code,
          name: globalMatch.name,
          city: globalMatch.primaryCity || globalMatch.city,
          country: globalMatch.country,
          timezone: globalMatch.timezone,
        })
        .onConflictDoNothing()
        .returning()

      if (inserted) return inserted

      const [retry] = await db
        .select()
        .from(airports)
        .where(eq(airports.code, globalMatch.code))
        .limit(1)
      if (retry) return retry
    } catch (err) {
      console.error('Failed to auto-insert airport:', err)
    }
  }

  return null
}

/**
 * Generate dan simpan jadwal penerbangan otomatis untuk rute internasional / belum ada jadwal
 * (seperti Jakarta -> Tokyo, Bali -> Tokyo, Seoul, London, Jeddah dll.)
 * Lengkap dengan segment transit dan alokasi kursi di tabel seats.
 */
export async function generateSchedulesForRoute(
  originAirport: typeof airports.$inferSelect,
  destAirport: typeof airports.$inferSelect,
  targetDateStr: string, // YYYY-MM-DD
) {
  try {
    // Ambil maskapai utama & pesawat
    const allAirlines = await db.select().from(airlines)
    const garuda = allAirlines.find((a) => a.code === 'GA') || allAirlines[0]
    const batik = allAirlines.find((a) => a.code === 'ID') || allAirlines[1] || garuda

    const allAirplanes = await db.select().from(airplanes)
    const wideBodyPlane = allAirplanes.find((p) => p.model?.includes('777') || p.model?.includes('330')) || allAirplanes[0]
    const narrowBodyPlane = allAirplanes.find((p) => p.model?.includes('737') || p.model?.includes('320')) || allAirplanes[0]

    // Bandara Hub Transit Internasional
    const singaporeAirport = await ensureAirportInDb('SIN')
    const klAirport = await ensureAirportInDb('KUL')

    const createdScheduleIds: number[] = []

    // Estimasi harga dasar berdasarkan destinasi
    const isFar = destAirport.country !== 'Indonesia' && destAirport.country !== 'Singapore' && destAirport.country !== 'Malaysia'
    const baseEcoPrice = isFar ? 4650000 : 1250000
    const baseBusPrice = isFar ? 12800000 : 3800000

    // ─── 1. Penerbangan Langsung (Direct Pagi) ───
    const depTime1 = new Date(`${targetDateStr}T06:30:00.000Z`)
    const arrTime1 = new Date(`${targetDateStr}T14:45:00.000Z`) // ~8j 15m durasi
    const flightNum1 = `GA-${destAirport.code}-101`

    const [sched1] = await db
      .insert(flightSchedules)
      .values({
        flightNumber: flightNum1,
        airlineId: garuda ? garuda.id : null,
        airplaneId: wideBodyPlane ? wideBodyPlane.id : null,
        flightType: 'direct',
        priceEconomy: String(baseEcoPrice + 200000),
        priceBusiness: String(baseBusPrice + 500000),
        status: 'scheduled',
        source: 'manual',
        delayMinutes: 0,
      })
      .returning()

    if (sched1) {
      createdScheduleIds.push(sched1.id)
      await db.insert(flightSegments).values({
        flightScheduleId: sched1.id,
        originAirportId: originAirport.id,
        destinationAirportId: destAirport.id,
        departureTime: depTime1,
        arrivalTime: arrTime1,
        segmentOrder: 1,
      })
      await generateSeatsForSchedule(sched1.id, 24, 6)
    }

    // ─── 2. Penerbangan Langsung (Direct Malam) ───
    const depTime2 = new Date(`${targetDateStr}T21:45:00.000Z`)
    const nextDay = new Date(new Date(targetDateStr).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const arrTime2 = new Date(`${nextDay}T06:30:00.000Z`)
    const flightNum2 = `GA-${destAirport.code}-103`

    const [sched2] = await db
      .insert(flightSchedules)
      .values({
        flightNumber: flightNum2,
        airlineId: garuda ? garuda.id : null,
        airplaneId: wideBodyPlane ? wideBodyPlane.id : null,
        flightType: 'direct',
        priceEconomy: String(baseEcoPrice + 450000),
        priceBusiness: String(baseBusPrice + 900000),
        status: 'scheduled',
        source: 'manual',
        delayMinutes: 0,
      })
      .returning()

    if (sched2) {
      createdScheduleIds.push(sched2.id)
      await db.insert(flightSegments).values({
        flightScheduleId: sched2.id,
        originAirportId: originAirport.id,
        destinationAirportId: destAirport.id,
        departureTime: depTime2,
        arrivalTime: arrTime2,
        segmentOrder: 1,
      })
      await generateSeatsForSchedule(sched2.id, 20, 6)
    }

    // ─── 3. Penerbangan Transit via Singapura (Changi SIN) ───
    if (singaporeAirport && singaporeAirport.id !== originAirport.id && singaporeAirport.id !== destAirport.id) {
      const depSeg1 = new Date(`${targetDateStr}T08:00:00.000Z`)
      const arrSeg1 = new Date(`${targetDateStr}T09:45:00.000Z`)
      const depSeg2 = new Date(`${targetDateStr}T12:00:00.000Z`) // transit 2j 15m
      const arrSeg2 = new Date(`${targetDateStr}T19:30:00.000Z`)
      const flightNum3 = `GA-SIN-${destAirport.code}`

      const [sched3] = await db
        .insert(flightSchedules)
        .values({
          flightNumber: flightNum3,
          airlineId: garuda ? garuda.id : null,
          airplaneId: narrowBodyPlane ? narrowBodyPlane.id : null,
          flightType: 'transit',
          priceEconomy: String(Math.round(baseEcoPrice * 0.88)), // Lebih hemat
          priceBusiness: String(Math.round(baseBusPrice * 0.85)),
          status: 'scheduled',
          source: 'manual',
          delayMinutes: 0,
        })
        .returning()

      if (sched3) {
        createdScheduleIds.push(sched3.id)
        await db.insert(flightSegments).values([
          {
            flightScheduleId: sched3.id,
            originAirportId: originAirport.id,
            destinationAirportId: singaporeAirport.id,
            departureTime: depSeg1,
            arrivalTime: arrSeg1,
            segmentOrder: 1,
            transitDurationMinutes: 135,
          },
          {
            flightScheduleId: sched3.id,
            originAirportId: singaporeAirport.id,
            destinationAirportId: destAirport.id,
            departureTime: depSeg2,
            arrivalTime: arrSeg2,
            segmentOrder: 2,
          },
        ])
        await generateSeatsForSchedule(sched3.id, 28, 8)
      }
    }

    // ─── 4. Penerbangan Transit via Kuala Lumpur (KLIA KUL) ───
    if (klAirport && klAirport.id !== originAirport.id && klAirport.id !== destAirport.id) {
      const depSeg1 = new Date(`${targetDateStr}T10:15:00.000Z`)
      const arrSeg1 = new Date(`${targetDateStr}T12:20:00.000Z`)
      const depSeg2 = new Date(`${targetDateStr}T14:10:00.000Z`) // transit 1j 50m
      const arrSeg2 = new Date(`${targetDateStr}T21:40:00.000Z`)
      const flightNum4 = `ID-KUL-${destAirport.code}`

      const [sched4] = await db
        .insert(flightSchedules)
        .values({
          flightNumber: flightNum4,
          airlineId: batik ? batik.id : null,
          airplaneId: narrowBodyPlane ? narrowBodyPlane.id : null,
          flightType: 'transit',
          priceEconomy: String(Math.round(baseEcoPrice * 0.82)), // Super Hemat
          priceBusiness: String(Math.round(baseBusPrice * 0.80)),
          status: 'scheduled',
          source: 'manual',
          delayMinutes: 0,
        })
        .returning()

      if (sched4) {
        createdScheduleIds.push(sched4.id)
        await db.insert(flightSegments).values([
          {
            flightScheduleId: sched4.id,
            originAirportId: originAirport.id,
            destinationAirportId: klAirport.id,
            departureTime: depSeg1,
            arrivalTime: arrSeg1,
            segmentOrder: 1,
            transitDurationMinutes: 110,
          },
          {
            flightScheduleId: sched4.id,
            originAirportId: klAirport.id,
            destinationAirportId: destAirport.id,
            departureTime: depSeg2,
            arrivalTime: arrSeg2,
            segmentOrder: 2,
          },
        ])
        await generateSeatsForSchedule(sched4.id, 25, 6)
      }
    }

    return createdScheduleIds
  } catch (err) {
    console.error('Error generating international schedules:', err)
    return []
  }
}

/**
 * Buat data kursi (seats) otomatis untuk jadwal baru agar pemilihan kursi & booking berjalan lancar
 */
async function generateSeatsForSchedule(scheduleId: number, economyCount: number, businessCount: number) {
  try {
    const seatValues: Array<{
      flightScheduleId: number
      seatNumber: string
      seatClass: 'economy' | 'business'
      isAvailable: boolean
    }> = []

    // Baris 1-2: Bisnis (1A - 2F)
    const busCols = ['A', 'C', 'D', 'F']
    let bCount = 0
    for (let r = 1; r <= 2; r++) {
      for (const col of busCols) {
        if (bCount >= businessCount) break
        seatValues.push({
          flightScheduleId: scheduleId,
          seatNumber: `${r}${col}`,
          seatClass: 'business',
          isAvailable: true,
        })
        bCount++
      }
    }

    // Baris 10-18: Ekonomi (10A - 18F)
    const ecoCols = ['A', 'B', 'C', 'D', 'E', 'F']
    let eCount = 0
    for (let r = 10; r <= 18; r++) {
      for (const col of ecoCols) {
        if (eCount >= economyCount) break
        seatValues.push({
          flightScheduleId: scheduleId,
          seatNumber: `${r}${col}`,
          seatClass: 'economy',
          isAvailable: true,
        })
        eCount++
      }
    }

    if (seatValues.length > 0) {
      await db.insert(seats).values(seatValues)
    }
  } catch (err) {
    console.error('Error generating seats for schedule:', err)
  }
}

