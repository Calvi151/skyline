import 'dotenv/config'
import { db } from './index.js'
import {
  flightSchedules,
  flightSegments,
  airplanes,
  airlines,
  airports,
  bookings,
  bookingPassengers,
  checkIns,
  seats,
  baggageOptions,
  users,
  payments,
  refunds,
  flightNotifications,
} from './schema.js'
import { eq, inArray } from 'drizzle-orm'

async function run() {
  console.log('✈️ Seeding Realistic Passenger Manifest for Flight 1 (Garuda Indonesia GA-402)...')

  // 1. Ensure Airline GA and Airplane PK-GAA exist
  let [garuda] = await db.select().from(airlines).where(eq(airlines.code, 'GA')).limit(1)
  if (!garuda) {
    const [created] = await db
      .insert(airlines)
      .values({
        name: 'Garuda Indonesia',
        code: 'GA',
        logo: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=128&q=80',
      })
      .returning()
    garuda = created
  }

  let [plane] = await db
    .select()
    .from(airplanes)
    .where(eq(airplanes.registrationNumber, 'PK-GAA'))
    .limit(1)

  if (!plane) {
    const [created] = await db
      .insert(airplanes)
      .values({
        airlineId: garuda.id,
        registrationNumber: 'PK-GAA',
        model: 'Boeing 737-800 NextGen',
        totalSeatEconomy: 168,
        totalSeatBusiness: 12,
      })
      .returning()
    plane = created
  }

  // 2. Set Flight 1 Schedule & Segment
  const now = new Date()
  const depTime = new Date(now)
  depTime.setHours(8, 55, 0, 0)
  const arrTime = new Date(depTime)
  arrTime.setHours(11, 45, 0, 0)

  await db
    .update(flightSchedules)
    .set({
      flightNumber: 'GA-402',
      airlineId: garuda.id,
      airplaneId: plane.id,
      flightType: 'direct',
      priceEconomy: '1450000.00',
      priceBusiness: '3200000.00',
      status: 'scheduled',
      delayMinutes: 0,
    })
    .where(eq(flightSchedules.id, 1))

  // Update segment
  const [cgk] = await db.select().from(airports).where(eq(airports.code, 'CGK')).limit(1)
  const [dps] = await db.select().from(airports).where(eq(airports.code, 'DPS')).limit(1)

  const segs = await db.select().from(flightSegments).where(eq(flightSegments.flightScheduleId, 1))
  if (segs.length > 0) {
    await db
      .update(flightSegments)
      .set({
        originAirportId: cgk ? cgk.id : 1,
        destinationAirportId: dps ? dps.id : 2,
        departureTime: depTime,
        arrivalTime: arrTime,
      })
      .where(eq(flightSegments.id, segs[0].id))
  } else {
    await db.insert(flightSegments).values({
      flightScheduleId: 1,
      segmentOrder: 1,
      originAirportId: cgk ? cgk.id : 1,
      destinationAirportId: dps ? dps.id : 2,
      departureTime: depTime,
      arrivalTime: arrTime,
    })
  }

  // 3. Find Customer User for Bookings
  const [customerUser] = await db.select().from(users).limit(1)
  const userId = customerUser ? customerUser.id : 1

  // 4. Get Seats for Flight 1
  const allSeats = await db.select().from(seats).where(eq(seats.flightScheduleId, 1))
  const seatByNum = new Map(allSeats.map((s) => [s.seatNumber, s]))

  // 5. Get Baggage Options
  const bagOptions = await db.select().from(baggageOptions)
  const bag20 = bagOptions.find((b) => b.weightKg === 20) || bagOptions[0]
  const bag30 = bagOptions.find((b) => b.weightKg === 30) || bagOptions[0]
  const bag10 = bagOptions.find((b) => b.weightKg === 10) || bagOptions[0]
  const bagCabin = bagOptions.find((b) => b.weightKg === 7) || null

  // 6. Delete old bookings for flight 1 to have clean, realistic manifest data
  const oldBookings = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.flightScheduleId, 1))
  if (oldBookings.length > 0) {
    const oldIds = oldBookings.map((b) => b.id)
    const oldPax = await db.select({ id: bookingPassengers.id }).from(bookingPassengers).where(inArray(bookingPassengers.bookingId, oldIds))
    if (oldPax.length > 0) {
      const oldPaxIds = oldPax.map((p) => p.id)
      await db.delete(checkIns).where(inArray(checkIns.bookingPassengerId, oldPaxIds))
      await db.delete(bookingPassengers).where(inArray(bookingPassengers.id, oldPaxIds))
    }
    await db.delete(payments).where(inArray(payments.bookingId, oldIds))
    await db.delete(refunds).where(inArray(refunds.bookingId, oldIds))
    await db.delete(flightNotifications).where(inArray(flightNotifications.bookingId, oldIds))
    await db.delete(bookings).where(inArray(bookings.id, oldIds))
  }

  // 7. Define 18 realistic passengers across Business and Economy
  const passengerDefinitions = [
    // ── Business Class ──
    {
      pnr: 'GA8K2N',
      name: 'Dr. Hendra Wijaya',
      gender: 'male' as const,
      seatClass: 'business' as const,
      seatNumber: '1A',
      idNumber: '3171012304780001',
      birthDate: '1978-04-23',
      baggage: bag30,
      status: 'boarded' as const,
      boardingPass: 'BP-GA8K2N-01-WIJ',
      ssr: 'NIL',
    },
    {
      pnr: 'GA8K2N',
      name: 'Prof. Siti Nurhaliza',
      gender: 'female' as const,
      seatClass: 'business' as const,
      seatNumber: '1C',
      idNumber: '3201026508820002',
      birthDate: '1982-08-25',
      baggage: bag30,
      status: 'boarded' as const,
      boardingPass: 'BP-GA8K2N-02-NUR',
      ssr: 'NIL',
    },
    {
      pnr: 'GAB82M',
      name: 'Kevin Sanjaya',
      gender: 'male' as const,
      seatClass: 'business' as const,
      seatNumber: '2A',
      idNumber: '3172031502950003',
      birthDate: '1995-02-15',
      baggage: bag20,
      status: 'checked_in' as const,
      boardingPass: 'BP-GAB82M-03-SAN',
      ssr: 'NIL',
    },
    // ── Economy Class ──
    {
      pnr: 'GAP94L',
      name: 'Budi Santoso',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '10A',
      idNumber: '3171011501900001',
      birthDate: '1990-01-15',
      baggage: bag20,
      status: 'boarded' as const,
      boardingPass: 'BP-GAP94L-04-SAN',
      ssr: 'NIL',
    },
    {
      pnr: 'GAP94L',
      name: 'Dian Sastrowardoyo',
      gender: 'female' as const,
      seatClass: 'economy' as const,
      seatNumber: '10B',
      idNumber: '3174025603820004',
      birthDate: '1982-03-16',
      baggage: bag20,
      status: 'boarded' as const,
      boardingPass: 'BP-GAP94L-05-SAS',
      ssr: 'NIL',
    },
    {
      pnr: 'GA3M8X',
      name: 'Anthony Sinisuka',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '10C',
      idNumber: '3273012010960005',
      birthDate: '1996-10-20',
      baggage: bag10,
      status: 'boarded' as const,
      boardingPass: 'BP-GA3M8X-06-SIN',
      ssr: 'NIL',
    },
    {
      pnr: 'GA9V2C',
      name: 'Maya Indah Lestari',
      gender: 'female' as const,
      seatClass: 'economy' as const,
      seatNumber: '11A',
      idNumber: '3175046209930006',
      birthDate: '1993-09-22',
      baggage: bag20,
      status: 'boarded' as const,
      boardingPass: 'BP-GA9V2C-07-LES',
      ssr: 'NIL',
    },
    {
      pnr: 'GA9V2C',
      name: 'Ahmad Dahlan',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '11B',
      idNumber: '3302051205880007',
      birthDate: '1988-05-12',
      baggage: bag20,
      status: 'boarded' as const,
      boardingPass: 'BP-GA9V2C-08-DAH',
      ssr: 'NIL',
    },
    {
      pnr: 'GA5T9R',
      name: 'Dewi Sartika',
      gender: 'female' as const,
      seatClass: 'economy' as const,
      seatNumber: '12A',
      idNumber: '3271034407940008',
      birthDate: '1994-07-04',
      baggage: bag20,
      status: 'checked_in' as const,
      boardingPass: 'BP-GA5T9R-09-SAR',
      ssr: 'NIL',
    },
    {
      pnr: 'GA5T9R',
      name: 'Reza Rahadian',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '12B',
      idNumber: '3171020503870009',
      birthDate: '1987-03-05',
      baggage: bag20,
      status: 'checked_in' as const,
      boardingPass: 'BP-GA5T9R-10-RAH',
      ssr: 'NIL',
    },
    {
      pnr: 'GA2W4Q',
      name: 'Michael Chang',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '14A',
      idNumber: 'C8912401',
      birthDate: '1989-11-14',
      baggage: bag30,
      status: 'checked_in' as const,
      boardingPass: 'BP-GA2W4Q-11-CHA',
      ssr: 'VGML (Vegetarian)',
    },
    {
      pnr: 'GA1N8D',
      name: 'Sri Mulyani Indrawati',
      gender: 'female' as const,
      seatClass: 'economy' as const,
      seatNumber: '14B',
      idNumber: '3172016608620010',
      birthDate: '1962-08-26',
      baggage: bag20,
      status: 'boarded' as const,
      boardingPass: 'BP-GA1N8D-12-MUL',
      ssr: 'NIL',
    },
    {
      pnr: 'GA7E3S',
      name: 'Bambang Pamungkas',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '15A',
      idNumber: '3374021006800011',
      birthDate: '1980-06-10',
      baggage: bag20,
      status: 'boarded' as const,
      boardingPass: 'BP-GA7E3S-13-PAM',
      ssr: 'NIL',
    },
    {
      pnr: 'GA7E3S',
      name: 'Nadya Putri Utami',
      gender: 'female' as const,
      seatClass: 'economy' as const,
      seatNumber: '15B',
      idNumber: '3201035212970012',
      birthDate: '1997-12-10',
      baggage: bag10,
      status: 'boarded' as const,
      boardingPass: 'BP-GA7E3S-14-PUT',
      ssr: 'NIL',
    },
    {
      pnr: 'GA4K9L',
      name: 'Joko Purnomo',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '16A',
      idNumber: '3578011804750013',
      birthDate: '1975-04-18',
      baggage: bag20,
      status: 'boarded' as const,
      boardingPass: 'BP-GA4K9L-15-PUR',
      ssr: 'WCHR (Wheelchair)',
    },
    {
      pnr: 'GA6J1H',
      name: 'Ratna Sarumpaet',
      gender: 'female' as const,
      seatClass: 'economy' as const,
      seatNumber: '17C',
      idNumber: '3171025607520014',
      birthDate: '1952-07-16',
      baggage: bag20,
      status: 'not_checked_in' as const,
      boardingPass: null,
      ssr: 'NIL',
    },
    {
      pnr: 'GA8Y5B',
      name: 'Farhan Alatas',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '18D',
      idNumber: '3173041409980015',
      birthDate: '1998-09-14',
      baggage: bagCabin,
      status: 'not_checked_in' as const,
      boardingPass: null,
      ssr: 'NIL',
    },
    {
      pnr: 'GA0R4K',
      name: 'Denny Sumargo',
      gender: 'male' as const,
      seatClass: 'economy' as const,
      seatNumber: '20A',
      idNumber: '3174031110810016',
      birthDate: '1981-10-11',
      baggage: bag20,
      status: 'no_show' as const,
      boardingPass: 'BP-GA0R4K-18-SUM',
      ssr: 'NIL',
    },
  ]

  // Group passengers by PNR to create bookings
  const pnrMap = new Map<string, typeof passengerDefinitions>()
  for (const pax of passengerDefinitions) {
    const list = pnrMap.get(pax.pnr) || []
    list.push(pax)
    pnrMap.set(pax.pnr, list)
  }

  for (const [pnr, groupPax] of pnrMap.entries()) {
    const totalPrice = (
      groupPax.reduce((sum, p) => sum + (p.seatClass === 'business' ? 3200000 : 1450000), 0)
    ).toFixed(2)

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingCode: pnr,
        userId,
        flightScheduleId: 1,
        bookingDate: new Date(),
        totalPrice,
        status: 'paid',
      })
      .returning()

    for (const pax of groupPax) {
      const seat = seatByNum.get(pax.seatNumber)

      const [bpPax] = await db
        .insert(bookingPassengers)
        .values({
          bookingId: booking.id,
          seatId: seat ? seat.id : null,
          baggageOptionId: pax.baggage ? pax.baggage.id : null,
          fullName: pax.name,
          idNumber: pax.idNumber,
          birthDate: pax.birthDate,
          gender: pax.gender,
          seatClass: pax.seatClass,
        })
        .returning()

      if (seat) {
        await db.update(seats).set({ isAvailable: false }).where(eq(seats.id, seat.id))
      }

      if (pax.status !== 'not_checked_in') {
        const checkinTime = new Date()
        checkinTime.setMinutes(checkinTime.getMinutes() - 45)

        await db.insert(checkIns).values({
          bookingPassengerId: bpPax.id,
          boardingPassCode: pax.boardingPass,
          checkedInAt: checkinTime,
          status: pax.status,
        })
      }
    }
  }

  console.log('✅ Realistic Passenger Manifest seeded successfully for GA-402!')
  console.log(`   - 18 Passengers (3 Business, 15 Economy)`)
  console.log(`   - 11 Boarded, 4 Checked-in, 2 Not Checked-in, 1 No-Show`)
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Error seeding manifest:', err)
  process.exit(1)
})
