import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { db } from './index.js'
import { airports, airlines, airplanes, baggageOptions } from './schema.js'
import { eq, sql } from 'drizzle-orm'

interface JsonAirport {
  icao?: string
  iata?: string
  name?: string
  city?: string
  state?: string
  country?: string
  elevation?: number
  lat?: number
  lon?: number
  tz?: string
}

interface JsonAirline {
  name: string
  code: string
  is_lowcost?: boolean
  logo?: string | null
}

async function seedFromJson() {
  console.log('🚀 Memulai proses impor data Bandara & Maskapai dari JSON...')

  // 1. IMPORT AIRPORTS
  const airportsFilePath = path.resolve(process.cwd(), 'airports.json')
  if (fs.existsSync(airportsFilePath)) {
    console.log('📂 Membaca airports.json...')
    const rawAirports = JSON.parse(fs.readFileSync(airportsFilePath, 'utf8'))

    // Filter valid 3-letter IATA code
    const validAirports: Array<{
      code: string
      name: string
      city: string
      country: string
      timezone: string | null
    }> = []

    const seenIata = new Set<string>()

    for (const key of Object.keys(rawAirports)) {
      const item: JsonAirport = rawAirports[key]
      if (!item.iata || !/^[A-Z]{3}$/i.test(item.iata)) continue

      const code = item.iata.trim().toUpperCase()
      if (seenIata.has(code)) continue
      seenIata.add(code)

      const name = (item.name || `Bandara ${code}`).trim().substring(0, 100)
      const city = (item.city || item.state || name).trim().substring(0, 100)
      const country = (item.country || 'Unknown').trim().substring(0, 100)
      const timezone = item.tz ? item.tz.trim().substring(0, 50) : null

      validAirports.push({
        code,
        name,
        city,
        country,
        timezone,
      })
    }

    console.log(`✈️ Ditemukan ${validAirports.length} bandara dengan kode IATA valid. Menyimpan ke database...`)

    // Batch upsert in chunks of 500
    const chunkSize = 500
    let inserted = 0

    for (let i = 0; i < validAirports.length; i += chunkSize) {
      const chunk = validAirports.slice(i, i + chunkSize)
      await db
        .insert(airports)
        .values(chunk)
        .onConflictDoUpdate({
          target: airports.code,
          set: {
            name: sql`excluded.name`,
            city: sql`excluded.city`,
            country: sql`excluded.country`,
            timezone: sql`excluded.timezone`,
          },
        })
      inserted += chunk.length
      process.stdout.write(`\r   Progress Bandara: ${inserted} / ${validAirports.length}`)
    }
    console.log('\n✅ Bandara berhasil diimpor & disinkronkan!')
  } else {
    console.warn('⚠️ File airports.json tidak ditemukan!')
  }

  // 2. IMPORT AIRLINES
  const airlinesFilePath = path.resolve(process.cwd(), 'airlines.json')
  if (fs.existsSync(airlinesFilePath)) {
    console.log('\n📂 Membaca airlines.json...')
    const rawAirlines: JsonAirline[] = JSON.parse(fs.readFileSync(airlinesFilePath, 'utf8'))

    const validAirlines: Array<{
      code: string
      name: string
      logo: string | null
    }> = []

    const seenAirlineCode = new Set<string>()

    for (const item of rawAirlines) {
      if (!item.code || typeof item.code !== 'string') continue
      const code = item.code.trim().toUpperCase()
      if (code.length < 2 || code.length > 10) continue
      if (seenAirlineCode.has(code)) continue
      seenAirlineCode.add(code)

      const name = (item.name || `Maskapai ${code}`).trim().substring(0, 100)
      const logo = item.logo ? item.logo.trim().substring(0, 255) : null

      validAirlines.push({
        code,
        name,
        logo,
      })
    }

    console.log(`✈️ Ditemukan ${validAirlines.length} maskapai dengan kode valid. Menyimpan ke database...`)

    // Batch upsert in chunks of 200
    const chunkSize = 200
    let inserted = 0

    for (let i = 0; i < validAirlines.length; i += chunkSize) {
      const chunk = validAirlines.slice(i, i + chunkSize)
      await db
        .insert(airlines)
        .values(chunk)
        .onConflictDoUpdate({
          target: airlines.code,
          set: {
            name: sql`excluded.name`,
            logo: sql`excluded.logo`,
          },
        })
      inserted += chunk.length
      process.stdout.write(`\r   Progress Maskapai: ${inserted} / ${validAirlines.length}`)
    }
    console.log('\n✅ Maskapai berhasil diimpor & disinkronkan!')
  } else {
    console.warn('⚠️ File airlines.json tidak ditemukan!')
  }

  // 3. Ensure Default Airplanes exist for major airlines (DAT-05)
  console.log('\n🛫 Memeriksa armada default maskapai...')
  const allAirlines = await db.select({ id: airlines.id, code: airlines.code, name: airlines.name }).from(airlines)
  const existingPlanes = await db.select().from(airplanes)
  const planeAirlineIds = new Set(existingPlanes.map((p) => p.airlineId).filter(Boolean))

  const defaultSeatsEconomy = Number(process.env.DEFAULT_AIRPLANE_SEATS_ECONOMY || 150)
  const defaultSeatsBusiness = Number(process.env.DEFAULT_AIRPLANE_SEATS_BUSINESS || 12)

  // Prioritize Indonesian and major airlines for default planes
  const priorityCodes = new Set(['GA', 'ID', 'QG', 'JT', 'IW', 'IU', 'SJ', 'QZ', 'ZZ', 'SQ', 'MH', 'EK', 'QR', 'TG'])
  let planesAdded = 0

  for (const al of allAirlines) {
    if (!al.code) continue
    if (priorityCodes.has(al.code) && !planeAirlineIds.has(al.id)) {
      const regNumber = `DEFAULT-${al.code}`
      await db
        .insert(airplanes)
        .values({
          airlineId: al.id,
          registrationNumber: regNumber,
          model: 'Boeing 737-800 Next-Gen',
          totalSeatEconomy: defaultSeatsEconomy,
          totalSeatBusiness: defaultSeatsBusiness,
        })
        .onConflictDoNothing()
      planesAdded++
    }
  }
  console.log(`✅ Armada default: ${planesAdded} pesawat baru ditambahkan untuk maskapai utama.`)

  // 4. Ensure Standard Baggage Options exist
  console.log('\n🧳 Memeriksa opsi bagasi standar...')
  const standardBaggage = [
    { name: 'Bagasi Kabin 7 kg', weightKg: 7, price: '0' },
    { name: 'Bagasi Tambahan 10 kg', weightKg: 10, price: '85000' },
    { name: 'Bagasi Tambahan 20 kg', weightKg: 20, price: '150000' },
    { name: 'Bagasi Tambahan 30 kg', weightKg: 30, price: '220000' },
    { name: 'Bagasi Ekstra 40 kg (Max)', weightKg: 40, price: '320000' },
  ]

  let baggageAdded = 0
  for (const b of standardBaggage) {
    const [exists] = await db
      .select({ id: baggageOptions.id })
      .from(baggageOptions)
      .where(eq(baggageOptions.name, b.name))
      .limit(1)

    if (!exists) {
      await db.insert(baggageOptions).values(b)
      baggageAdded++
    }
  }
  console.log(`✅ Opsi bagasi: ${baggageAdded} opsi baru ditambahkan.`)

  console.log('\n🎉 Selesai! Semua data master dari JSON berhasil diterapkan ke database.')
  process.exit(0)
}

seedFromJson().catch((err) => {
  console.error('❌ Gagal mengimpor data JSON:', err)
  process.exit(1)
})
