import 'dotenv/config'
import { aeroDataBoxProvider } from '../providers/aerodatabox.provider.js'
import { quotaGuardService } from '../services/quota-guard.service.js'

async function runCoverageTest() {
  console.log('=== UJI CAKUPAN PENYEDIA PENERBANGAN (DAT-02, DAT-07) ===')

  const usage = await quotaGuardService.getUsage(aeroDataBoxProvider.name)
  console.log(`[Status Kuota Bulan ${usage.period}] Pemakaian: ${usage.units_used} / ${usage.monthly_limit} unit (${usage.percent}%)`)

  const testRoutes = [
    { origin: 'CGK', dest: 'DPS', name: 'Jakarta (CGK) -> Bali Denpasar (DPS)' },
    { origin: 'CGK', dest: 'SUB', name: 'Jakarta (CGK) -> Surabaya (SUB)' },
    { origin: 'SUB', dest: 'DPS', name: 'Surabaya (SUB) -> Bali Denpasar (DPS)' },
    { origin: 'CGK', dest: 'KNO', name: 'Jakarta (CGK) -> Medan Kualanamu (KNO)' },
    { origin: 'CGK', dest: 'YIA', name: 'Jakarta (CGK) -> Yogyakarta (YIA)' },
  ]

  const today = new Date()
  const fromDate = today.toISOString().split('T')[0]
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const toDate = tomorrow.toISOString().split('T')[0]

  console.log(`\nRentang Uji: ${fromDate} s/d ${toDate}\n`)

  for (const route of testRoutes) {
    try {
      console.log(`Menguji rute: ${route.name}...`)
      const schedules = await aeroDataBoxProvider.getSchedulesByRoute(
        route.origin,
        route.dest,
        fromDate,
        toDate,
      )

      console.log(`  -> Berhasil ditemukan: ${schedules.length} jadwal penerbangan`)
      if (schedules.length > 0) {
        const sample = schedules[0]
        console.log(`     Contoh: [${sample.airlineCode}] ${sample.flightNumber} | Berangkat: ${sample.departureTimeUtc.toISOString()} | Durasi: ${sample.durationMinutes}m | Ref: ${sample.externalRef}`)
      }
    } catch (err: any) {
      console.error(`  -> Gagal menguji rute ${route.origin}-${route.dest}:`, err.message)
    }
  }

  const updatedUsage = await quotaGuardService.getUsage(aeroDataBoxProvider.name)
  console.log(`\n[Selesai] Pemakaian Kuota Terbaru: ${updatedUsage.units_used} / ${updatedUsage.monthly_limit} unit (${updatedUsage.percent}%)`)
}

runCoverageTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error during test:', err)
    process.exit(1)
  })
