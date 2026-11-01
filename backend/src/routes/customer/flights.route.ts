import { Hono } from 'hono'
import { eq, and, sql, asc, inArray, ilike } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  flightSchedules,
  flightSegments,
  airports,
  airlines,
  airplanes,
  seats,
} from '../../db/schema.js'
import { ensureAirportInDb, generateSchedulesForRoute } from '../../services/flight-generator.service.js'

const customerFlightsRoute = new Hono()

/**
 * Helper to resolve airport by IATA code or numeric ID
 */
async function resolveAirport(query: string) {
  const isNumeric = /^\d+$/.test(query)
  if (isNumeric) {
    const [airport] = await db
      .select()
      .from(airports)
      .where(eq(airports.id, Number(query)))
      .limit(1)
    return airport || null
  }
  const clean = query.trim()
  if (!clean) return null

  // Resolves against database + global airports dictionary (including Tokyo HND/NRT, Seoul, London, etc.)
  return await ensureAirportInDb(clean)
}

/**
 * GET /api/flights/search
 * Query params: origin, destination, date, passengers, flight_type, class, sort
 */
customerFlightsRoute.get('/search', async (c) => {
  const originParam = c.req.query('origin')
  const destinationParam = c.req.query('destination')
  const dateParam = c.req.query('date')
  const passengersParam = Number(c.req.query('passengers') || 1)
  const flightTypeParam = c.req.query('flight_type') // 'direct' | 'transit'
  const classParam = c.req.query('class') // 'economy' | 'business'
  const sortParam = c.req.query('sort') || 'price' // 'price' | 'duration' | 'value'

  if (!originParam || !destinationParam || !dateParam) {
    return c.json(
      {
        error: true,
        message: 'Parameter origin, destination, dan date wajib diisi',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const passengers = isNaN(passengersParam) || passengersParam < 1 ? 1 : passengersParam

  // 1. Resolve airports
  const originAirport = await resolveAirport(originParam)
  const destAirport = await resolveAirport(destinationParam)

  if (!originAirport || !destAirport) {
    return c.json(
      {
        error: true,
        message: 'Bandara asal atau tujuan tidak ditemukan',
        code: 'AIRPORT_NOT_FOUND',
      },
      404,
    )
  }

  if (originAirport.id === destAirport.id) {
    return c.json(
      {
        error: true,
        message: 'Bandara asal dan tujuan tidak boleh sama',
        code: 'SAME_AIRPORT',
      },
      400,
    )
  }

  // 2. Fetch all non-cancelled flight schedules
  const allSchedulesQuery = db
    .select({
      id: flightSchedules.id,
      flightNumber: flightSchedules.flightNumber,
      airlineId: flightSchedules.airlineId,
      airplaneId: flightSchedules.airplaneId,
      flightType: flightSchedules.flightType,
      priceEconomy: flightSchedules.priceEconomy,
      priceBusiness: flightSchedules.priceBusiness,
      status: flightSchedules.status,
      delayMinutes: flightSchedules.delayMinutes,
      statusSyncedAt: flightSchedules.statusSyncedAt,
      source: flightSchedules.source,
    })
    .from(flightSchedules)
    .where(
      sql`${flightSchedules.status} != 'cancelled'`,
    )

  const candidateSchedules = await allSchedulesQuery

  if (candidateSchedules.length === 0) {
    return c.json({ error: false, data: [] })
  }

  const scheduleIds = candidateSchedules.map((s) => s.id)

  // 3. Fetch all segments for candidate schedules
  const allSegments = await db
    .select()
    .from(flightSegments)
    .where(inArray(flightSegments.flightScheduleId, scheduleIds))
    .orderBy(asc(flightSegments.segmentOrder))

  // Group segments by scheduleId
  const segmentsBySchedule = new Map<number, typeof allSegments>()
  for (const seg of allSegments) {
    const list = segmentsBySchedule.get(seg.flightScheduleId!) || []
    list.push(seg)
    segmentsBySchedule.set(seg.flightScheduleId!, list)
  }

  // 4. Fetch all airports, airlines, airplanes for enrichment
  const [allAirports, allAirlines, allAirplanes] = await Promise.all([
    db.select().from(airports),
    db.select().from(airlines),
    db.select().from(airplanes),
  ])

  const airportMap = new Map(allAirports.map((a) => [a.id, a]))
  const airlineMap = new Map(allAirlines.map((a) => [a.id, a]))
  const airplaneMap = new Map(allAirplanes.map((a) => [a.id, a]))

  // 5. Filter schedules matching route and departure date
  const matchedSchedules: Array<{
    schedule: typeof candidateSchedules[0]
    segments: typeof allSegments
    firstSegment: typeof allSegments[0]
    lastSegment: typeof allSegments[0]
    totalDuration: number
    layoverWarning: 'short' | 'long' | null
  }> = []

  const targetDatePrefix = dateParam.slice(0, 10) // YYYY-MM-DD

  for (const schedule of candidateSchedules) {
    // Filter by flight_type if requested
    if (flightTypeParam && ['direct', 'transit'].includes(flightTypeParam)) {
      if (schedule.flightType !== flightTypeParam) continue
    }

    const segs = segmentsBySchedule.get(schedule.id)
    if (!segs || segs.length === 0) continue

    const firstSeg = segs[0]
    const lastSeg = segs[segs.length - 1]

    // Route matching: origin to destination
    if (firstSeg.originAirportId !== originAirport.id || lastSeg.destinationAirportId !== destAirport.id) {
      continue
    }

    // Date matching on first segment departure
    const depDate = new Date(firstSeg.departureTime)
    const depIsoDate = depDate.toISOString().slice(0, 10)
    // Also check local date representation
    const depLocalDate = depDate.toLocaleDateString('en-CA') // YYYY-MM-DD in local

    if (depIsoDate !== targetDatePrefix && depLocalDate !== targetDatePrefix) {
      continue
    }

    // Calculate total duration
    const depTime = new Date(firstSeg.departureTime).getTime()
    const arrTime = new Date(lastSeg.arrivalTime).getTime()
    const totalDuration = Math.max(Math.round((arrTime - depTime) / (1000 * 60)), 30)

    // Calculate layover warning
    let layoverWarning: 'short' | 'long' | null = null
    if (schedule.flightType === 'transit' && segs.length > 1) {
      for (let i = 0; i < segs.length - 1; i++) {
        const segArr = new Date(segs[i].arrivalTime).getTime()
        const nextDep = new Date(segs[i + 1].departureTime).getTime()
        const gapMinutes = Math.round((nextDep - segArr) / (1000 * 60))

        if (gapMinutes < 60) {
          layoverWarning = 'short'
          break
        } else if (gapMinutes > 360) {
          layoverWarning = 'long'
        }
      }
    }

    matchedSchedules.push({
      schedule,
      segments: segs,
      firstSegment: firstSeg,
      lastSegment: lastSeg,
      totalDuration,
      layoverWarning,
    })
  }

  if (matchedSchedules.length === 0) {
    // Generate realistic flight schedules for international routes or dates without pre-existing flights
    const generatedIds = await generateSchedulesForRoute(originAirport, destAirport, targetDatePrefix)
    if (generatedIds.length > 0) {
      const newSchedules = await db
        .select({
          id: flightSchedules.id,
          flightNumber: flightSchedules.flightNumber,
          airlineId: flightSchedules.airlineId,
          airplaneId: flightSchedules.airplaneId,
          flightType: flightSchedules.flightType,
          priceEconomy: flightSchedules.priceEconomy,
          priceBusiness: flightSchedules.priceBusiness,
          status: flightSchedules.status,
          delayMinutes: flightSchedules.delayMinutes,
          statusSyncedAt: flightSchedules.statusSyncedAt,
          source: flightSchedules.source,
        })
        .from(flightSchedules)
        .where(inArray(flightSchedules.id, generatedIds))

      const newSegments = await db
        .select()
        .from(flightSegments)
        .where(inArray(flightSegments.flightScheduleId, generatedIds))
        .orderBy(asc(flightSegments.segmentOrder))

      for (const sched of newSchedules) {
        if (flightTypeParam && ['direct', 'transit'].includes(flightTypeParam)) {
          if (sched.flightType !== flightTypeParam) continue
        }

        const segs = newSegments.filter((s) => s.flightScheduleId === sched.id)
        if (segs.length === 0) continue
        const firstSeg = segs[0]
        const lastSeg = segs[segs.length - 1]
        const depTime = new Date(firstSeg.departureTime).getTime()
        const arrTime = new Date(lastSeg.arrivalTime).getTime()
        const totalDuration = Math.max(Math.round((arrTime - depTime) / (1000 * 60)), 30)

        matchedSchedules.push({
          schedule: sched,
          segments: segs,
          firstSegment: firstSeg,
          lastSegment: lastSeg,
          totalDuration,
          layoverWarning: null,
        })
      }
    }
  }

  if (matchedSchedules.length === 0) {
    return c.json({ error: false, data: [] })
  }

  // 6. Fetch available seats counts for matched schedules
  const matchedScheduleIds = matchedSchedules.map((m) => m.schedule.id)
  const seatCounts = await db
    .select({
      scheduleId: seats.flightScheduleId,
      seatClass: seats.seatClass,
      count: sql<number>`count(*)::int`,
    })
    .from(seats)
    .where(
      and(
        inArray(seats.flightScheduleId, matchedScheduleIds),
        eq(seats.isAvailable, true),
      ),
    )
    .groupBy(seats.flightScheduleId, seats.seatClass)

  const availableSeatsMap = new Map<number, { economy: number; business: number }>()
  for (const sc of seatCounts) {
    if (!sc.scheduleId) continue
    const current = availableSeatsMap.get(sc.scheduleId) || { economy: 0, business: 0 }
    if (sc.seatClass === 'business') {
      current.business = Number(sc.count)
    } else {
      current.economy = Number(sc.count)
    }
    availableSeatsMap.set(sc.scheduleId, current)
  }

  // 7. Filter by passenger capacity and class availability
  const validResults: Array<{
    item: any
    priceForSort: number
    duration: number
    firstDepartureHour: number
    flightType: string
    layoverWarning: 'short' | 'long' | null
  }> = []

  for (const m of matchedSchedules) {
    const seatAvail = availableSeatsMap.get(m.schedule.id) || { economy: 0, business: 0 }

    if (classParam === 'business') {
      if (seatAvail.business < passengers) continue
    } else if (classParam === 'economy') {
      if (seatAvail.economy < passengers) continue
    } else {
      // Must have enough seats in at least one class
      if (seatAvail.economy < passengers && seatAvail.business < passengers) continue
    }

    const priceEconomy = Number(m.schedule.priceEconomy)
    const priceBusiness = m.schedule.priceBusiness ? Number(m.schedule.priceBusiness) : null
    const priceForSort = classParam === 'business' && priceBusiness ? priceBusiness : priceEconomy

    const airline = airlineMap.get(m.schedule.airlineId!)
    const airplane = airplaneMap.get(m.schedule.airplaneId!)

    const enrichedSegments = m.segments.map((s) => {
      const orig = airportMap.get(s.originAirportId!)
      const dest = airportMap.get(s.destinationAirportId!)
      return {
        id: s.id,
        segment_order: s.segmentOrder,
        origin: orig
          ? { id: orig.id, code: orig.code, name: orig.name, city: orig.city }
          : null,
        destination: dest
          ? { id: dest.id, code: dest.code, name: dest.name, city: dest.city }
          : null,
        departure_time: s.departureTime.toISOString(),
        arrival_time: s.arrivalTime.toISOString(),
        transit_duration_minutes: s.transitDurationMinutes,
      }
    })

    const depHour = new Date(m.firstSegment.departureTime).getUTCHours() + 7 // approximate WIB

    validResults.push({
      item: {
        id: m.schedule.id,
        flight_number: m.schedule.flightNumber,
        airline: airline
          ? { id: airline.id, name: airline.name, code: airline.code, logo: airline.logo }
          : null,
        airplane: airplane
          ? { id: airplane.id, model: airplane.model, registration_number: airplane.registrationNumber }
          : null,
        flight_type: m.schedule.flightType,
        status: m.schedule.status || 'scheduled',
        delay_minutes: m.schedule.delayMinutes || 0,
        status_synced_at: m.schedule.statusSyncedAt ? m.schedule.statusSyncedAt.toISOString() : null,
        segments: enrichedSegments,
        price_economy: priceEconomy,
        price_business: priceBusiness,
        available_seats_economy: seatAvail.economy,
        available_seats_business: seatAvail.business,
        total_duration_minutes: m.totalDuration,
        layover_warning: m.layoverWarning,
        value_score: 0, // computed below
      },
      priceForSort,
      duration: m.totalDuration,
      firstDepartureHour: depHour,
      flightType: m.schedule.flightType,
      layoverWarning: m.layoverWarning,
    })
  }

  if (validResults.length === 0) {
    return c.json({ error: false, data: [] })
  }

  // 8. Calculate relative value_score (0-100)
  const prices = validResults.map((r) => r.priceForSort)
  const durations = validResults.map((r) => r.duration)

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const minDur = Math.min(...durations)
  const maxDur = Math.max(...durations)

  const priceDiff = maxPrice - minPrice
  const durDiff = maxDur - minDur

  for (const r of validResults) {
    // Price score (50%): lower price is better
    const priceScore = priceDiff === 0 ? 100 : ((maxPrice - r.priceForSort) / priceDiff) * 100

    // Duration score (30%): shorter duration is better
    const durScore = durDiff === 0 ? 100 : ((maxDur - r.duration) / durDiff) * 100

    // Departure time score (10%): prime time 08:00 - 18:00
    const h = ((r.firstDepartureHour % 24) + 24) % 24
    let depScore = 50
    if (h >= 8 && h <= 18) depScore = 100
    else if ((h >= 6 && h < 8) || (h > 18 && h <= 21)) depScore = 80
    else if (h > 21 || h < 24) depScore = 65

    // Transit score (10%): direct gets 100, ideal transit 75, bad transit lower
    let transitScore = 100
    if (r.flightType === 'transit') {
      if (r.layoverWarning === 'short') transitScore = 30
      else if (r.layoverWarning === 'long') transitScore = 45
      else transitScore = 75
    }

    const valueScore = Math.round(
      0.50 * priceScore + 0.30 * durScore + 0.10 * depScore + 0.10 * transitScore,
    )
    r.item.value_score = Math.max(10, Math.min(100, valueScore))
  }

  // 9. Sorting
  if (sortParam === 'duration') {
    validResults.sort((a, b) => a.duration - b.duration)
  } else if (sortParam === 'value') {
    validResults.sort((a, b) => b.item.value_score - a.item.value_score)
  } else {
    // Default: 'price'
    validResults.sort((a, b) => a.priceForSort - b.priceForSort)
  }

  return c.json({
    error: false,
    data: validResults.map((r) => r.item),
  })
})

/**
 * GET /api/flights/price-calendar (CAL-01)
 * Query params: origin, destination, date, passengers, class, days
 */
customerFlightsRoute.get('/price-calendar', async (c) => {
  const originParam = c.req.query('origin')
  const destinationParam = c.req.query('destination')
  const dateParam = c.req.query('date')
  const passengersParam = Number(c.req.query('passengers') || 1)
  const classParam = c.req.query('class') === 'business' ? 'business' : 'economy'
  const daysParam = Math.min(Math.max(Number(c.req.query('days') || 7), 3), 14)

  if (!originParam || !destinationParam || !dateParam) {
    return c.json(
      {
        error: true,
        message: 'Parameter origin, destination, dan date wajib diisi',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const passengers = isNaN(passengersParam) || passengersParam < 1 ? 1 : passengersParam

  const originAirport = await resolveAirport(originParam)
  const destAirport = await resolveAirport(destinationParam)

  if (!originAirport || !destAirport) {
    return c.json(
      {
        error: true,
        message: 'Bandara asal atau tujuan tidak ditemukan',
        code: 'AIRPORT_NOT_FOUND',
      },
      404,
    )
  }

  // Construct day window around anchor date - hari sebelumnya dihilangkan (min date adalah hari ini)
  const anchor = new Date(dateParam)
  if (isNaN(anchor.getTime())) {
    return c.json(
      {
        error: true,
        message: 'Format tanggal date tidak valid (YYYY-MM-DD)',
        code: 'INVALID_DATE',
      },
      400,
    )
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTime = new Date(todayStr + 'T00:00:00').getTime()
  const anchorTime = new Date(dateParam + 'T00:00:00').getTime()

  // Anchor tidak boleh di masa lalu
  const validAnchorTime = Math.max(anchorTime, todayTime)
  const anchorDate = new Date(validAnchorTime)

  const halfWindow = Math.floor(daysParam / 2)
  const candidateStartDate = new Date(anchorDate)
  candidateStartDate.setDate(candidateStartDate.getDate() - halfWindow)

  // Hari di masa lalu sebelum hari ini dihilangkan
  const effectiveStartDate =
    candidateStartDate.getTime() < todayTime ? new Date(todayTime) : candidateStartDate

  const calendarDates: string[] = []
  for (let i = 0; i < daysParam; i++) {
    const d = new Date(effectiveStartDate)
    d.setDate(effectiveStartDate.getDate() + i)
    calendarDates.push(d.toISOString().slice(0, 10))
  }

  // Fetch candidate schedules
  const candidateSchedules = await db
    .select({
      id: flightSchedules.id,
      priceEconomy: flightSchedules.priceEconomy,
      priceBusiness: flightSchedules.priceBusiness,
      status: flightSchedules.status,
    })
    .from(flightSchedules)
    .where(sql`${flightSchedules.status} != 'cancelled'`)

  if (candidateSchedules.length === 0) {
    const emptyCalendar = calendarDates.map((date) => ({ date, lowest_price: null }))
    return c.json({ error: false, data: emptyCalendar })
  }

  const scheduleIds = candidateSchedules.map((s) => s.id)

  // Fetch segments
  const allSegments = await db
    .select()
    .from(flightSegments)
    .where(inArray(flightSegments.flightScheduleId, scheduleIds))
    .orderBy(asc(flightSegments.segmentOrder))

  const segmentsBySchedule = new Map<number, typeof allSegments>()
  for (const seg of allSegments) {
    const list = segmentsBySchedule.get(seg.flightScheduleId!) || []
    list.push(seg)
    segmentsBySchedule.set(seg.flightScheduleId!, list)
  }

  // Count available seats per schedule and class
  const seatCounts = await db
    .select({
      scheduleId: seats.flightScheduleId,
      seatClass: seats.seatClass,
      count: sql<number>`count(*)::int`,
    })
    .from(seats)
    .where(
      and(
        inArray(seats.flightScheduleId, scheduleIds),
        eq(seats.isAvailable, true),
      ),
    )
    .groupBy(seats.flightScheduleId, seats.seatClass)

  const availableSeatsMap = new Map<number, { economy: number; business: number }>()
  for (const sc of seatCounts) {
    if (!sc.scheduleId) continue
    const current = availableSeatsMap.get(sc.scheduleId) || { economy: 0, business: 0 }
    if (sc.seatClass === 'business') current.business = Number(sc.count)
    else current.economy = Number(sc.count)
    availableSeatsMap.set(sc.scheduleId, current)
  }

  // Group schedules by departure date YYYY-MM-DD
  const pricesByDate = new Map<string, number[]>()
  for (const dateStr of calendarDates) {
    pricesByDate.set(dateStr, [])
  }

  for (const schedule of candidateSchedules) {
    const segs = segmentsBySchedule.get(schedule.id)
    if (!segs || segs.length === 0) continue

    const firstSeg = segs[0]
    const lastSeg = segs[segs.length - 1]

    if (firstSeg.originAirportId !== originAirport.id || lastSeg.destinationAirportId !== destAirport.id) {
      continue
    }

    const seatAvail = availableSeatsMap.get(schedule.id) || { economy: 0, business: 0 }
    const availableInClass = classParam === 'business' ? seatAvail.business : seatAvail.economy
    if (availableInClass < passengers) continue

    const depIsoDate = new Date(firstSeg.departureTime).toISOString().slice(0, 10)
    const list = pricesByDate.get(depIsoDate)
    if (list) {
      const price = classParam === 'business' && schedule.priceBusiness
        ? Number(schedule.priceBusiness)
        : Number(schedule.priceEconomy)
      list.push(price)
    }
  }

  const responseCalendar = calendarDates.map((date) => {
    const pricesList = pricesByDate.get(date) || []
    const lowest_price = pricesList.length > 0 ? Math.min(...pricesList) : null
    return {
      date,
      lowest_price,
    }
  })

  return c.json({
    error: false,
    data: responseCalendar,
  })
})

/**
 * GET /api/flights/:id
 * Detail 1 flight schedule with full segments and seats for seat map
 */
customerFlightsRoute.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [schedule] = await db
    .select()
    .from(flightSchedules)
    .where(eq(flightSchedules.id, id))
    .limit(1)

  if (!schedule) {
    return c.json({ error: true, message: 'Jadwal penerbangan tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  const [airline] = schedule.airlineId
    ? await db.select().from(airlines).where(eq(airlines.id, schedule.airlineId)).limit(1)
    : [null]

  const [airplane] = schedule.airplaneId
    ? await db.select().from(airplanes).where(eq(airplanes.id, schedule.airplaneId)).limit(1)
    : [null]

  // Fetch segments
  const segmentsList = await db
    .select()
    .from(flightSegments)
    .where(eq(flightSegments.flightScheduleId, id))
    .orderBy(asc(flightSegments.segmentOrder))

  // Fetch airport metadata
  const allAirports = await db.select().from(airports)
  const airportMap = new Map(allAirports.map((a) => [a.id, a]))

  const enrichedSegments = segmentsList.map((s) => {
    const orig = airportMap.get(s.originAirportId!)
    const dest = airportMap.get(s.destinationAirportId!)
    return {
      id: s.id,
      segment_order: s.segmentOrder,
      origin: orig ? { id: orig.id, code: orig.code, name: orig.name, city: orig.city } : null,
      destination: dest ? { id: dest.id, code: dest.code, name: dest.name, city: dest.city } : null,
      departure_time: s.departureTime.toISOString(),
      arrival_time: s.arrivalTime.toISOString(),
      transit_duration_minutes: s.transitDurationMinutes,
    }
  })

  // Fetch seats for seat map
  const seatList = await db
    .select({
      id: seats.id,
      seat_number: seats.seatNumber,
      seat_class: seats.seatClass,
      is_available: seats.isAvailable,
    })
    .from(seats)
    .where(eq(seats.flightScheduleId, id))
    .orderBy(asc(seats.seatNumber))

  return c.json({
    error: false,
    data: {
      id: schedule.id,
      flight_number: schedule.flightNumber,
      airline: airline ? { id: airline.id, name: airline.name, code: airline.code, logo: airline.logo } : null,
      airplane: airplane ? { id: airplane.id, model: airplane.model, registration_number: airplane.registrationNumber } : null,
      flight_type: schedule.flightType,
      price_economy: Number(schedule.priceEconomy),
      price_business: schedule.priceBusiness ? Number(schedule.priceBusiness) : null,
      status: schedule.status,
      delay_minutes: schedule.delayMinutes,
      status_synced_at: schedule.statusSyncedAt ? schedule.statusSyncedAt.toISOString() : null,
      source: schedule.source,
      segments: enrichedSegments,
      seats: seatList,
    },
  })
})

export default customerFlightsRoute
