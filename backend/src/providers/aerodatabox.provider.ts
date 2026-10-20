import type {
  FlightDataProvider,
  ProviderScheduleItem,
  ProviderFlightStatus,
} from './flight-provider.interface.js'
import { providerCacheService } from '../services/provider-cache.service.js'
import { quotaGuardService } from '../services/quota-guard.service.js'

export class AeroDataBoxProvider implements FlightDataProvider {
  readonly name = 'aerodatabox'
  private baseUrl = 'https://aerodatabox.p.rapidapi.com'

  private getApiKey(): string | null {
    return (
      process.env.RAPIDAPI_KEY ||
      process.env.AERODATABOX_API_KEY ||
      process.env.PROVIDER_API_KEY ||
      null
    )
  }

  /**
   * Mengambil jadwal penerbangan langsung antara 2 bandara IATA (DAT-02, DAT-07)
   */
  async getSchedulesByRoute(
    originIata: string,
    destinationIata: string,
    fromDateStr: string,
    toDateStr: string,
  ): Promise<ProviderScheduleItem[]> {
    const origin = originIata.toUpperCase()
    const dest = destinationIata.toUpperCase()
    const cacheKey = `sched:${this.name}:${origin}:${dest}:${fromDateStr}:${toDateStr}`

    // 1. Cek Cache (TTL 12 jam)
    const cached = await providerCacheService.get<ProviderScheduleItem[]>(cacheKey)
    if (cached) {
      return cached
    }

    // 2. Cek Kuota API
    const quota = await quotaGuardService.checkQuota(this.name, 1)
    if (!quota.allowed) {
      throw new Error('PROVIDER_QUOTA_EXCEEDED')
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      // Jika API key belum diset di .env, sediakan mock deterministic untuk testing/pengembangan
      const simulated = this.generateSimulatedSchedules(origin, dest, fromDateStr, toDateStr)
      await providerCacheService.set(cacheKey, simulated, 43200)
      return simulated
    }

    try {
      // Panggil RapidAPI AeroDataBox: departures dari origin
      // Format AeroDataBox: /flights/airports/iata/{iata}/{fromLocal}/{toLocal}?direction=Departure
      const url = `${this.baseUrl}/flights/airports/iata/${origin}/${fromDateStr}T00:00/${toDateStr}T23:59?direction=Departure`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('PROVIDER_QUOTA_EXCEEDED')
        }
        console.error(`[AeroDataBox] API HTTP ${response.status}: ${await response.text().catch(() => '')}`)
        throw new Error('PROVIDER_UNAVAILABLE')
      }

      await quotaGuardService.recordUsage(this.name, 1)

      const json: any = await response.json()
      const departures: any[] = json.departures || json.items || []

      // Filter yang tujuannya sesuai dengan destinationIata
      const filtered = departures.filter((f) => {
        const arrivalIata =
          f.arrival?.airport?.iata ||
          f.movement?.airport?.iata ||
          f.destination?.iata
        return arrivalIata && arrivalIata.toUpperCase() === dest
      })

      const results: ProviderScheduleItem[] = filtered.map((f) => {
        const flightNumber = (f.number || f.flightNumber || '').replace(/\s+/g, '')
        const airlineCode =
          f.airline?.iata ||
          (flightNumber.length >= 2 ? flightNumber.substring(0, 2) : 'GA')

        const depTimeStr =
          f.departure?.scheduledTime?.utc ||
          f.departure?.scheduledTime?.local ||
          f.movement?.scheduledTime?.utc
        const arrTimeStr =
          f.arrival?.scheduledTime?.utc ||
          f.arrival?.scheduledTime?.local ||
          f.movement?.scheduledTime?.utc

        const depDate = new Date(depTimeStr)
        const arrDate = new Date(arrTimeStr)
        const durationMin = Math.max(
          30,
          Math.round((arrDate.getTime() - depDate.getTime()) / (60 * 1000)),
        )

        return {
          flightNumber,
          airlineCode: airlineCode.toUpperCase(),
          originIata: origin,
          destinationIata: dest,
          departureTimeUtc: depDate,
          arrivalTimeUtc: arrDate,
          durationMinutes: durationMin,
          aircraftModel: f.aircraft?.model || 'Boeing 737-800',
          externalRef: `${flightNumber}-${depDate.toISOString()}`,
        }
      })

      // Simpan di cache (TTL 12 jam = 43200 detik)
      await providerCacheService.set(cacheKey, results, 43200)
      return results
    } catch (err: any) {
      if (err.message === 'PROVIDER_QUOTA_EXCEEDED' || err.message === 'PROVIDER_UNAVAILABLE') {
        throw err
      }
      console.error('[AeroDataBox] Gagal mengambil jadwal:', err)
      throw new Error('PROVIDER_UNAVAILABLE')
    }
  }

  /**
   * Mengambil status terkini penerbangan (DAT-02, DAT-06)
   */
  async getFlightStatus(
    flightNumber: string,
    dateStr: string,
  ): Promise<ProviderFlightStatus | null> {
    const cleanNumber = flightNumber.replace(/\s+/g, '').toUpperCase()
    const cacheKey = `status:${this.name}:${cleanNumber}:${dateStr}`

    // 1. Cek Cache (TTL 15 menit)
    const cached = await providerCacheService.get<ProviderFlightStatus>(cacheKey)
    if (cached) {
      return cached
    }

    // 2. Cek Kuota
    const quota = await quotaGuardService.checkQuota(this.name, 1)
    if (!quota.allowed) {
      throw new Error('PROVIDER_QUOTA_EXCEEDED')
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      return {
        flightNumber: cleanNumber,
        status: 'scheduled',
        delayMinutes: 0,
      }
    }

    try {
      const url = `${this.baseUrl}/flights/number/${cleanNumber}/${dateStr}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) return null
        if (response.status === 429) throw new Error('PROVIDER_QUOTA_EXCEEDED')
        throw new Error('PROVIDER_UNAVAILABLE')
      }

      await quotaGuardService.recordUsage(this.name, 1)

      const json: any = await response.json()
      const flightData = Array.isArray(json) ? json[0] : json

      if (!flightData) return null

      const rawStatus = (flightData.status || '').toLowerCase()
      let status: 'scheduled' | 'delayed' | 'cancelled' = 'scheduled'
      let delayMinutes = 0

      if (rawStatus.includes('cancel')) {
        status = 'cancelled'
      } else if (rawStatus.includes('delay') || flightData.departure?.delay) {
        status = 'delayed'
        delayMinutes = Number(flightData.departure?.delay || 0)
      }

      const result: ProviderFlightStatus = {
        flightNumber: cleanNumber,
        status,
        delayMinutes: Math.max(0, delayMinutes),
        actualDepartureUtc: flightData.departure?.actualTime?.utc
          ? new Date(flightData.departure.actualTime.utc)
          : undefined,
        actualArrivalUtc: flightData.arrival?.actualTime?.utc
          ? new Date(flightData.arrival.actualTime.utc)
          : undefined,
      }

      // Cache status selama 15 menit (900 detik)
      await providerCacheService.set(cacheKey, result, 900)
      return result
    } catch (err: any) {
      if (err.message === 'PROVIDER_QUOTA_EXCEEDED' || err.message === 'PROVIDER_UNAVAILABLE') {
        throw err
      }
      console.error('[AeroDataBox] Gagal mengambil status:', err)
      throw new Error('PROVIDER_UNAVAILABLE')
    }
  }

  /**
   * Helper fallback data simulasi jadwal realistis jika belum ada RapidAPI key
   */
  private generateSimulatedSchedules(
    origin: string,
    dest: string,
    fromDateStr: string,
    toDateStr: string,
  ): ProviderScheduleItem[] {
    const list: ProviderScheduleItem[] = []
    const fromDate = new Date(fromDateStr)
    const toDate = new Date(toDateStr)

    const airlineList = [
      { code: 'GA', name: 'Garuda Indonesia', prefix: 'GA' },
      { code: 'QG', name: 'Citilink', prefix: 'QG' },
      { code: 'JT', name: 'Lion Air', prefix: 'JT' },
      { code: 'ID', name: 'Batik Air', prefix: 'ID' },
    ]

    const slots = [
      { hour: 6, min: 30, duration: 110 },
      { hour: 9, min: 15, duration: 115 },
      { hour: 13, min: 45, duration: 120 },
      { hour: 17, min: 0, duration: 110 },
      { hour: 20, min: 30, duration: 105 },
    ]

    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear()
      const month = d.getMonth()
      const date = d.getDate()

      slots.forEach((slot, idx) => {
        const airline = airlineList[idx % airlineList.length]
        const flightNumber = `${airline.prefix}-${400 + idx * 12 + (date % 10)}`
        const depDate = new Date(Date.UTC(year, month, date, slot.hour, slot.min, 0))
        const arrDate = new Date(depDate.getTime() + slot.duration * 60 * 1000)

        list.push({
          flightNumber,
          airlineCode: airline.code,
          originIata: origin,
          destinationIata: dest,
          departureTimeUtc: depDate,
          arrivalTimeUtc: arrDate,
          durationMinutes: slot.duration,
          aircraftModel: 'Boeing 737-800',
          externalRef: `${flightNumber}-${depDate.toISOString()}`,
        })
      })
    }

    return list
  }
}

export const aeroDataBoxProvider = new AeroDataBoxProvider()
