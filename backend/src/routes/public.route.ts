import { Hono } from 'hono'
import { eq, or, ilike, asc, and, gte } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  airports,
  baggageOptions,
  flightSchedules,
  flightSegments,
} from '../db/schema.js'

const publicRoute = new Hono()

// GET /api/airports
publicRoute.get('/airports', async (c) => {
  const q = c.req.query('q')?.trim()

  let result
  if (q) {
    result = await db
      .select({
        id: airports.id,
        code: airports.code,
        name: airports.name,
        city: airports.city,
        country: airports.country,
      })
      .from(airports)
      .where(
        or(
          ilike(airports.code, `%${q}%`),
          ilike(airports.name, `%${q}%`),
          ilike(airports.city, `%${q}%`),
          ilike(airports.country, `%${q}%`),
        ),
      )
      .orderBy(asc(airports.city))
  } else {
    result = await db
      .select({
        id: airports.id,
        code: airports.code,
        name: airports.name,
        city: airports.city,
        country: airports.country,
      })
      .from(airports)
      .orderBy(asc(airports.city))
  }

  return c.json({
    error: false,
    data: result,
  })
})

// GET /api/baggage-options
publicRoute.get('/baggage-options', async (c) => {
  const result = await db
    .select({
      id: baggageOptions.id,
      name: baggageOptions.name,
      weight_kg: baggageOptions.weightKg,
      price: baggageOptions.price,
    })
    .from(baggageOptions)
    .orderBy(asc(baggageOptions.weightKg))

  return c.json({
    error: false,
    data: result,
  })
})

// GET /api/routes/popular
publicRoute.get('/routes/popular', async (c) => {
  const limitParam = Number(c.req.query('limit') || 6)
  const limit = isNaN(limitParam) ? 6 : Math.min(Math.max(limitParam, 1), 20)

  // Ambil semua bandara
  const allAirports = await db.select().from(airports)
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))

  // Ambil jadwal penerbangan mendatang yang aktif (status = 'scheduled')
  const now = new Date()

  const schedules = await db
    .select({
      id: flightSchedules.id,
      flightNumber: flightSchedules.flightNumber,
      flightType: flightSchedules.flightType,
      priceEconomy: flightSchedules.priceEconomy,
      status: flightSchedules.status,
    })
    .from(flightSchedules)
    .where(eq(flightSchedules.status, 'scheduled'))

  const scheduleIds = schedules.map((s) => s.id)

  let segments: any[] = []
  if (scheduleIds.length > 0) {
    segments = await db
      .select()
      .from(flightSegments)
      .orderBy(asc(flightSegments.segmentOrder))
  }

  // Petakan rute unik (origin -> destination)
  interface PopularRouteItem {
    origin: { code: string; city: string; name: string }
    destination: { code: string; city: string; name: string }
    next_departure_time: string
    duration_minutes: number
    flight_type: 'direct' | 'transit'
    lowest_price_economy: number
  }

  const routeMap = new Map<string, PopularRouteItem>()

  for (const schedule of schedules) {
    const schedSegments = segments.filter((seg) => seg.flightScheduleId === schedule.id)
    if (schedSegments.length === 0) continue

    const firstSeg = schedSegments[0]
    const lastSeg = schedSegments[schedSegments.length - 1]

    const origin = airportMap.get(firstSeg.originAirportId!)
    const dest = airportMap.get(lastSeg.destinationAirportId!)

    if (!origin || !dest) continue

    const routeKey = `${origin.code}-${dest.code}`
    const price = Number(schedule.priceEconomy)
    const departureTime = new Date(firstSeg.departureTime)
    const arrivalTime = new Date(lastSeg.arrivalTime)
    const duration = Math.round((arrivalTime.getTime() - departureTime.getTime()) / (1000 * 60))

    const existing = routeMap.get(routeKey)
    if (!existing || price < existing.lowest_price_economy) {
      routeMap.set(routeKey, {
        origin: { code: origin.code, city: origin.city, name: origin.name },
        destination: { code: dest.code, city: dest.city, name: dest.name },
        next_departure_time: firstSeg.departureTime.toISOString(),
        duration_minutes: Math.max(duration, 30),
        flight_type: schedule.flightType,
        lowest_price_economy: price,
      })
    }
  }

  const popularRoutes = Array.from(routeMap.values()).slice(0, limit)

  return c.json({
    error: false,
    data: popularRoutes,
  })
})

export default publicRoute
