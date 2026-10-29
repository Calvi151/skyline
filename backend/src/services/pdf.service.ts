import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { qrcodeService } from './qrcode.service.js'

export interface ETicketPassenger {
  fullName: string
  idNumber: string
  gender: string
  seatClass: string
  seatNumber: string | null
  baggageName?: string | null
  baggageWeight?: number | null
}

export interface ETicketSegment {
  originCode: string
  originCity: string
  originName: string
  destCode: string
  destCity: string
  destName: string
  departureTime: string
  arrivalTime: string
}

export interface ETicketData {
  bookingCode: string
  bookingDate: string
  totalPrice: number
  status: string
  airlineName: string
  airlineCode?: string | null
  flightNumber: string
  flightType: string
  delayMinutes?: number
  flightStatus?: string
  segments: ETicketSegment[]
  passengers: ETicketPassenger[]
  paymentMethod?: string | null
  paidAt?: string | null
}

export interface BoardingPassData {
  bookingCode: string
  passengerName: string
  idNumber: string
  seatClass: string
  seatNumber: string
  airlineName: string
  airlineCode?: string | null
  flightNumber: string
  flightStatus?: string
  delayMinutes?: number
  originCode: string
  originCity: string
  originName: string
  destCode: string
  destCity: string
  destName: string
  departureTime: string
  boardingTime: string
  gate?: string
  sequenceNumber?: number
  boardingPassCode: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' WIB'
  } catch {
    return dateStr
  }
}

export class PdfService {
  /**
   * Menghasilkan dokumen PDF E-Ticket resmi SkyBook dengan QR Code.
   */
  async generateETicket(data: ETicketData): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // Standar A4 (points)

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const primaryColor = rgb(0.01, 0.52, 0.78) // #0284C7 Sky Blue
    const darkColor = rgb(0.06, 0.09, 0.16) // #0F172A Slate 900
    const mutedColor = rgb(0.39, 0.45, 0.55) // #64748B Slate 500
    const lightBg = rgb(0.96, 0.97, 0.98) // #F8FAFC
    const borderCol = rgb(0.89, 0.91, 0.94) // #E2E8F0
    const greenColor = rgb(0.09, 0.63, 0.36) // #16A34A Success Green

    // ─── 1. Header Banner ───
    page.drawRectangle({
      x: 0,
      y: 760,
      width: 595.28,
      height: 82,
      color: primaryColor,
    })

    page.drawText('SkyBook Airlines', {
      x: 40,
      y: 805,
      size: 20,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    page.drawText('E-TICKET ITINERARY / RECEIPT', {
      x: 40,
      y: 785,
      size: 10,
      font: fontRegular,
      color: rgb(0.9, 0.95, 1),
    })

    page.drawText('BUKTI PEMESANAN ELEKTRONIK RESMI', {
      x: 40,
      y: 770,
      size: 8,
      font: fontRegular,
      color: rgb(0.8, 0.9, 1),
    })

    // Booking Code Badge (Top Right)
    page.drawRectangle({
      x: 410,
      y: 770,
      width: 145,
      height: 55,
      color: rgb(1, 1, 1),
    })

    page.drawText('KODE BOOKING (PNR)', {
      x: 420,
      y: 808,
      size: 8,
      font: fontBold,
      color: mutedColor,
    })

    page.drawText(data.bookingCode, {
      x: 420,
      y: 788,
      size: 16,
      font: fontBold,
      color: primaryColor,
    })

    page.drawText(`STATUS: ${data.status.toUpperCase()}`, {
      x: 420,
      y: 775,
      size: 8,
      font: fontBold,
      color: data.status.toLowerCase() === 'paid' ? greenColor : darkColor,
    })

    let curY = 735

    // ─── 2. Flight Information Box ───
    page.drawRectangle({
      x: 40,
      y: curY - 110,
      width: 515,
      height: 110,
      color: lightBg,
      borderColor: borderCol,
      borderWidth: 1,
    })

    page.drawText('INFORMASI PENERBANGAN', {
      x: 55,
      y: curY - 20,
      size: 10,
      font: fontBold,
      color: darkColor,
    })

    page.drawText(`Maskapai: ${data.airlineName} (${data.flightNumber})`, {
      x: 55,
      y: curY - 35,
      size: 9,
      font: fontBold,
      color: primaryColor,
    })

    const firstSeg = data.segments[0]
    const lastSeg = data.segments[data.segments.length - 1]

    if (firstSeg && lastSeg) {
      // Keberangkatan
      page.drawText('KEBERANGKATAN', {
        x: 55,
        y: curY - 55,
        size: 8,
        font: fontBold,
        color: mutedColor,
      })
      page.drawText(firstSeg.originCode, {
        x: 55,
        y: curY - 72,
        size: 14,
        font: fontBold,
        color: darkColor,
      })
      page.drawText(`${firstSeg.originCity} (${firstSeg.originName.substring(0, 22)})`, {
        x: 55,
        y: curY - 84,
        size: 8,
        font: fontRegular,
        color: darkColor,
      })
      page.drawText(`${formatDate(firstSeg.departureTime)} | ${formatTime(firstSeg.departureTime)}`, {
        x: 55,
        y: curY - 96,
        size: 8,
        font: fontBold,
        color: primaryColor,
      })

      // Simbol Panah
      page.drawText('------>', {
        x: 235,
        y: curY - 72,
        size: 12,
        font: fontBold,
        color: mutedColor,
      })
      page.drawText(data.flightType === 'transit' ? 'Transit' : 'Langsung (Direct)', {
        x: 220,
        y: curY - 86,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      })

      // Kedatangan
      page.drawText('KEDATANGAN', {
        x: 340,
        y: curY - 55,
        size: 8,
        font: fontBold,
        color: mutedColor,
      })
      page.drawText(lastSeg.destCode, {
        x: 340,
        y: curY - 72,
        size: 14,
        font: fontBold,
        color: darkColor,
      })
      page.drawText(`${lastSeg.destCity} (${lastSeg.destName.substring(0, 22)})`, {
        x: 340,
        y: curY - 84,
        size: 8,
        font: fontRegular,
        color: darkColor,
      })
      page.drawText(`${formatDate(lastSeg.arrivalTime)} | ${formatTime(lastSeg.arrivalTime)}`, {
        x: 340,
        y: curY - 96,
        size: 8,
        font: fontBold,
        color: primaryColor,
      })
    }

    curY -= 130

    // ─── 3. Passenger Details Table ───
    page.drawText('DAFTAR PENUMPANG & KURSI', {
      x: 40,
      y: curY,
      size: 10,
      font: fontBold,
      color: darkColor,
    })

    curY -= 15

    // Table Header
    page.drawRectangle({
      x: 40,
      y: curY - 18,
      width: 515,
      height: 20,
      color: rgb(0.93, 0.95, 0.98),
      borderColor: borderCol,
      borderWidth: 1,
    })

    page.drawText('No', { x: 48, y: curY - 12, size: 8, font: fontBold, color: darkColor })
    page.drawText('Nama Penumpang', { x: 75, y: curY - 12, size: 8, font: fontBold, color: darkColor })
    page.drawText('No. Identitas', { x: 220, y: curY - 12, size: 8, font: fontBold, color: darkColor })
    page.drawText('Kelas', { x: 330, y: curY - 12, size: 8, font: fontBold, color: darkColor })
    page.drawText('Kursi', { x: 395, y: curY - 12, size: 8, font: fontBold, color: darkColor })
    page.drawText('Bagasi Tambahan', { x: 450, y: curY - 12, size: 8, font: fontBold, color: darkColor })

    curY -= 18

    // Table Rows
    data.passengers.forEach((p, idx) => {
      const rowHeight = 22
      page.drawRectangle({
        x: 40,
        y: curY - rowHeight,
        width: 515,
        height: rowHeight,
        color: idx % 2 === 0 ? rgb(1, 1, 1) : lightBg,
        borderColor: borderCol,
        borderWidth: 0.5,
      })

      page.drawText(String(idx + 1), {
        x: 48,
        y: curY - 15,
        size: 8,
        font: fontRegular,
        color: darkColor,
      })

      page.drawText(p.fullName.substring(0, 24), {
        x: 75,
        y: curY - 15,
        size: 8,
        font: fontBold,
        color: darkColor,
      })

      page.drawText(p.idNumber, {
        x: 220,
        y: curY - 15,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      })

      page.drawText(p.seatClass === 'business' ? 'Bisnis' : 'Ekonomi', {
        x: 330,
        y: curY - 15,
        size: 8,
        font: fontRegular,
        color: darkColor,
      })

      page.drawText(p.seatNumber || '-', {
        x: 395,
        y: curY - 15,
        size: 8,
        font: fontBold,
        color: primaryColor,
      })

      const baggageLabel = p.baggageName
        ? `${p.baggageWeight ? p.baggageWeight + 'kg' : p.baggageName}`
        : 'Kabin 7kg'
      page.drawText(baggageLabel, {
        x: 450,
        y: curY - 15,
        size: 8,
        font: fontRegular,
        color: darkColor,
      })

      curY -= rowHeight
    })

    curY -= 20

    // ─── 4. QR Code & Payment Summary Section ───
    const boxHeight = 110
    page.drawRectangle({
      x: 40,
      y: curY - boxHeight,
      width: 515,
      height: boxHeight,
      color: lightBg,
      borderColor: borderCol,
      borderWidth: 1,
    })

    // Generate QR Code
    const qrPayload = JSON.stringify({
      pnr: data.bookingCode,
      flight: data.flightNumber,
      passengers: data.passengers.length,
      total: data.totalPrice,
      status: data.status,
    })

    const qrBuffer = await qrcodeService.generateQrCodeBuffer(qrPayload, 180)
    const qrImage = await pdfDoc.embedPng(qrBuffer)

    page.drawImage(qrImage, {
      x: 55,
      y: curY - 95,
      width: 80,
      height: 80,
    })

    page.drawText('Scan Kode Verifikasi', {
      x: 55,
      y: curY - 105,
      size: 7,
      font: fontRegular,
      color: mutedColor,
    })

    // Rincian Pembayaran
    page.drawText('RINCIAN PEMBAYARAN', {
      x: 155,
      y: curY - 20,
      size: 9,
      font: fontBold,
      color: darkColor,
    })

    page.drawText('Total Biaya Tiket & Bagasi:', {
      x: 155,
      y: curY - 40,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    })
    page.drawText(formatCurrency(data.totalPrice), {
      x: 300,
      y: curY - 40,
      size: 11,
      font: fontBold,
      color: primaryColor,
    })

    page.drawText('Metode Pembayaran:', {
      x: 155,
      y: curY - 58,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    })
    page.drawText((data.paymentMethod || 'Midtrans Payment Gateway').toUpperCase(), {
      x: 300,
      y: curY - 58,
      size: 8,
      font: fontBold,
      color: darkColor,
    })

    page.drawText('Tanggal Pemesanan:', {
      x: 155,
      y: curY - 74,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    })
    page.drawText(formatDate(data.bookingDate), {
      x: 300,
      y: curY - 74,
      size: 8,
      font: fontRegular,
      color: darkColor,
    })

    page.drawText('Status Pembayaran:', {
      x: 155,
      y: curY - 90,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    })
    page.drawText('LUNAS / TERKONFIRMASI', {
      x: 300,
      y: curY - 90,
      size: 8,
      font: fontBold,
      color: greenColor,
    })

    curY -= boxHeight + 25

    // ─── 5. Important Notices / Terms ───
    page.drawText('KETENTUAN PENTING & INFORMASI PENERBANGAN:', {
      x: 40,
      y: curY,
      size: 9,
      font: fontBold,
      color: darkColor,
    })

    curY -= 15
    const rules = [
      '1. Tunjukkan e-tiket ini bersama identitas resmi (KTP/SIM/Paspor) saat check-in bandara atau boarding.',
      '2. Web Check-in online dibuka mulai H-24 jam sebelum keberangkatan melalui menu Check-in SkyBook.',
      '3. Penumpang disarankan tiba di bandara selambat-lambatnya 90-120 menit sebelum jadwal keberangkatan.',
      '4. Ketentuan bagasi kabin maksimal 7 kg per penumpang. Kelebihan bagasi dikenakan biaya sesuai regulasi.',
      '5. E-tiket ini diterbitkan secara otomatis dan valid sebagai bukti tanda pembayaran resmi SkyBook.',
    ]

    rules.forEach((rule) => {
      page.drawText(rule, {
        x: 40,
        y: curY,
        size: 7.5,
        font: fontRegular,
        color: mutedColor,
      })
      curY -= 12
    })

    // Footer note
    page.drawText(
      'Simulasi Sistem Tiket SkyBook | Hubungi bantuan pelanggan jika ada kendala pemesanan.',
      {
        x: 40,
        y: 35,
        size: 7,
        font: fontRegular,
        color: mutedColor,
      },
    )

    return await pdfDoc.save()
  }

  /**
   * Menghasilkan dokumen Boarding Pass resmi SkyBook dalam format PDF dengan QR Code.
   */
  async generateBoardingPass(data: BoardingPassData): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // Standar A4

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const primaryColor = rgb(0.01, 0.52, 0.78) // #0284C7 Sky Blue
    const darkColor = rgb(0.06, 0.09, 0.16) // #0F172A Slate 900
    const mutedColor = rgb(0.39, 0.45, 0.55) // #64748B Slate 500
    const lightBg = rgb(0.96, 0.97, 0.98) // #F8FAFC
    const borderCol = rgb(0.89, 0.91, 0.94) // #E2E8F0
    const accentCoral = rgb(0.94, 0.38, 0.28) // #F06247 Coral Accent

    // ─── Header ───
    page.drawText('SkyBook Airlines', {
      x: 40,
      y: 805,
      size: 20,
      font: fontBold,
      color: primaryColor,
    })

    page.drawText('OFFICIAL BOARDING PASS / KARTU MASUK PESAWAT', {
      x: 40,
      y: 788,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    })

    // ─── Main Boarding Pass Card Container ───
    const cardX = 40
    const cardY = 520
    const cardW = 515
    const cardH = 250

    // Background kartu
    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      color: lightBg,
      borderColor: borderCol,
      borderWidth: 1,
    })

    // Banner Atas Kartu (Header Banner)
    page.drawRectangle({
      x: cardX,
      y: cardY + cardH - 45,
      width: cardW,
      height: 45,
      color: primaryColor,
    })

    page.drawText('BOARDING PASS', {
      x: cardX + 20,
      y: cardY + cardH - 28,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    page.drawText(`${data.airlineName} | ${data.flightNumber}`, {
      x: cardX + 180,
      y: cardY + cardH - 28,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    page.drawText(`PNR: ${data.bookingCode}`, {
      x: cardX + 380,
      y: cardY + cardH - 28,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    // Garis putus-putus pembatas stub (Perforation line) di x = cardX + 360
    const stubX = cardX + 360
    for (let py = cardY; py < cardY + cardH - 45; py += 8) {
      page.drawLine({
        start: { x: stubX, y: py },
        end: { x: stubX, y: py + 4 },
        thickness: 1,
        color: borderCol,
      })
    }

    // ─── Bagian Kiri (Main Pass) ───
    // Nama Penumpang
    page.drawText('NAMA PENUMPANG / PASSENGER NAME', {
      x: cardX + 20,
      y: cardY + cardH - 65,
      size: 7,
      font: fontBold,
      color: mutedColor,
    })
    page.drawText(data.passengerName.toUpperCase(), {
      x: cardX + 20,
      y: cardY + cardH - 80,
      size: 12,
      font: fontBold,
      color: darkColor,
    })
    page.drawText(`ID/NIK: ${data.idNumber}`, {
      x: cardX + 20,
      y: cardY + cardH - 92,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    })

    // Rute Asal -> Tujuan
    page.drawText('DARI / FROM', {
      x: cardX + 20,
      y: cardY + cardH - 112,
      size: 7,
      font: fontBold,
      color: mutedColor,
    })
    page.drawText(data.originCode, {
      x: cardX + 20,
      y: cardY + cardH - 130,
      size: 18,
      font: fontBold,
      color: darkColor,
    })
    page.drawText(data.originCity, {
      x: cardX + 20,
      y: cardY + cardH - 142,
      size: 8,
      font: fontRegular,
      color: darkColor,
    })

    page.drawText('--->', {
      x: cardX + 90,
      y: cardY + cardH - 130,
      size: 14,
      font: fontBold,
      color: mutedColor,
    })

    page.drawText('KE / TO', {
      x: cardX + 150,
      y: cardY + cardH - 112,
      size: 7,
      font: fontBold,
      color: mutedColor,
    })
    page.drawText(data.destCode, {
      x: cardX + 150,
      y: cardY + cardH - 130,
      size: 18,
      font: fontBold,
      color: darkColor,
    })
    page.drawText(data.destCity, {
      x: cardX + 150,
      y: cardY + cardH - 142,
      size: 8,
      font: fontRegular,
      color: darkColor,
    })

    // Tanggal Penerbangan
    page.drawText('TANGGAL / DATE', {
      x: cardX + 250,
      y: cardY + cardH - 112,
      size: 7,
      font: fontBold,
      color: mutedColor,
    })
    page.drawText(formatDate(data.departureTime), {
      x: cardX + 250,
      y: cardY + cardH - 128,
      size: 9,
      font: fontBold,
      color: darkColor,
    })

    // Callout Box: GATE, BOARDING TIME, SEAT
    const boxY = cardY + 20

    // Gate Box
    page.drawRectangle({
      x: cardX + 20,
      y: boxY,
      width: 65,
      height: 48,
      color: rgb(1, 1, 1),
      borderColor: borderCol,
      borderWidth: 1,
    })
    page.drawText('GATE', { x: cardX + 28, y: boxY + 34, size: 7, font: fontBold, color: mutedColor })
    page.drawText(data.gate || '3A', { x: cardX + 28, y: boxY + 12, size: 16, font: fontBold, color: darkColor })

    // Boarding Time Box
    page.drawRectangle({
      x: cardX + 95,
      y: boxY,
      width: 100,
      height: 48,
      color: rgb(1, 1, 1),
      borderColor: borderCol,
      borderWidth: 1,
    })
    page.drawText('BOARDING TIME', { x: cardX + 103, y: boxY + 34, size: 7, font: fontBold, color: mutedColor })
    page.drawText(data.boardingTime, { x: cardX + 103, y: boxY + 14, size: 13, font: fontBold, color: primaryColor })

    // Seat Box (Accent Highlight)
    page.drawRectangle({
      x: cardX + 205,
      y: boxY,
      width: 70,
      height: 48,
      color: rgb(0.9, 0.95, 1),
      borderColor: primaryColor,
      borderWidth: 1.5,
    })
    page.drawText('SEAT', { x: cardX + 215, y: boxY + 34, size: 7, font: fontBold, color: primaryColor })
    page.drawText(data.seatNumber, { x: cardX + 215, y: boxY + 10, size: 20, font: fontBold, color: primaryColor })

    // Class & Seq
    page.drawText(`KELAS: ${(data.seatClass === 'business' ? 'BISNIS' : 'EKONOMI')}`, {
      x: cardX + 285,
      y: boxY + 30,
      size: 7.5,
      font: fontBold,
      color: darkColor,
    })
    page.drawText(`SEQ NO: #${String(data.sequenceNumber || 1).padStart(3, '0')}`, {
      x: cardX + 285,
      y: boxY + 14,
      size: 7.5,
      font: fontRegular,
      color: mutedColor,
    })

    // Status Delay jika ada
    if (data.delayMinutes && data.delayMinutes > 0) {
      page.drawText(`* Tertunda ${data.delayMinutes} mnt. Jam boarding telah disesuaikan.`, {
        x: cardX + 20,
        y: boxY - 12,
        size: 7.5,
        font: fontBold,
        color: accentCoral,
      })
    }

    // ─── Bagian Kanan (Passenger Tear-off Stub) ───
    page.drawText('PASSENGER COUPON', {
      x: stubX + 15,
      y: cardY + cardH - 60,
      size: 8,
      font: fontBold,
      color: primaryColor,
    })

    page.drawText(data.passengerName.substring(0, 16).toUpperCase(), {
      x: stubX + 15,
      y: cardY + cardH - 76,
      size: 9,
      font: fontBold,
      color: darkColor,
    })

    page.drawText(`${data.originCode} ---> ${data.destCode}`, {
      x: stubX + 15,
      y: cardY + cardH - 92,
      size: 10,
      font: fontBold,
      color: darkColor,
    })

    page.drawText(`Flight: ${data.flightNumber}`, {
      x: stubX + 15,
      y: cardY + cardH - 108,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    })

    page.drawText(`Seat: ${data.seatNumber} (${data.seatClass === 'business' ? 'B' : 'Y'})`, {
      x: stubX + 15,
      y: cardY + cardH - 122,
      size: 10,
      font: fontBold,
      color: primaryColor,
    })

    page.drawText(`Gate: ${data.gate || '3A'} | ${data.boardingTime}`, {
      x: stubX + 15,
      y: cardY + cardH - 136,
      size: 8,
      font: fontRegular,
      color: darkColor,
    })

    // Generate QR Code untuk Boarding Pass
    const qrPayload = JSON.stringify({
      bp: data.boardingPassCode,
      pnr: data.bookingCode,
      name: data.passengerName,
      flight: data.flightNumber,
      seat: data.seatNumber,
      gate: data.gate || '3A',
    })

    const qrBuffer = await qrcodeService.generateQrCodeBuffer(qrPayload, 160)
    const qrImage = await pdfDoc.embedPng(qrBuffer)

    page.drawImage(qrImage, {
      x: stubX + 35,
      y: cardY + 20,
      width: 75,
      height: 75,
    })

    page.drawText(data.boardingPassCode, {
      x: stubX + 22,
      y: cardY + 8,
      size: 6.5,
      font: fontBold,
      color: mutedColor,
    })

    // ─── Aturan & Panduan Masuk Boarding (Bawah Kartu) ───
    let infoY = cardY - 40
    page.drawText('PETUNJUK KESELAMATAN & KEBERANGKATAN DI BANDARA:', {
      x: 40,
      y: infoY,
      size: 9,
      font: fontBold,
      color: darkColor,
    })

    infoY -= 15
    const guidelines = [
      '1. Harap berada di ruang tunggu keberangkatan (Boarding Gate) selambat-lambatnya pada Jam Boarding yang tertera di atas.',
      '2. Pintu pesawat (Gate) ditutup 15 menit sebelum waktu keberangkatan. Penumpang yang terlambat tidak dapat dinaikkan ke pesawat.',
      '3. Siapkan kartu identitas resmi asli (KTP/SIM/Paspor) yang masih berlaku untuk diverifikasi oleh petugas bersama boarding pass ini.',
      '4. Perhatikan layar informasi bandara (FIDS) dan pengumuman resmi berkala jika terjadi perubahan gate atau waktu boarding.',
      '5. Maksimal bagasi kabin 1 koper/tas (maks 7 kg) plus 1 barang bawaan pribadi (tas laptop/tas tangan).',
    ]

    guidelines.forEach((line) => {
      page.drawText(line, {
        x: 40,
        y: infoY,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      })
      infoY -= 14
    })

    // Footer
    page.drawText(
      'Boarding pass digital ini diterbitkan secara sah oleh sistem SkyBook Ticketing.',
      {
        x: 40,
        y: 40,
        size: 7,
        font: fontRegular,
        color: mutedColor,
      },
    )

    return await pdfDoc.save()
  }
}

export const pdfService = new PdfService()

