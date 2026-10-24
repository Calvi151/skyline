import type { FlightDataProvider } from './flight-provider.interface.js'
import { duffelProvider } from './duffel.provider.js'
import { aeroDataBoxProvider } from './aerodatabox.provider.js'

export * from './flight-provider.interface.js'
export * from './duffel.provider.js'
export * from './aerodatabox.provider.js'

/**
 * Mengambil provider aktif sesuai konfigurasi .env
 */
export function getActiveFlightProvider(): FlightDataProvider {
  const providerName = (process.env.PROVIDER_NAME || '').toLowerCase()

  if (
    providerName === 'duffel' ||
    process.env.DUFFEL_TOKEN ||
    process.env.DUFFEL_TES ||
    process.env.DUFFEL_API_KEY
  ) {
    return duffelProvider
  }

  return aeroDataBoxProvider
}

export const activeFlightProvider = getActiveFlightProvider()
