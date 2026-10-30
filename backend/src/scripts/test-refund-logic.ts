/**
 * Test unit untuk memverifikasi logika baru Refund Otomatis:
 * 1. Disrupsi / Penerbangan dibatalkan maskapai (RFD-05) -> Auto-Approved Instan 100% penuh.
 * 2. Aturan Cooling-Off 24 Jam (RFD-01/02) -> Auto-Approved jika pesanan <= 24 jam & terbang >= 24 jam.
 * 3. Pesanan reguler > 24 jam -> Masuk 'pending' untuk admin review.
 * 4. Batas H-6 jam -> Ditolak REFUND_WINDOW_CLOSED.
 * 5. Jadwal sudah lewat -> Ditolak FLIGHT_ALREADY_DEPARTED.
 * 6. Proteksi keamanan double-refund & pencegahan pembatalan refund yang sudah disetujui.
 */

import assert from 'node:assert'

function calculateRefundDecision(params: {
  bookingCreatedAt: Date
  departureTime: Date
  isFlightCancelled: boolean
  totalPrice: number
  reason: string
  hasExistingActiveRefund: boolean
  bookingStatus: string
}) {
  const {
    bookingCreatedAt,
    departureTime,
    isFlightCancelled,
    totalPrice,
    reason,
    hasExistingActiveRefund,
    bookingStatus,
  } = params

  if (bookingStatus !== 'paid') {
    throw { status: 400, code: 'BOOKING_NOT_PAID', message: 'Hanya pesanan paid yang dapat refund' }
  }

  if (hasExistingActiveRefund) {
    throw { status: 400, code: 'REFUND_ALREADY_PENDING', message: 'Refund sudah ada atau sedang diproses' }
  }

  const now = new Date()
  let kind: 'customer' | 'flight_cancelled' = 'customer'
  let refundAmount = totalPrice
  let finalReason = reason.trim()
  let shouldAutoApprove = false

  const bookingAgeHours = (now.getTime() - bookingCreatedAt.getTime()) / (1000 * 60 * 60)
  const hoursRemaining = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (isFlightCancelled) {
    kind = 'flight_cancelled'
    refundAmount = totalPrice
    if (!finalReason) {
      finalReason = 'Penerbangan dibatalkan maskapai'
    }
    shouldAutoApprove = true
  } else {
    kind = 'customer'

    if (!finalReason || finalReason.length < 5) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Alasan minimal 5 karakter' }
    }

    if (hoursRemaining <= 0) {
      throw { status: 400, code: 'FLIGHT_ALREADY_DEPARTED', message: 'Penerbangan sudah berangkat' }
    }

    if (hoursRemaining < 6) {
      throw { status: 400, code: 'REFUND_WINDOW_CLOSED', message: 'Pengajuan ditutup minimal H-6' }
    }

    const cancellationFee = Math.round(refundAmount * 0.2)
    const adminFee = 25000
    refundAmount = Math.max(0, refundAmount - cancellationFee - adminFee)

    if (bookingAgeHours <= 24 && hoursRemaining >= 24) {
      shouldAutoApprove = true
    }
  }

  return {
    kind,
    refundAmount,
    finalReason,
    shouldAutoApprove,
    status: shouldAutoApprove ? 'approved' : 'pending',
  }
}

function processAdminAction(currentStatus: string, action: 'approved' | 'rejected') {
  if (currentStatus === 'rejected') {
    throw { status: 400, code: 'ALREADY_PROCESSED', message: 'Refund yang sudah ditolak tidak dapat diubah' }
  }
  if (currentStatus === 'approved' || currentStatus === 'refunded') {
    if (action === 'rejected') {
      throw { status: 400, code: 'ALREADY_APPROVED', message: 'Refund yang sudah disetujui tidak dapat ditolak' }
    }
    return { status: 'approved', note: 'Idempotent' }
  }
  return { status: action, note: 'Processed' }
}

async function runTests() {
  console.log('--- [TEST 1] Penerbangan Dibatalkan (Disrupsi Maskapai) ---')
  const t1 = calculateRefundDecision({
    bookingCreatedAt: new Date(Date.now() - 48 * 3600 * 1000), // dibeli 2 hari lalu
    departureTime: new Date(Date.now() + 2 * 3600 * 1000), // tinggal 2 jam lagi
    isFlightCancelled: true,
    totalPrice: 2000000,
    reason: '',
    hasExistingActiveRefund: false,
    bookingStatus: 'paid',
  })
  assert.strictEqual(t1.shouldAutoApprove, true, 'Harus disetujui otomatis')
  assert.strictEqual(t1.status, 'approved')
  assert.strictEqual(t1.refundAmount, 2000000, 'Refund harus 100% penuh')
  assert.strictEqual(t1.kind, 'flight_cancelled')
  assert.strictEqual(t1.finalReason, 'Penerbangan dibatalkan maskapai')
  console.log('✓ PASS: Disrupsi maskapai 100% Auto-Approved tanpa potongan & tanpa batas H-6')

  console.log('\n--- [TEST 2] Aturan Cooling-Off 24 Jam (Pemesanan Baru) ---')
  const t2 = calculateRefundDecision({
    bookingCreatedAt: new Date(Date.now() - 3 * 3600 * 1000), // baru 3 jam lalu dibeli
    departureTime: new Date(Date.now() + 30 * 3600 * 1000), // 30 jam sebelum terbang
    isFlightCancelled: false,
    totalPrice: 1000000,
    reason: 'Ada urusan keluarga mendadak di luar kota',
    hasExistingActiveRefund: false,
    bookingStatus: 'paid',
  })
  assert.strictEqual(t2.shouldAutoApprove, true, 'Harus disetujui otomatis')
  assert.strictEqual(t2.status, 'approved')
  // 1.000.000 - 200.000 - 25.000 = 775.000
  assert.strictEqual(t2.refundAmount, 775000)
  assert.strictEqual(t2.kind, 'customer')
  console.log('✓ PASS: Cooling-off 24 Jam berhasil Auto-Approved Instan')

  console.log('\n--- [TEST 3] Pesanan di luar 24 Jam (> 1 hari) -> Review Manual Admin (Pending) ---')
  const t3 = calculateRefundDecision({
    bookingCreatedAt: new Date(Date.now() - 50 * 3600 * 1000), // 50 jam lalu
    departureTime: new Date(Date.now() + 30 * 3600 * 1000), // 30 jam sebelum terbang
    isFlightCancelled: false,
    totalPrice: 1000000,
    reason: 'Jadwal kerja bergeser minggu depan',
    hasExistingActiveRefund: false,
    bookingStatus: 'paid',
  })
  assert.strictEqual(t3.shouldAutoApprove, false, 'Tidak boleh auto-approve jika > 24 jam')
  assert.strictEqual(t3.status, 'pending', 'Status harus pending untuk review admin')
  console.log('✓ PASS: Booking > 24 jam masuk antrean pending untuk admin review')

  console.log('\n--- [TEST 4] Keamanan: Jadwal Mendekati Keberangkatan (< 6 Jam) ---')
  assert.throws(
    () => {
      calculateRefundDecision({
        bookingCreatedAt: new Date(Date.now() - 50 * 3600 * 1000),
        departureTime: new Date(Date.now() + 3 * 3600 * 1000), // 3 jam lagi
        isFlightCancelled: false,
        totalPrice: 1000000,
        reason: 'Mau cancel dadakan',
        hasExistingActiveRefund: false,
        bookingStatus: 'paid',
      })
    },
    (err: any) => err.code === 'REFUND_WINDOW_CLOSED',
  )
  console.log('✓ PASS: Refund < 6 jam ditolak aman dengan code REFUND_WINDOW_CLOSED')

  console.log('\n--- [TEST 5] Keamanan: Jadwal Sudah Berangkat ---')
  assert.throws(
    () => {
      calculateRefundDecision({
        bookingCreatedAt: new Date(Date.now() - 50 * 3600 * 1000),
        departureTime: new Date(Date.now() - 1 * 3600 * 1000), // sudah lewat 1 jam
        isFlightCancelled: false,
        totalPrice: 1000000,
        reason: 'Ketinggalan pesawat mau minta uang kembali',
        hasExistingActiveRefund: false,
        bookingStatus: 'paid',
      })
    },
    (err: any) => err.code === 'FLIGHT_ALREADY_DEPARTED',
  )
  console.log('✓ PASS: Pesawat sudah berangkat ditolak FLIGHT_ALREADY_DEPARTED')

  console.log('\n--- [TEST 6] Keamanan: Concurrency / Double Refund Guard ---')
  assert.throws(
    () => {
      calculateRefundDecision({
        bookingCreatedAt: new Date(Date.now() - 2 * 3600 * 1000),
        departureTime: new Date(Date.now() + 40 * 3600 * 1000),
        isFlightCancelled: false,
        totalPrice: 1000000,
        reason: 'Double refund attempt',
        hasExistingActiveRefund: true, // sudah ada refund aktif
        bookingStatus: 'paid',
      })
    },
    (err: any) => err.code === 'REFUND_ALREADY_PENDING',
  )
  console.log('✓ PASS: Double refund dicegah dengan code REFUND_ALREADY_PENDING')

  console.log('\n--- [TEST 7] Keamanan Admin: Penolakan Tiket yang Sudah Disetujui ---')
  assert.throws(
    () => {
      processAdminAction('approved', 'rejected')
    },
    (err: any) => err.code === 'ALREADY_APPROVED',
  )
  const idempotent = processAdminAction('approved', 'approved')
  assert.strictEqual(idempotent.status, 'approved')
  console.log('✓ PASS: Admin dilarang menolak refund yang sudah disetujui (inventaris aman)')

  console.log('\n========================================================')
  console.log('  SEMUA TEST LOGIKA REFUND OTOMATIS & KEAMANAN LULUS!  ')
  console.log('========================================================\n')
}

runTests().catch((e) => {
  console.error(e)
  process.exit(1)
})

