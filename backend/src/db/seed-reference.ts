import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { db } from './index.js'
import { airports, airlines, airplanes, baggageOptions, users } from './schema.js'
import { eq } from 'drizzle-orm'

// ─── Dataset Terbuka: Bandara Indonesia & Hub Internasional Utama (DAT-01) ───
const AIRPORTS_DATA = [
  // Jawa & Bali & Nusa Tenggara
  { code: 'CGK', name: 'Bandar Udara Internasional Soekarno-Hatta', city: 'Jakarta', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'HLP', name: 'Bandar Udara Halim Perdanakusuma', city: 'Jakarta', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'DPS', name: 'Bandar Udara Internasional I Gusti Ngurah Rai', city: 'Denpasar', country: 'Indonesia', timezone: 'Asia/Makassar' },
  { code: 'SUB', name: 'Bandar Udara Internasional Juanda', city: 'Surabaya', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'YIA', name: 'Bandar Udara Internasional Yogyakarta', city: 'Yogyakarta', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'SRG', name: 'Bandar Udara Internasional Jenderal Ahmad Yani', city: 'Semarang', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'SOC', name: 'Bandar Udara Internasional Adi Soemarmo', city: 'Solo', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'BDO', name: 'Bandar Udara Husein Sastranegara', city: 'Bandung', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'LOP', name: 'Bandar Udara Internasional Lombok Zainuddin Abdul Madjid', city: 'Lombok', country: 'Indonesia', timezone: 'Asia/Makassar' },
  { code: 'KOE', name: 'Bandar Udara El Tari', city: 'Kupang', country: 'Indonesia', timezone: 'Asia/Makassar' },
  { code: 'LBJ', name: 'Bandar Udara Komodo', city: 'Labuan Bajo', country: 'Indonesia', timezone: 'Asia/Makassar' },

  // Sumatera
  { code: 'KNO', name: 'Bandar Udara Internasional Kualanamu', city: 'Medan', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'BTH', name: 'Bandar Udara Internasional Hang Nadim', city: 'Batam', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'PKU', name: 'Bandar Udara Internasional Sultan Syarif Kasim II', city: 'Pekanbaru', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'PDG', name: 'Bandar Udara Internasional Minangkabau', city: 'Padang', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'PLM', name: 'Bandar Udara Internasional Sultan Mahmud Badaruddin II', city: 'Palembang', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'BTJ', name: 'Bandar Udara Internasional Sultan Iskandar Muda', city: 'Banda Aceh', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'TKG', name: 'Bandar Udara Radin Inten II', city: 'Bandar Lampung', country: 'Indonesia', timezone: 'Asia/Jakarta' },

  // Kalimantan
  { code: 'BPN', name: 'Bandar Udara Internasional Sultan Aji Muhammad Sulaiman Sepinggan', city: 'Balikpapan', country: 'Indonesia', timezone: 'Asia/Makassar' },
  { code: 'BDJ', name: 'Bandar Udara Internasional Syamsudin Noor', city: 'Banjarmasin', country: 'Indonesia', timezone: 'Asia/Makassar' },
  { code: 'PNK', name: 'Bandar Udara Supadio', city: 'Pontianak', country: 'Indonesia', timezone: 'Asia/Jakarta' },
  { code: 'AAP', name: 'Bandar Udara Aji Pangeran Tumenggung Pranoto', city: 'Samarinda', country: 'Indonesia', timezone: 'Asia/Makassar' },

  // Sulawesi & Maluku & Papua
  { code: 'UPG', name: 'Bandar Udara Internasional Sultan Hasanuddin', city: 'Makassar', country: 'Indonesia', timezone: 'Asia/Makassar' },
  { code: 'MDC', name: 'Bandar Udara Internasional Sam Ratulangi', city: 'Manado', country: 'Indonesia', timezone: 'Asia/Makassar' },
  { code: 'AMQ', name: 'Bandar Udara Pattimura', city: 'Ambon', country: 'Indonesia', timezone: 'Asia/Jayapura' },
  { code: 'DJJ', name: 'Bandar Udara Internasional Sentani', city: 'Jayapura', country: 'Indonesia', timezone: 'Asia/Jayapura' },
  { code: 'SOQ', name: 'Bandar Udara Domine Eduard Osok', city: 'Sorong', country: 'Indonesia', timezone: 'Asia/Jayapura' },

  // Hub Internasional Terdekat
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapura', country: 'Singapura', timezone: 'Asia/Singapore' },
  { code: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
]

// ─── Dataset Terbuka: Maskapai Penerbangan Utama Indonesia (DAT-01) ───
const AIRLINES_DATA = [
  {
    name: 'Garuda Indonesia',
    code: 'GA',
    logo: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=128&q=80',
    defaultModel: 'Boeing 737-800',
  },
  {
    name: 'Citilink',
    code: 'QG',
    logo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=128&q=80',
    defaultModel: 'Airbus A320-200',
  },
  {
    name: 'Lion Air',
    code: 'JT',
    logo: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=128&q=80',
    defaultModel: 'Boeing 737-900ER',
  },
  {
    name: 'Batik Air',
    code: 'ID',
    logo: 'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?w=128&q=80',
    defaultModel: 'Airbus A320-200',
  },
  {
    name: 'Indonesia AirAsia',
    code: 'QZ',
    logo: 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=128&q=80',
    defaultModel: 'Airbus A320-200',
  },
  {
    name: 'Super Air Jet',
    code: 'IU',
    logo: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=128&q=80',
    defaultModel: 'Airbus A320-200',
  },
  {
    name: 'Sriwijaya Air',
    code: 'SJ',
    logo: 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=128&q=80',
    defaultModel: 'Boeing 737-800',
  },
  {
    name: 'Wings Air',
    code: 'IW',
    logo: 'https://images.unsplash.com/photo-1520437358207-323b43b50729?w=128&q=80',
    defaultModel: 'ATR 72-600',
  },
]

// ─── Paket Bagasi Standar ───
const BAGGAGE_OPTIONS_DATA = [
  { name: 'Bagasi Kabin 7 kg', weightKg: 7, price: '0' },
  { name: 'Bagasi Tambahan 10 kg', weightKg: 10, price: '85000' },
  { name: 'Bagasi Tambahan 20 kg', weightKg: 20, price: '150000' },
  { name: 'Bagasi Tambahan 30 kg', weightKg: 30, price: '220000' },
]

async function seedReference() {
  console.log('🚀 Memulai proses seeding data referensi (DAT-01 & DAT-05)...')

  // 1. Seed Bandara (Idempotent berdasarkan code)
  console.log('\n📍 Menyimpan data bandara...')
  let airportsInserted = 0
  let airportsUpdated = 0

  for (const item of AIRPORTS_DATA) {
    const [existing] = await db
      .select({ id: airports.id })
      .from(airports)
      .where(eq(airports.code, item.code))
      .limit(1)

    if (existing) {
      await db
        .update(airports)
        .set({
          name: item.name,
          city: item.city,
          country: item.country,
          timezone: item.timezone,
        })
        .where(eq(airports.id, existing.id))
      airportsUpdated++
    } else {
      await db.insert(airports).values(item)
      airportsInserted++
    }
  }
  console.log(`✅ Bandara selesai: ${airportsInserted} baru, ${airportsUpdated} diperbarui (Total ${AIRPORTS_DATA.length})`)

  // 2. Seed Maskapai & Pesawat Default (DAT-05)
  console.log('\n✈️ Menyimpan data maskapai dan armada default...')
  const defaultSeatsEconomy = Number(process.env.DEFAULT_AIRPLANE_SEATS_ECONOMY || 150)
  const defaultSeatsBusiness = Number(process.env.DEFAULT_AIRPLANE_SEATS_BUSINESS || 12)

  let airlinesCount = 0
  let defaultAirplanesCount = 0

  for (const item of AIRLINES_DATA) {
    let airlineId: number

    const [existingAirline] = await db
      .select({ id: airlines.id })
      .from(airlines)
      .where(eq(airlines.code, item.code))
      .limit(1)

    if (existingAirline) {
      airlineId = existingAirline.id
      await db
        .update(airlines)
        .set({
          name: item.name,
          logo: item.logo,
        })
        .where(eq(airlines.id, existingAirline.id))
    } else {
      const [created] = await db
        .insert(airlines)
        .values({
          name: item.name,
          code: item.code,
          logo: item.logo,
        })
        .returning({ id: airlines.id })
      airlineId = created.id
    }
    airlinesCount++

    // Pesawat default per maskapai (DAT-05): registration_number berpola DEFAULT-<kode maskapai>
    const defaultRegNumber = `DEFAULT-${item.code}`

    const [existingPlane] = await db
      .select({ id: airplanes.id })
      .from(airplanes)
      .where(eq(airplanes.registrationNumber, defaultRegNumber))
      .limit(1)

    if (existingPlane) {
      await db
        .update(airplanes)
        .set({
          airlineId,
          model: item.defaultModel,
          totalSeatEconomy: defaultSeatsEconomy,
          totalSeatBusiness: defaultSeatsBusiness,
        })
        .where(eq(airplanes.id, existingPlane.id))
    } else {
      await db.insert(airplanes).values({
        airlineId,
        registrationNumber: defaultRegNumber,
        model: item.defaultModel,
        totalSeatEconomy: defaultSeatsEconomy,
        totalSeatBusiness: defaultSeatsBusiness,
      })
    }
    defaultAirplanesCount++
  }
  console.log(`✅ Maskapai selesai: ${airlinesCount} maskapai & ${defaultAirplanesCount} armada default (Kapasitas: ${defaultSeatsEconomy} Ekonomi, ${defaultSeatsBusiness} Bisnis)`)

  // 3. Seed Opsi Bagasi
  console.log('\n🧳 Menyimpan opsi bagasi standar...')
  let baggageCount = 0
  for (const item of BAGGAGE_OPTIONS_DATA) {
    const [existing] = await db
      .select({ id: baggageOptions.id })
      .from(baggageOptions)
      .where(eq(baggageOptions.name, item.name))
      .limit(1)

    if (!existing) {
      await db.insert(baggageOptions).values(item)
      baggageCount++
    }
  }
  console.log(`✅ Opsi bagasi selesai: ${baggageCount} baru ditambahkan.`)

  // 4. Seed Akun Dummy untuk Pengetesan / Demo (Staff, Admin, Customer)
  console.log('\n👤 Menyimpan akun dummy untuk pengetesan (Staff, Admin, Customer)...')
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10)
  const DUMMY_USERS: Array<{
    name: string
    email: string
    phone: string
    role: 'staff' | 'admin' | 'customer'
  }> = [
    {
      name: 'Petugas Boarding (Staff)',
      email: 'staff@skybook.com',
      phone: '081211112222',
      role: 'staff',
    },
    {
      name: 'Administrator SkyBook',
      email: 'admin@skybook.com',
      phone: '081200001111',
      role: 'admin',
    },
    {
      name: 'Pelanggan Demo',
      email: 'customer@skybook.com',
      phone: '081233334444',
      role: 'customer',
    },
  ]

  for (const u of DUMMY_USERS) {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1)

    if (existingUser) {
      await db
        .update(users)
        .set({
          name: u.name,
          password: defaultPasswordHash,
          phone: u.phone,
          role: u.role,
          isActive: true,
          emailVerifiedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
    } else {
      await db.insert(users).values({
        name: u.name,
        email: u.email,
        password: defaultPasswordHash,
        phone: u.phone,
        role: u.role,
        isActive: true,
        emailVerifiedAt: new Date(),
      })
    }
  }
  console.log('✅ Akun dummy siap digunakan (password: Password123!)')

  console.log('\n🎉 Seeding data referensi (DAT-01 & DAT-05) berhasil diselesaikan!')
  process.exit(0)
}

seedReference().catch((err) => {
  console.error('❌ Gagal menjalankan seed:', err)
  process.exit(1)
})
