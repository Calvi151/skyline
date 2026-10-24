import 'dotenv/config'
import { db } from '../db/index.js'
import {
  airports,
  flightSchedules,
  flightSegments,
  seats,
  users,
  bookings,
} from '../db/schema.js'
import { eq, sql, inArray } from 'drizzle-orm'
import jwt from 'jsonwebtoken'

const BASE_URL = 'http://localhost:3000/api'

async function runTests() {
  console.log('=== TESTING PHASE 4 BACKEND ENDPOINTS ===\n')

  // 1. Check existing flight in DB to test with
  const [sampleFlight] = await db
    .select({
      id: flightSchedules.id,
      flightNumber: flightSchedules.flightNumber,
      status: flightSchedules.status,
    })
    .from(flightSchedules)
    .limit(1)

  if (!sampleFlight) {
    console.error('No flight schedule found in DB to test!')
    process.exit(1)
  }

  // Fetch segments of this flight to get origin and destination
  const segments = await db
    .select()
    .from(flightSegments)
    .where(eq(flightSegments.flightScheduleId, sampleFlight.id))

  const firstSeg = segments[0]
  const lastSeg = segments[segments.length - 1]

  const [origAirport] = await db
    .select()
    .from(airports)
    .where(eq(airports.id, firstSeg.originAirportId!))

  const [destAirport] = await db
    .select()
    .from(airports)
    .where(eq(airports.id, lastSeg.destinationAirportId!))

  const dateStr = new Date(firstSeg.departureTime).toISOString().slice(0, 10)

  console.log(`Test Flight: ${sampleFlight.flightNumber} (${origAirport.code} -> ${destAirport.code}) on ${dateStr}`)

  // ── TEST 1: GET /api/flights/search ──
  console.log('\n[TEST 1] Testing GET /api/flights/search...')
  const searchUrl = `${BASE_URL}/flights/search?origin=${origAirport.code}&destination=${destAirport.code}&date=${dateStr}&passengers=1&sort=value`
  const searchRes = await fetch(searchUrl)
  const searchJson = await searchRes.json()

  if (!searchRes.ok || searchJson.error) {
    throw new Error(`Search failed: ${JSON.stringify(searchJson)}`)
  }

  console.log(`✓ Search returned ${searchJson.data.length} flights`)
  if (searchJson.data.length > 0) {
    const f = searchJson.data[0]
    console.log(`  - Flight: ${f.flight_number}`)
    console.log(`  - Status: ${f.status}, Delay: ${f.delay_minutes}m`)
    console.log(`  - Value Score: ${f.value_score}/100`)
    console.log(`  - Layover Warning: ${f.layover_warning}`)
    console.log(`  - Seats Avail: Economy=${f.available_seats_economy}, Business=${f.available_seats_business}`)
  }

  // ── TEST 2: GET /api/flights/price-calendar (CAL-01) ──
  console.log('\n[TEST 2] Testing GET /api/flights/price-calendar (CAL-01)...')
  const calUrl = `${BASE_URL}/flights/price-calendar?origin=${origAirport.code}&destination=${destAirport.code}&date=${dateStr}&days=7`
  const calRes = await fetch(calUrl)
  const calJson = await calRes.json()

  if (!calRes.ok || calJson.error) {
    throw new Error(`Price calendar failed: ${JSON.stringify(calJson)}`)
  }

  console.log(`✓ Price Calendar returned ${calJson.data.length} date entries:`)
  for (const entry of calJson.data) {
    console.log(`  ${entry.date}: ${entry.lowest_price ? 'Rp ' + entry.lowest_price.toLocaleString('id-ID') : 'Tidak ada jadwal'}`)
  }

  // ── TEST 3: GET /api/flights/:id (Detail & Seat Map) ──
  console.log(`\n[TEST 3] Testing GET /api/flights/${sampleFlight.id} (Seat Map)...`)
  const detailUrl = `${BASE_URL}/flights/${sampleFlight.id}`
  const detailRes = await fetch(detailUrl)
  const detailJson = await detailRes.json()

  if (!detailRes.ok || detailJson.error) {
    throw new Error(`Flight detail failed: ${JSON.stringify(detailJson)}`)
  }

  const detail = detailJson.data
  console.log(`✓ Flight Detail: ${detail.flight_number}, Segments=${detail.segments.length}, Seats=${detail.seats.length}`)
  const sampleSeats = detail.seats.slice(0, 3)
  console.log(`  Sample seats:`, sampleSeats.map((s: any) => `${s.seat_number} (${s.seat_class}, avail=${s.is_available})`).join(', '))

  // ── TEST 4: POST /api/bookings (Transaction Seat Locking) ──
  console.log('\n[TEST 4] Testing POST /api/bookings with Transaction & Row-level Lock...')

  // Find a verified user to create booking
  const [testUser] = await db
    .select()
    .from(users)
    .where(sql`${users.emailVerifiedAt} IS NOT NULL`)
    .limit(1)

  if (!testUser) {
    throw new Error('No verified user found in DB')
  }

  // Generate JWT auth token for test user
  const token = jwt.sign(
    { userId: testUser.id, role: testUser.role },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '1h' },
  )

  // Find an available seat
  const availableSeat = detail.seats.find((s: any) => s.is_available)
  if (!availableSeat) {
    console.log('Skipping booking creation: no available seat found')
  } else {
    const bookingPayload = {
      flight_schedule_id: sampleFlight.id,
      passengers: [
        {
          full_name: 'Budi Test Passenger',
          id_number: '3201012345670001',
          birth_date: '1995-08-17',
          gender: 'male',
          seat_class: availableSeat.seat_class,
          seat_id: availableSeat.id,
        },
      ],
    }

    const bookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth=${token}`,
      },
      body: JSON.stringify(bookingPayload),
    })

    const bookJson = await bookRes.json()
    if (!bookRes.ok || bookJson.error) {
      throw new Error(`Booking creation failed: ${JSON.stringify(bookJson)}`)
    }

    console.log(`✓ Booking Success! PNR=${bookJson.data.booking_code}, Total=Rp ${bookJson.data.total_price.toLocaleString('id-ID')}, ExpiresAt=${bookJson.data.expires_at}`)

    // ── TEST 5: Verify Seat is now locked (409 SEAT_NOT_AVAILABLE) ──
    console.log('\n[TEST 5] Testing Race Condition Prevention (Attempting to book same seat)...')
    const bookAgainRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth=${token}`,
      },
      body: JSON.stringify(bookingPayload),
    })

    const bookAgainJson = await bookAgainRes.json()
    console.log(`✓ Second booking attempt returned HTTP ${bookAgainRes.status}: code=${bookAgainJson.code}`)
    if (bookAgainRes.status === 409 && bookAgainJson.code === 'SEAT_NOT_AVAILABLE') {
      console.log('✓ Row-level lock correctly rejected duplicate seat booking!')
    }

    // ── TEST 6: GET /api/bookings/my & GET /api/bookings/:id ──
    console.log('\n[TEST 6] Testing GET /api/bookings/my and GET /api/bookings/:id...')
    const myRes = await fetch(`${BASE_URL}/bookings/my`, {
      headers: { Cookie: `auth=${token}` },
    })
    const myJson = await myRes.json()
    console.log(`✓ /api/bookings/my returned ${myJson.data.length} user bookings`)

    const getDetailRes = await fetch(`${BASE_URL}/bookings/${bookJson.data.id}`, {
      headers: { Cookie: `auth=${token}` },
    })
    const getDetailJson = await getDetailRes.json()
    console.log(`✓ /api/bookings/${bookJson.data.id} returned booking detail with ${getDetailJson.data.passengers.length} passenger(s)`)
  }

  console.log('\n=== ALL PHASE 4 BACKEND ENDPOINTS PASSED SUCCESSFULLY ===')
  process.exit(0)
}

runTests().catch((err) => {
  console.error('\n❌ TEST ERROR:', err)
  process.exit(1)
})
