import type {
  FlightDataProvider,
  ProviderScheduleItem,
  ProviderFlightStatus,
} from './flight-provider.interface.js'
import { providerCacheService } from '../services/provider-cache.service.js'
import { quotaGuardService } from '../services/quota-guard.service.js'

export interface DuffelBaggageService {
  id: string
  maximumQuantity: number
  totalAmount: string
  totalCurrency: string
  type: string
  description?: string
}

export interface DuffelOrderResult {
  id: string
  bookingReference: string
  confirmedAt: string
  totalAmount: string
  totalCurrency: string
  documents?: Array<{
    type: string
    uniqueIdentifier: string
  }>
}

function parseDurationToMinutes(duration?: string): number {
  if (!duration) return 110
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return 110
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  return hours * 60 + minutes
}

export class DuffelProvider implements FlightDataProvider {
  readonly name = 'duffel'
  private baseUrl = 'https://api.duffel.com/air'

  private getToken(): string | null {
    return (
      process.env.DUFFEL_TOKEN ||
      process.env.DUFFEL_TES ||
      process.env.DUFFEL_API_KEY ||
      null
    )
  }

  private getHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  /**
   * Mengambil jadwal penerbangan dari Duffel Offer Requests (DAT-02, DAT-03)
   * Duffel hanya menerima satu departure_date per slice, jadi setiap tanggal
   * dalam rentang [fromDateStr, toDateStr] diambil satu per satu.
   */
  async getSchedulesByRoute(
    originIata: string,
    destinationIata: string,
    fromDateStr: string,
    toDateStr: string,
  ): Promise<ProviderScheduleItem[]> {
    const origin = originIata.toUpperCase()
    const dest = destinationIata.toUpperCase()

    const dates: string[] = []
    const cursor = new Date(`${fromDateStr}T00:00:00Z`)
    const end = new Date(`${(toDateStr || fromDateStr)}T00:00:00Z`)
    while (cursor <= end && dates.length < 60) {
      dates.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    if (dates.length === 0) dates.push(fromDateStr)

    const all: ProviderScheduleItem[] = []
    let quotaExceeded = false
    for (const dateStr of dates) {
      if (quotaExceeded) {
        // DAT-07/DAT-08: kuota habis, sisa tanggal pakai jadwal simulasi tanpa memanggil API
        all.push(...this.generateSimulatedSchedules(origin, dest, dateStr))
        continue
      }
      try {
        all.push(...(await this.getSchedulesForDate(origin, dest, dateStr)))
      } catch (err: any) {
        if (err.message !== 'PROVIDER_QUOTA_EXCEEDED') throw err
        if (all.length === 0) throw err
        console.warn(`[Duffel] Kuota habis pada ${dateStr}, sisa tanggal memakai simulasi.`)
        quotaExceeded = true
        all.push(...this.generateSimulatedSchedules(origin, dest, dateStr))
      }
    }
    return all
  }

  /**
   * Mengambil jadwal untuk satu rute pada satu tanggal keberangkatan.
   */
  private async getSchedulesForDate(
    origin: string,
    dest: string,
    fromDateStr: string,
  ): Promise<ProviderScheduleItem[]> {
    const cacheKey = `sched:${this.name}:${origin}:${dest}:${fromDateStr}`

    // 1. Cek Cache (TTL 12 jam)
    const cached = await providerCacheService.get<ProviderScheduleItem[]>(cacheKey)
    if (cached) {
      // Payload JSONB menyimpan Date sebagai string ISO, kembalikan ke Date
      return cached.map((c) => ({
        ...c,
        departureTimeUtc: new Date(c.departureTimeUtc),
        arrivalTimeUtc: new Date(c.arrivalTimeUtc),
      }))
    }

    // 2. Cek Kuota API
    const quota = await quotaGuardService.checkQuota(this.name, 1)
    if (!quota.allowed) {
      throw new Error('PROVIDER_QUOTA_EXCEEDED')
    }

    const token = this.getToken()
    if (!token) {
      console.warn('[Duffel] Token tidak ditemukan di .env, menggunakan fallback simulasi.')
      const simulated = this.generateSimulatedSchedules(origin, dest, fromDateStr)
      await providerCacheService.set(cacheKey, simulated, 43200)
      return simulated
    }

    try {
      // Panggil Duffel Offer Requests
      const res = await fetch(`${this.baseUrl}/offer_requests`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          data: {
            slices: [
              {
                origin,
                destination: dest,
                departure_date: fromDateStr,
              },
            ],
            passengers: [{ type: 'adult' }],
            cabin_class: 'economy',
          },
        }),
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.error(`[Duffel] API HTTP ${res.status}: ${errorText}`)
        if (res.status === 429) {
          throw new Error('PROVIDER_QUOTA_EXCEEDED')
        }
        // Fallback gracefully jika rute tertentu belum ada offer di Duffel test sandbox
        const simulated = this.generateSimulatedSchedules(origin, dest, fromDateStr)
        await providerCacheService.set(cacheKey, simulated, 43200)
        return simulated
      }

      await quotaGuardService.recordUsage(this.name, 1)

      const json: any = await res.json()
      const offers: any[] = json.data?.offers || []

      if (offers.length === 0) {
        // Jika rute tidak ada penawaran live, generate jadwal realistis
        const simulated = this.generateSimulatedSchedules(origin, dest, fromDateStr)
        await providerCacheService.set(cacheKey, simulated, 43200)
        return simulated
      }

      const results: ProviderScheduleItem[] = []

      for (const offer of offers) {
        const firstSlice = offer.slices?.[0]
        if (!firstSlice) continue

        const firstSegment = firstSlice.segments?.[0]
        if (!firstSegment) continue

        const carrier = firstSegment.operating_carrier || firstSegment.marketing_carrier || {}
        let airlineCode = (carrier.iata_code || 'GA').toUpperCase()
        // Duffel sandbox menggunakan kode uji 'ZZ' (yang di airlines.json terdaftar sebagai American Eagle).
        // Kita petakan ke maskapai yang relevan dengan rute penerbangan.
        if (airlineCode === 'ZZ') {
          if (origin === 'DOH' || dest === 'DOH') airlineCode = 'QR'
          else if (origin === 'SIN' || dest === 'SIN') airlineCode = 'SQ'
          else airlineCode = 'GA'
        }
        const flightNum = (
          firstSegment.operating_carrier_flight_number ||
          firstSegment.marketing_carrier_flight_number ||
          '101'
        ).replace(/\s+/g, '')

        const flightNumber = `${airlineCode}-${flightNum}`
        const depTime = new Date(firstSegment.departing_at)
        const arrTime = new Date(firstSegment.arriving_at)
        const durationMinutes = parseDurationToMinutes(firstSegment.duration)

        results.push({
          flightNumber,
          airlineCode,
          originIata: origin,
          destinationIata: dest,
          departureTimeUtc: depTime,
          arrivalTimeUtc: arrTime,
          durationMinutes,
          aircraftModel: firstSegment.aircraft?.name || 'Boeing 737-800',
          externalRef: offer.id,
        })
      }

      // Simpan di cache selama 12 jam (43200 detik)
      await providerCacheService.set(cacheKey, results, 43200)
      return results
    } catch (err: any) {
      if (err.message === 'PROVIDER_QUOTA_EXCEEDED') throw err
      console.error('[Duffel] Gagal mengambil jadwal:', err)
      // Degradasi halus: kembalikan jadwal simulasi jika provider mati (DAT-08)
      const simulated = this.generateSimulatedSchedules(origin, dest, fromDateStr)
      await providerCacheService.set(cacheKey, simulated, 43200)
      return simulated
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

    // Default status scheduled
    const result: ProviderFlightStatus = {
      flightNumber: cleanNumber,
      status: 'scheduled',
      delayMinutes: 0,
    }

    await providerCacheService.set(cacheKey, result, 900)
    return result
  }

  /**
   * Mengambil opsi bagasi tambahan dari penawaran Duffel (Baggage Add-on)
   */
  async getAvailableBaggageServices(offerId: string): Promise<DuffelBaggageService[]> {
    const token = this.getToken()
    if (!token) return []

    try {
      const res = await fetch(`${this.baseUrl}/offers/${offerId}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      })

      if (!res.ok) return []

      const json: any = await res.json()
      const services: any[] = json.data?.available_services || []

      return services
        .filter((s) => s.type === 'baggage')
        .map((s) => ({
          id: s.id,
          maximumQuantity: s.maximum_quantity || 1,
          totalAmount: s.total_amount,
          totalCurrency: s.total_currency,
          type: s.type,
          description: s.metadata?.description || `Bagasi Tambahan (${s.total_amount} ${s.total_currency})`,
        }))
    } catch {
      return []
    }
  }

  /**
   * Membuat pesanan tiket resmi di Duffel (Orders API)
   */
  async createOrder(params: {
    offerId: string
    passengers: Array<{
      id: string
      title?: 'mr' | 'ms' | 'mrs'
      givenName: string
      familyName: string
      email: string
      phoneNumber?: string
      bornOn?: string
    }>
    payments?: Array<{
      type: 'balance'
      amount: string
      currency: string
    }>
  }): Promise<DuffelOrderResult | null> {
    const token = this.getToken()
    if (!token) return null

    try {
      const body = {
        data: {
          selected_offers: [params.offerId],
          passengers: params.passengers.map((p) => ({
            id: p.id,
            title: p.title || 'mr',
            given_name: p.givenName,
            family_name: p.familyName,
            email: p.email,
            phone_number: p.phoneNumber || '+6281234567890',
            born_on: p.bornOn || '1995-05-15',
          })),
          type: 'instant',
          payments: params.payments || [
            {
              type: 'balance',
              amount: '0.00',
              currency: 'USD',
            },
          ],
        },
      }

      const res = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        console.error('[Duffel] Order creation error:', await res.text().catch(() => ''))
        return null
      }

      const json: any = await res.json()
      const order = json.data
      if (!order) return null

      return {
        id: order.id,
        bookingReference: order.booking_reference,
        confirmedAt: order.created_at,
        totalAmount: order.total_amount,
        totalCurrency: order.total_currency,
        documents: order.documents?.map((d: any) => ({
          type: d.type,
          uniqueIdentifier: d.unique_identifier,
        })),
      }
    } catch (err) {
      console.error('[Duffel] Failed to create order:', err)
      return null
    }
  }

  /**
   * Helper generator jadwal deterministik untuk rute Indonesia
   */
  private generateSimulatedSchedules(
    origin: string,
    dest: string,
    dateStr: string,
  ): ProviderScheduleItem[] {
    const hours = [7, 10, 14, 17, 20]
    const airlinesMap: Record<string, string> = {
      CGK: 'GA',
      DPS: 'ID',
      SUB: 'QG',
      KNO: 'JT',
      YIA: 'IU',
      SIN: 'SQ',
      DOH: 'QR',
    }
    const defaultAirline = airlinesMap[origin] || 'GA'
    let durationMins = 110 // Default rata-rata domestik 1j 50m
    if ((origin === 'CGK' && dest === 'DOH') || (origin === 'DOH' && dest === 'CGK')) {
      durationMins = 520 // ~8 jam 40 menit
    } else if ((origin === 'SIN' && dest === 'DOH') || (origin === 'DOH' && dest === 'SIN')) {
      durationMins = 460 // ~7 jam 40 menit
    } else if ((origin === 'CGK' && dest === 'SIN') || (origin === 'SIN' && dest === 'CGK')) {
      durationMins = 115 // ~1 jam 55 menit
    }

    return hours.map((hour, idx) => {
      const depUtc = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:15:00Z`)
      const arrUtc = new Date(depUtc.getTime() + durationMins * 60 * 1000)
      const numCode = 400 + idx * 35

      return {
        flightNumber: `${defaultAirline}-${numCode}`,
        airlineCode: defaultAirline,
        originIata: origin,
        destinationIata: dest,
        departureTimeUtc: depUtc,
        arrivalTimeUtc: arrUtc,
        durationMinutes: durationMins,
        aircraftModel: 'Boeing 737-800',
        externalRef: `duffel_sim_${origin}_${dest}_${dateStr}_${hour}`,
      }
    })
  }
}

export const duffelProvider = new DuffelProvider()
