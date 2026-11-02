import { db } from '../db/index.js'
import { airports, airlines, airplanes } from '../db/schema.js'

let cachedAirportsMap: Map<number, any> | null = null
let airportsCacheExpiresAt = 0

let cachedAirlinesMap: Map<number, any> | null = null
let airlinesCacheExpiresAt = 0

let cachedAirplanesMap: Map<number, any> | null = null
let airplanesCacheExpiresAt = 0

const CACHE_TTL_MS = 15 * 60 * 1000 // Cache disimpan dalam memory selama 15 menit

/**
 * Mengambil map seluruh bandara dari in-memory cache
 * Menghilangkan query berat 9MB ke PostgreSQL pada setiap request staf/pelanggan
 */
export async function getCachedAirportsMap(): Promise<Map<number, any>> {
  const now = Date.now()
  if (cachedAirportsMap && now < airportsCacheExpiresAt) {
    return cachedAirportsMap
  }

  const allAirports = await db.select().from(airports)
  cachedAirportsMap = new Map(allAirports.map((a) => [a.id, a]))
  airportsCacheExpiresAt = now + CACHE_TTL_MS
  return cachedAirportsMap
}

/**
 * Mengambil map maskapai dari in-memory cache
 */
export async function getCachedAirlinesMap(): Promise<Map<number, any>> {
  const now = Date.now()
  if (cachedAirlinesMap && now < airlinesCacheExpiresAt) {
    return cachedAirlinesMap
  }

  const allAirlines = await db.select().from(airlines)
  cachedAirlinesMap = new Map(allAirlines.map((a) => [a.id, a]))
  airlinesCacheExpiresAt = now + CACHE_TTL_MS
  return cachedAirlinesMap
}

/**
 * Mengambil map armada pesawat dari in-memory cache
 */
export async function getCachedAirplanesMap(): Promise<Map<number, any>> {
  const now = Date.now()
  if (cachedAirplanesMap && now < airplanesCacheExpiresAt) {
    return cachedAirplanesMap
  }

  const allAirplanes = await db.select().from(airplanes)
  cachedAirplanesMap = new Map(allAirplanes.map((a) => [a.id, a]))
  airplanesCacheExpiresAt = now + CACHE_TTL_MS
  return cachedAirplanesMap
}

/**
 * Mengambil ketiga master data secara paralel dari cache in-memory
 */
export async function getCachedMasterData(): Promise<{
  airportMap: Map<number, any>
  airlineMap: Map<number, any>
  airplaneMap: Map<number, any>
}> {
  const [airportMap, airlineMap, airplaneMap] = await Promise.all([
    getCachedAirportsMap(),
    getCachedAirlinesMap(),
    getCachedAirplanesMap(),
  ])

  return { airportMap, airlineMap, airplaneMap }
}

/**
 * Reset cache saat ada perubahan master data di admin
 */
export function invalidateMasterDataCache() {
  cachedAirportsMap = null
  cachedAirlinesMap = null
  cachedAirplanesMap = null
  airportsCacheExpiresAt = 0
  airlinesCacheExpiresAt = 0
  airplanesCacheExpiresAt = 0
}

