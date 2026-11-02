import assert from 'node:assert'

interface MockBooking {
  id: number
  userId: number
  status: string
  totalPrice: number
  createdAt: Date
  flightScheduleId: number
}

interface MockRefund {
  bookingId: number
  status: string
}

interface MockSchedule {
  id: number
  flightNumber: string
  status: string
}

interface MockSegment {
  flightScheduleId: number
  departureTime: Date
}

function computeEligibleRefunds(params: {
  currentUserId: number
  bookings: MockBooking[]
  refunds: MockRefund[]
  schedules: MockSchedule[]
  segments: MockSegment[]
  now?: Date
}) {
  const { currentUserId, bookings, refunds, schedules, segments, now = new Date() } = params

  // 1. Filter bookings: only owned by currentUserId and status === 'paid' (IDOR guard)
  const userBookings = bookings.filter((b) => b.userId === currentUserId && b.status === 'paid')

  // 2. Identify active refunds
  const activeBookingIds = new Set(
    refunds
      .filter((r) => r.status === 'pending' || r.status === 'approved' || r.status === 'refunded')
      .map((r) => r.bookingId),
  )

  const schedMap = new Map(schedules.map((s) => [s.id, s]))
  const segMap = new Map(segments.map((s) => [s.flightScheduleId, s]))

  const eligibleList = []

  for (const b of userBookings) {
    if (activeBookingIds.has(b.id)) continue

    const sched = schedMap.get(b.flightScheduleId)
    if (!sched) continue

    const seg = segMap.get(sched.id)
    if (!seg) continue

    const isFlightCancelled = sched.status === 'cancelled'
    const depTime = seg.departureTime
    const hoursRemaining = (depTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (!isFlightCancelled && hoursRemaining < 6) {
      continue
    }

    const bookingAgeHours = (now.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60)
    let cancellationFee = 0
    let adminFee = 0
    let estimatedRefundAmount = b.totalPrice
    let isCoolingOff = false

    if (isFlightCancelled) {
      cancellationFee = 0
      adminFee = 0
      estimatedRefundAmount = b.totalPrice
    } else {
      cancellationFee = Math.round(b.totalPrice * 0.2)
      adminFee = 25000
      estimatedRefundAmount = Math.max(0, b.totalPrice - cancellationFee - adminFee)
      if (bookingAgeHours <= 24 && hoursRemaining >= 24) {
        isCoolingOff = true
      }
    }

    eligibleList.push({
      bookingId: b.id,
      totalPrice: b.totalPrice,
      isFlightCancelled,
      isCoolingOff,
      cancellationFee,
      adminFee,
      estimatedRefundAmount,
      hoursRemaining: Math.round(hoursRemaining),
    })
  }

  return eligibleList
}

// ─── TESTS ───
console.log('--- [TEST 1] IDOR Guard: User hanya melihat tiket miliknya sendiri ---')
const now = new Date('2026-11-02T12:00:00Z')
const testBookings: MockBooking[] = [
  { id: 1, userId: 101, status: 'paid', totalPrice: 1000000, createdAt: new Date('2026-11-02T10:00:00Z'), flightScheduleId: 10 },
  { id: 2, userId: 999, status: 'paid', totalPrice: 2000000, createdAt: new Date('2026-11-02T10:00:00Z'), flightScheduleId: 20 },
]
const testSchedules: MockSchedule[] = [
  { id: 10, flightNumber: 'GA-401', status: 'scheduled' },
  { id: 20, flightNumber: 'GA-402', status: 'scheduled' },
]
const testSegments: MockSegment[] = [
  { flightScheduleId: 10, departureTime: new Date('2026-11-04T12:00:00Z') }, // 48 jam lagi
  { flightScheduleId: 20, departureTime: new Date('2026-11-04T12:00:00Z') },
]

const user101Eligible = computeEligibleRefunds({
  currentUserId: 101,
  bookings: testBookings,
  refunds: [],
  schedules: testSchedules,
  segments: testSegments,
  now,
})

assert.strictEqual(user101Eligible.length, 1)
assert.strictEqual(user101Eligible[0].bookingId, 1)
console.log('✓ PASS: Tiket user lain (ID 999) tidak pernah bocor ke user 101.')

console.log('\n--- [TEST 2] Active Refund Exclusion: Tiket yang sudah diajukan refund tidak muncul lagi ---')
const withActiveRefund = computeEligibleRefunds({
  currentUserId: 101,
  bookings: testBookings,
  refunds: [{ bookingId: 1, status: 'pending' }],
  schedules: testSchedules,
  segments: testSegments,
  now,
})
assert.strictEqual(withActiveRefund.length, 0)
console.log('✓ PASS: Tiket dengan status pending/approved otomatis dikeluarkan dari daftar eligible.')

console.log('\n--- [TEST 3] Jendela H-6 Jam: Tiket < 6 jam sebelum terbang ditolak ---')
const closeToFlightSegments: MockSegment[] = [
  { flightScheduleId: 10, departureTime: new Date('2026-11-02T15:00:00Z') }, // hanya 3 jam lagi
]
const expiredWindow = computeEligibleRefunds({
  currentUserId: 101,
  bookings: testBookings,
  refunds: [],
  schedules: testSchedules,
  segments: closeToFlightSegments,
  now,
})
assert.strictEqual(expiredWindow.length, 0)
console.log('✓ PASS: Jendela < 6 jam dicegah dari daftar eligible.')

console.log('\n--- [TEST 4] Disrupsi Maskapai: Penerbangan cancelled tetap eligible & 100% penuh ---')
const cancelledSchedules: MockSchedule[] = [
  { id: 10, flightNumber: 'GA-401', status: 'cancelled' },
]
const cancelledEligible = computeEligibleRefunds({
  currentUserId: 101,
  bookings: testBookings,
  refunds: [],
  schedules: cancelledSchedules,
  segments: closeToFlightSegments, // walau < 6 jam, tapi cancelled maskapai
  now,
})
assert.strictEqual(cancelledEligible.length, 1)
assert.strictEqual(cancelledEligible[0].cancellationFee, 0)
assert.strictEqual(cancelledEligible[0].adminFee, 0)
assert.strictEqual(cancelledEligible[0].estimatedRefundAmount, 1000000)
console.log('✓ PASS: Penerbangan dibatalkan maskapai dihitung 100% penuh tanpa potongan & bypass batas H-6.')

console.log('\n--- [TEST 5] Kalkulasi Biaya Reguler & Cooling-Off 24 Jam ---')
const coolingOffEligible = computeEligibleRefunds({
  currentUserId: 101,
  bookings: testBookings,
  refunds: [],
  schedules: testSchedules,
  segments: testSegments, // 48 jam lagi, usia booking 2 jam
  now,
})
assert.strictEqual(coolingOffEligible[0].isCoolingOff, true)
assert.strictEqual(coolingOffEligible[0].cancellationFee, 200000) // 20% dari 1jt
assert.strictEqual(coolingOffEligible[0].adminFee, 25000)
assert.strictEqual(coolingOffEligible[0].estimatedRefundAmount, 775000) // 1jt - 200rb - 25rb
console.log('✓ PASS: Potongan 20% + Rp 25.000 terhitung akurat dan cooling-off ditandai benar.')

console.log('\n======================================================')
console.log(' SEMUA TEST LOGIKA ELIGIBLE REFUNDS & KEAMANAN LULUS!')
console.log('======================================================')

