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
  airplaneModel?: string | null
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
  arrivalTime?: string
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
   * Menggambar siluet/ilustrasi vektor kota tujuan pada Boarding Pass PDF
   * agar ukuran file tetap ringan namun memiliki identitas visual kota tujuan.
   */
  private drawCityVectorIllustration(
    page: any,
    destCode: string,
    destCity: string,
    baseX: number,
    baseY: number,
    width: number,
    color: any,
    accentColor: any,
  ) {
    const code = (destCode || '').toUpperCase()
    const city = (destCity || '').toLowerCase()

    // Base horizon line
    page.drawRectangle({
      x: baseX,
      y: baseY,
      width,
      height: 1.5,
      color,
    })

    if (code === 'JFK' || code === 'NYC' || code === 'EWR' || city.includes('new york')) {
      // New York: Manhattan Skyscrapers + Empire State + Statue of Liberty
      const buildings = [
        { dx: 12, w: 10, h: 18 },
        { dx: 24, w: 12, h: 26 },
        { dx: 38, w: 14, h: 36 }, // Empire State base
        { dx: 54, w: 10, h: 22 },
        { dx: 66, w: 12, h: 28 },
        { dx: 80, w: 9, h: 16 },
      ]
      buildings.forEach((b) => {
        page.drawRectangle({ x: baseX + b.dx, y: baseY, width: b.w, height: b.h, color })
      })
      // Empire State Spire
      page.drawRectangle({ x: baseX + 41, y: baseY + 36, width: 8, height: 6, color })
      page.drawRectangle({ x: baseX + 44, y: baseY + 42, width: 2, height: 9, color })
      // Statue of Liberty pedestal & figure on right
      page.drawRectangle({ x: baseX + 102, y: baseY, width: 14, height: 14, color })
      page.drawRectangle({ x: baseX + 105, y: baseY + 14, width: 8, height: 18, color })
      page.drawLine({
        start: { x: baseX + 111, y: baseY + 28 },
        end: { x: baseX + 116, y: baseY + 40 },
        thickness: 2,
        color,
      })
      page.drawCircle({ x: baseX + 116.5, y: baseY + 42, size: 2.5, color: accentColor })
    } else if (code === 'DPS' || city.includes('bali') || city.includes('denpasar')) {
      // Bali: Candi Bentar Split Gate + Pura Ulun Danu Multi-tier Meru Pagoda
      page.drawCircle({ x: baseX + 68, y: baseY + 20, size: 16, color: accentColor })
      // Left Candi Bentar
      page.drawRectangle({ x: baseX + 18, y: baseY, width: 8, height: 28, color })
      page.drawRectangle({ x: baseX + 14, y: baseY, width: 4, height: 18, color })
      // Right Candi Bentar
      page.drawRectangle({ x: baseX + 34, y: baseY, width: 8, height: 28, color })
      page.drawRectangle({ x: baseX + 42, y: baseY, width: 4, height: 18, color })
      // Pura Meru Pagoda Tiers (Right)
      const meruX = baseX + 82
      page.drawRectangle({ x: meruX + 6, y: baseY, width: 24, height: 8, color })
      const tiers = [
        { y: 8, w: 32, h: 4 },
        { y: 14, w: 26, h: 4 },
        { y: 20, w: 20, h: 4 },
        { y: 26, w: 14, h: 4 },
        { y: 32, w: 8, h: 4 },
      ]
      tiers.forEach((t) => {
        page.drawRectangle({
          x: meruX + 18 - t.w / 2,
          y: baseY + t.y,
          width: t.w,
          height: t.h,
          color,
        })
      })
      page.drawRectangle({ x: meruX + 17, y: baseY + 36, width: 2, height: 6, color })
    } else if (code === 'CGK' || code === 'HLP' || city.includes('jakarta')) {
      // Jakarta: Monas Obelisk + Flame + Sudirman Skyline
      page.drawRectangle({ x: baseX + 14, y: baseY, width: 11, height: 22, color })
      page.drawRectangle({ x: baseX + 28, y: baseY, width: 13, height: 32, color })
      page.drawRectangle({ x: baseX + 44, y: baseY, width: 10, height: 18, color })
      // Monas Base & Cup
      page.drawRectangle({ x: baseX + 76, y: baseY, width: 26, height: 6, color })
      page.drawRectangle({ x: baseX + 82, y: baseY + 6, width: 14, height: 5, color })
      // Monas Obelisk Tower
      page.drawRectangle({ x: baseX + 86.5, y: baseY + 11, width: 5, height: 25, color })
      page.drawRectangle({ x: baseX + 84, y: baseY + 36, width: 10, height: 2.5, color })
      // Flame
      page.drawCircle({ x: baseX + 89, y: baseY + 42, size: 3, color: accentColor })
      page.drawRectangle({ x: baseX + 110, y: baseY, width: 12, height: 26, color })
    } else if (code === 'YIA' || code === 'JOG' || city.includes('yogyakarta')) {
      // Yogyakarta: Tugu Jogja + Candi Stupas
      page.drawRectangle({ x: baseX + 20, y: baseY, width: 14, height: 8, color })
      page.drawRectangle({ x: baseX + 23, y: baseY + 8, width: 8, height: 18, color })
      page.drawRectangle({ x: baseX + 25.5, y: baseY + 26, width: 3, height: 12, color })
      page.drawCircle({ x: baseX + 27, y: baseY + 40, size: 2.5, color: accentColor })
      // Prambanan / Borobudur Stupa Silhouettes
      page.drawRectangle({ x: baseX + 68, y: baseY, width: 14, height: 22, color })
      page.drawRectangle({ x: baseX + 86, y: baseY, width: 16, height: 34, color })
      page.drawRectangle({ x: baseX + 91, y: baseY + 34, width: 6, height: 7, color })
      page.drawRectangle({ x: baseX + 106, y: baseY, width: 14, height: 22, color })
    } else {
      // Modern Architectural City Skyline & Archipelago Bridge
      const skyline = [
        { dx: 14, w: 11, h: 18 },
        { dx: 28, w: 14, h: 30 },
        { dx: 45, w: 10, h: 22 },
        { dx: 58, w: 15, h: 36 },
        { dx: 76, w: 12, h: 25 },
        { dx: 91, w: 14, h: 32 },
        { dx: 108, w: 10, h: 20 },
      ]
      skyline.forEach((b) => {
        page.drawRectangle({ x: baseX + b.dx, y: baseY, width: b.w, height: b.h, color })
      })
      page.drawCircle({ x: baseX + 65.5, y: baseY + 40, size: 2.5, color: accentColor })
    }
  }

  /**
   * Menghasilkan dokumen Boarding Pass resmi SkyBook dalam format PDF
   * dengan desain gabungan Figma Frame Biru + Lengkungan Rute Dribbble + Siluet Vektor Kota Tujuan.
   */
  async generateBoardingPass(data: BoardingPassData): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // Standar A4

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Palet Warna Desain (Figma + SkyBook Design System)
    const frameBlue = rgb(0.14, 0.41, 0.72) // #2468B8 Outer Figma Frame Blue
    const bannerNavy = rgb(0.04, 0.15, 0.27) // #0B2545 Panoramic Header Dark Navy
    const bannerHorizon = rgb(0.09, 0.24, 0.44) // #173D70 Inner Banner Strip
    const silhouetteCol = rgb(0.16, 0.36, 0.62) // Vector City Silhouette on Banner
    const silhouetteAccent = rgb(0.29, 0.56, 0.89) // Highlight on Vector Silhouette
    const watermarkCol = rgb(0.93, 0.96, 0.99) // Subtle Route Background Watermark
    const primaryBlue = rgb(0.11, 0.36, 0.84) // #1D5BD6 Brand Blue
    const darkInk = rgb(0.04, 0.15, 0.27) // #0B2545 Ink
    const mutedSlate = rgb(0.33, 0.4, 0.5) // #54677F Subtle
    const cardWhite = rgb(0.99, 0.995, 1) // #FAFCFF Panel
    const stubPanel = rgb(0.96, 0.98, 1) // #F5F9FF Stub Background
    const borderCol = rgb(0.8, 0.85, 0.9) // #CBD8E6 Line
    const signalOrange = rgb(0.91, 0.33, 0.18) // #E8532F Seat Highlight Orange
    const signalBg = rgb(1, 0.95, 0.93) // #FFF2EE Seat Callout Fill
    const tintBg = rgb(0.89, 0.94, 0.99) // #E3F0FC Gate Callout Fill
    const dangerRed = rgb(0.69, 0.12, 0.24) // #B01E3C Boarding Time Alert

    // Helper waktu singkat HH.MM
    const formatShortTime = (iso?: string) => {
      if (!iso) return '07.40'
      try {
        const d = new Date(iso)
        return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
      } catch {
        return '07.40'
      }
    }

    // Hitung durasi penerbangan
    const calcDuration = (depIso?: string, arrIso?: string) => {
      if (!depIso || !arrIso) return '1j 50m'
      try {
        const diffMins = Math.max(
          30,
          Math.round((new Date(arrIso).getTime() - new Date(depIso).getTime()) / 60000),
        )
        const h = Math.floor(diffMins / 60)
        const m = diffMins % 60
        return h > 0 ? `${h}j ${m}m` : `${m}m`
      } catch {
        return '1j 50m'
      }
    }

    const destTz = data.destCode === 'DPS' || data.destCode === 'UPG' || data.destCode === 'BPN'
      ? 'WITA'
      : data.destCode === 'JFK' || data.destCode === 'NYC'
        ? 'EDT'
        : 'WIB'

    const depTimeStr = `${formatShortTime(data.departureTime)} WIB`
    const arrTimeStr = data.arrivalTime
      ? `${formatShortTime(data.arrivalTime)} ${destTz}`
      : `10.30 ${destTz}`
    const durationStr = `${calcDuration(data.departureTime, data.arrivalTime)} • Langsung`

    // ─── 1. Document Top Header ───
    page.drawText('SkyBook Airlines', {
      x: 34,
      y: 804,
      size: 18,
      font: fontBold,
      color: primaryBlue,
    })

    page.drawText('OFFICIAL BOARDING PASS • KARTU MASUK PESAWAT RESMI', {
      x: 34,
      y: 790,
      size: 8,
      font: fontBold,
      color: mutedSlate,
    })

    page.drawText(`KODE RESERVASI (PNR): ${data.bookingCode}`, {
      x: 420,
      y: 800,
      size: 9,
      font: fontBold,
      color: darkInk,
    })
    page.drawText(`SEQ NO: #${String(data.sequenceNumber || 1).padStart(3, '0')} • STATUS: CHECKED-IN`, {
      x: 420,
      y: 789,
      size: 7,
      font: fontRegular,
      color: mutedSlate,
    })

    // ─── 2. Outer Blue Frame (Gaya Figma User) ───
    const outerX = 32
    const outerY = 472
    const outerW = 531
    const outerH = 302

    page.drawRectangle({
      x: outerX,
      y: outerY,
      width: outerW,
      height: outerH,
      color: frameBlue,
    })

    // Inner White Ticket Card
    const cardX = outerX + 7
    const cardY = outerY + 7
    const cardW = outerW - 14 // 517
    const cardH = outerH - 14 // 288
    const stubX = cardX + 362 // Perforation divider X coordinate
    const leftW = stubX - cardX // 362
    const rightW = cardW - leftW // 155

    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      color: cardWhite,
    })

    // Right Stub Subtle Panel Fill
    page.drawRectangle({
      x: stubX,
      y: cardY,
      width: rightW,
      height: cardH,
      color: stubPanel,
    })

    // ─── 3. Left Section Top: Panoramic Destination Header Banner + Vector City Silhouette ───
    const bannerH = 60
    const bannerY = cardY + cardH - bannerH

    page.drawRectangle({
      x: cardX,
      y: bannerY,
      width: leftW,
      height: bannerH,
      color: bannerNavy,
    })

    // Lower horizon strip inside banner
    page.drawRectangle({
      x: cardX,
      y: bannerY,
      width: leftW,
      height: 16,
      color: bannerHorizon,
    })

    // Vector City Silhouette Artwork on Header Banner (Right-Center of Banner)
    this.drawCityVectorIllustration(
      page,
      data.destCode,
      data.destCity,
      cardX + 165,
      bannerY + 4,
      130,
      silhouetteCol,
      silhouetteAccent,
    )

    // Airline Icon Box in Banner
    const airlineInitial = (data.airlineCode || data.flightNumber.slice(0, 2) || 'SB').toUpperCase()
    page.drawRectangle({
      x: cardX + 14,
      y: bannerY + 15,
      width: 28,
      height: 28,
      color: primaryBlue,
      borderColor: silhouetteAccent,
      borderWidth: 1,
    })
    page.drawText(airlineInitial, {
      x: cardX + 20,
      y: bannerY + 25,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    // Airline Name & Aircraft Specs
    page.drawText(data.airlineName, {
      x: cardX + 48,
      y: bannerY + 34,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    page.drawText(
      `Penerbangan ${data.flightNumber} • ${data.airplaneModel || 'Boeing 737-800'}`,
      {
        x: cardX + 48,
        y: bannerY + 21,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.82, 0.9, 1),
      },
    )

    page.drawText(`DESTINASI: ${data.destCity.toUpperCase()} (${data.destCode})`, {
      x: cardX + 48,
      y: bannerY + 7,
      size: 6.5,
      font: fontBold,
      color: rgb(0.62, 0.82, 1),
    })

    // Cabin Class Badge (Top Right of Left Section)
    const classLabel = data.seatClass === 'business' ? 'KELAS BISNIS' : 'KELAS EKONOMI'
    page.drawRectangle({
      x: cardX + leftW - 88,
      y: bannerY + 32,
      width: 74,
      height: 16,
      color: rgb(1, 1, 1),
    })
    page.drawText(classLabel, {
      x: cardX + leftW - 81,
      y: bannerY + 37,
      size: 6.5,
      font: fontBold,
      color: primaryBlue,
    })

    // Departure Date under Class Badge
    page.drawText(formatDate(data.departureTime), {
      x: cardX + leftW - 88,
      y: bannerY + 19,
      size: 7.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    // ─── 4. Route & Timing Showcase + Curved Flight Trajectory + Watermark ───
    const routeBottomY = cardY + 86

    // Subtle Vector City Silhouette Watermark in Route Area
    this.drawCityVectorIllustration(
      page,
      data.destCode,
      data.destCity,
      cardX + 115,
      routeBottomY + 4,
      135,
      watermarkCol,
      watermarkCol,
    )

    // Origin (Left)
    page.drawText('KEBERANGKATAN • ORIGIN', {
      x: cardX + 16,
      y: bannerY - 18,
      size: 6,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(data.originCode, {
      x: cardX + 16,
      y: bannerY - 46,
      size: 28,
      font: fontBold,
      color: darkInk,
    })
    page.drawText(depTimeStr, {
      x: cardX + 16,
      y: bannerY - 62,
      size: 10,
      font: fontBold,
      color: primaryBlue,
    })
    page.drawText(data.originCity, {
      x: cardX + 16,
      y: bannerY - 75,
      size: 8.5,
      font: fontBold,
      color: darkInk,
    })
    page.drawText(data.originName.substring(0, 28), {
      x: cardX + 16,
      y: bannerY - 86,
      size: 7,
      font: fontRegular,
      color: mutedSlate,
    })

    // Center: Dribbble-Style Curved Flight Arc & Duration Pill
    const arcCenterX = cardX + 181
    const arcBaseY = bannerY - 52

    // Duration Pill Box
    page.drawRectangle({
      x: arcCenterX - 42,
      y: arcBaseY + 22,
      width: 84,
      height: 14,
      color: tintBg,
      borderColor: borderCol,
      borderWidth: 0.6,
    })
    page.drawText(durationStr, {
      x: arcCenterX - 33,
      y: arcBaseY + 26,
      size: 6.5,
      font: fontBold,
      color: primaryBlue,
    })

    // Curved Dashed Trajectory Arc (approximated with parabolic segments)
    const arcStartX = arcCenterX - 54
    const arcEndX = arcCenterX + 54
    const steps = 12
    for (let i = 0; i < steps; i++) {
      if (i % 2 === 1) continue // dashed effect
      const t1 = i / steps
      const t2 = (i + 0.7) / steps
      const x1 = arcStartX + (arcEndX - arcStartX) * t1
      const x2 = arcStartX + (arcEndX - arcStartX) * t2
      const y1 = arcBaseY + 12 * (1 - Math.pow(2 * t1 - 1, 2))
      const y2 = arcBaseY + 12 * (1 - Math.pow(2 * t2 - 1, 2))
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: 1.4,
        color: primaryBlue,
      })
    }

    // Origin & Destination Arc Nodes
    page.drawCircle({ x: arcStartX, y: arcBaseY, size: 3, color: primaryBlue })
    page.drawCircle({ x: arcEndX, y: arcBaseY, size: 3, color: signalOrange })

    // Center Plane Badge on Curve Apex (Vector Airplane Icon)
    const planeCy = arcBaseY + 12
    page.drawCircle({
      x: arcCenterX,
      y: planeCy,
      size: 8.5,
      color: tintBg,
      borderColor: primaryBlue,
      borderWidth: 0.9,
    })
    // Fuselage
    page.drawLine({
      start: { x: arcCenterX - 4.5, y: planeCy },
      end: { x: arcCenterX + 4.5, y: planeCy },
      thickness: 1.8,
      color: primaryBlue,
    })
    // Main swept wings
    page.drawLine({
      start: { x: arcCenterX - 1.5, y: planeCy + 4.5 },
      end: { x: arcCenterX + 1.5, y: planeCy },
      thickness: 1.5,
      color: primaryBlue,
    })
    page.drawLine({
      start: { x: arcCenterX - 1.5, y: planeCy - 4.5 },
      end: { x: arcCenterX + 1.5, y: planeCy },
      thickness: 1.5,
      color: primaryBlue,
    })
    // Tail fin
    page.drawLine({
      start: { x: arcCenterX - 4.5, y: planeCy + 2.2 },
      end: { x: arcCenterX - 3, y: planeCy },
      thickness: 1.2,
      color: primaryBlue,
    })
    page.drawLine({
      start: { x: arcCenterX - 4.5, y: planeCy - 2.2 },
      end: { x: arcCenterX - 3, y: planeCy },
      thickness: 1.2,
      color: primaryBlue,
    })

    page.drawText('NON-STOP FLIGHT', {
      x: arcCenterX - 30,
      y: arcBaseY - 12,
      size: 6,
      font: fontBold,
      color: mutedSlate,
    })

    // Destination (Right of Left Section)
    const destColX = cardX + leftW - 108
    page.drawText('TUJUAN • DESTINATION', {
      x: destColX,
      y: bannerY - 18,
      size: 6,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(data.destCode, {
      x: destColX,
      y: bannerY - 46,
      size: 28,
      font: fontBold,
      color: darkInk,
    })
    page.drawText(arrTimeStr, {
      x: destColX,
      y: bannerY - 62,
      size: 10,
      font: fontBold,
      color: primaryBlue,
    })
    page.drawText(data.destCity, {
      x: destColX,
      y: bannerY - 75,
      size: 8.5,
      font: fontBold,
      color: darkInk,
    })
    page.drawText(data.destName.substring(0, 24), {
      x: destColX,
      y: bannerY - 86,
      size: 7,
      font: fontRegular,
      color: mutedSlate,
    })

    // Divider above 6-Column Grid
    page.drawLine({
      start: { x: cardX + 14, y: routeBottomY },
      end: { x: stubX - 14, y: routeBottomY },
      thickness: 0.8,
      color: borderCol,
    })

    // ─── 5. Tabular Grid of 6 Passenger Flight Parameters (Figma + Dribbble Callout Boxes) ───
    const gridY = cardY + 14
    const gridH = 62

    // Col 1: Nama Penumpang (x: cardX + 14, w: 72)
    page.drawText('NAMA PENUMPANG', {
      x: cardX + 14,
      y: gridY + 48,
      size: 5.5,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(data.passengerName.substring(0, 15), {
      x: cardX + 14,
      y: gridY + 32,
      size: 8,
      font: fontBold,
      color: darkInk,
    })
    page.drawText('Dewasa (ADT)', {
      x: cardX + 14,
      y: gridY + 20,
      size: 6.5,
      font: fontRegular,
      color: mutedSlate,
    })
    page.drawText(`ID: ${data.idNumber.substring(0, 10)}`, {
      x: cardX + 14,
      y: gridY + 9,
      size: 5.8,
      font: fontRegular,
      color: mutedSlate,
    })

    // Col 2: Kursi / Seat Callout Box (Highlighted Orange/Coral)
    const seatBoxX = cardX + 90
    page.drawRectangle({
      x: seatBoxX,
      y: gridY + 4,
      width: 52,
      height: gridH - 4,
      color: signalBg,
      borderColor: signalOrange,
      borderWidth: 1,
    })
    page.drawText('KURSI (SEAT)', {
      x: seatBoxX + 5,
      y: gridY + 48,
      size: 5.5,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(data.seatNumber, {
      x: seatBoxX + 5,
      y: gridY + 24,
      size: 16,
      font: fontBold,
      color: signalOrange,
    })
    page.drawText('Depan Sayap', {
      x: seatBoxX + 5,
      y: gridY + 10,
      size: 6,
      font: fontRegular,
      color: mutedSlate,
    })

    // Col 3: Pintu Masuk (Gate) Callout Box
    const gateBoxX = cardX + 147
    page.drawRectangle({
      x: gateBoxX,
      y: gridY + 4,
      width: 54,
      height: gridH - 4,
      color: tintBg,
      borderColor: borderCol,
      borderWidth: 0.7,
    })
    page.drawText('PINTU (GATE)', {
      x: gateBoxX + 5,
      y: gridY + 48,
      size: 5.5,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(`Gate ${data.gate || '3A'}`, {
      x: gateBoxX + 5,
      y: gridY + 28,
      size: 9,
      font: fontBold,
      color: primaryBlue,
    })
    page.drawText('Terminal 3', {
      x: gateBoxX + 5,
      y: gridY + 12,
      size: 6,
      font: fontRegular,
      color: mutedSlate,
    })

    // Col 4: Waktu Boarding
    const bTimeX = cardX + 207
    page.drawText('WAKTU BOARDING', {
      x: bTimeX,
      y: gridY + 48,
      size: 5.5,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(data.boardingTime, {
      x: bTimeX,
      y: gridY + 30,
      size: 8.5,
      font: fontBold,
      color: darkInk,
    })
    page.drawText('30m sblm terbang', {
      x: bTimeX,
      y: gridY + 16,
      size: 6,
      font: fontBold,
      color: dangerRed,
    })

    // Col 5: Zona Antrean
    const zoneX = cardX + 266
    page.drawText('ZONA ANTREAN', {
      x: zoneX,
      y: gridY + 48,
      size: 5.5,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText('ZONA 2', {
      x: zoneX,
      y: gridY + 30,
      size: 8.5,
      font: fontBold,
      color: darkInk,
    })
    page.drawText('Prioritas Reguler', {
      x: zoneX,
      y: gridY + 16,
      size: 6,
      font: fontRegular,
      color: mutedSlate,
    })

    // Col 6: Jatah Bagasi
    const bagX = cardX + 316
    page.drawText('JATAH BAGASI', {
      x: bagX,
      y: gridY + 48,
      size: 5.5,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText('Kabin 7 kg', {
      x: bagX,
      y: gridY + 30,
      size: 8,
      font: fontBold,
      color: darkInk,
    })
    page.drawText('Bagasi 20 kg', {
      x: bagX,
      y: gridY + 16,
      size: 6,
      font: fontRegular,
      color: mutedSlate,
    })

    // ─── 6. Perforation Dashed Line & Circular Notches (Matching Blue Frame) ───
    for (let py = cardY + 12; py < cardY + cardH - 12; py += 7) {
      page.drawLine({
        start: { x: stubX, y: py },
        end: { x: stubX, y: py + 3.5 },
        thickness: 1.2,
        color: borderCol,
      })
    }

    // Top & Bottom Half-Circle Notches cut into the card from the Blue Frame
    page.drawCircle({ x: stubX, y: cardY + cardH + 2, size: 9, color: frameBlue })
    page.drawCircle({ x: stubX, y: cardY - 2, size: 9, color: frameBlue })

    // ─── 7. Right Stub (Gate Scan & Validation Section) ───
    const stubPadX = stubX + 14
    const airlineShort = (data.airlineName || 'Kenari').split(' ')[0]

    page.drawText('PASS STUB', {
      x: stubPadX,
      y: cardY + cardH - 20,
      size: 6,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(`${data.flightNumber} • ${airlineShort}`, {
      x: stubPadX,
      y: cardY + cardH - 31,
      size: 8.5,
      font: fontBold,
      color: darkInk,
    })

    // Stub Class Badge
    page.drawRectangle({
      x: stubX + rightW - 56,
      y: cardY + cardH - 32,
      width: 44,
      height: 13,
      color: tintBg,
    })
    page.drawText(data.seatClass === 'business' ? 'BUSINESS' : 'ECONOMY', {
      x: stubX + rightW - 51,
      y: cardY + cardH - 28,
      size: 6,
      font: fontBold,
      color: primaryBlue,
    })

    page.drawLine({
      start: { x: stubPadX, y: cardY + cardH - 38 },
      end: { x: stubX + rightW - 12, y: cardY + cardH - 38 },
      thickness: 0.6,
      color: borderCol,
    })

    // QR Code Container Box in Center of Stub
    const qrPayload = JSON.stringify({
      bp: data.boardingPassCode,
      pnr: data.bookingCode,
      name: data.passengerName,
      flight: data.flightNumber,
      seat: data.seatNumber,
      gate: data.gate || '3A',
    })

    const qrBuffer = await qrcodeService.generateQrCodeBuffer(qrPayload, 200)
    const qrImage = await pdfDoc.embedPng(qrBuffer)

    const qrBoxSize = 104
    const qrBoxX = stubX + (rightW - qrBoxSize) / 2
    const qrBoxY = cardY + cardH - 154

    page.drawRectangle({
      x: qrBoxX,
      y: qrBoxY,
      width: qrBoxSize,
      height: qrBoxSize,
      color: rgb(1, 1, 1),
      borderColor: borderCol,
      borderWidth: 0.8,
    })

    page.drawImage(qrImage, {
      x: qrBoxX + 6,
      y: qrBoxY + 6,
      width: qrBoxSize - 12,
      height: qrBoxSize - 12,
    })

    // Boarding Reference & PNR below QR
    const refCenterY = qrBoxY - 14
    page.drawText('BOARDING REFERENCE', {
      x: stubX + 36,
      y: refCenterY,
      size: 6,
      font: fontBold,
      color: mutedSlate,
    })
    page.drawText(data.boardingPassCode, {
      x: stubX + 24,
      y: refCenterY - 12,
      size: 9,
      font: fontBold,
      color: darkInk,
    })
    page.drawText(`Kode PNR: ${data.bookingCode}`, {
      x: stubX + 40,
      y: refCenterY - 23,
      size: 7,
      font: fontBold,
      color: mutedSlate,
    })

    page.drawText('Tingkatkan kecerahan layar ke tingkat', {
      x: stubX + 20,
      y: refCenterY - 36,
      size: 5.8,
      font: fontRegular,
      color: mutedSlate,
    })
    page.drawText('maksimal saat pemindaian mesin gerbang.', {
      x: stubX + 18,
      y: refCenterY - 44,
      size: 5.8,
      font: fontRegular,
      color: mutedSlate,
    })

    // Vector 1D Barcode at Bottom of Stub
    const barcodeWidths = [2.5, 1, 1.8, 3.2, 1, 2.2, 1.5, 1, 3, 1.8, 1, 2.5, 1.5, 1, 2.8, 3.2, 1, 1.8, 2.5]
    let barX = stubX + 26
    const barY = cardY + 20
    barcodeWidths.forEach((bw) => {
      page.drawRectangle({
        x: barX,
        y: barY,
        width: bw,
        height: 18,
        color: darkInk,
      })
      barX += bw + 1.8
    })

    page.drawText(`412093${data.bookingCode}0471`, {
      x: stubX + 38,
      y: cardY + 10,
      size: 6,
      font: fontRegular,
      color: mutedSlate,
    })

    // Status Delay Alert jika ada
    if (data.delayMinutes && data.delayMinutes > 0) {
      page.drawText(
        `* PERHATIAN: Penerbangan tertunda ${data.delayMinutes} menit. Waktu boarding telah disesuaikan.`,
        {
          x: outerX,
          y: outerY - 14,
          size: 8,
          font: fontBold,
          color: signalOrange,
        },
      )
    }

    // ─── 8. Three Essential Travel Reminder Cards (Bawah Boarding Pass) ───
    const remY = outerY - 82
    const remW = 170
    const remH = 56
    const reminders = [
      {
        title: '1. Terminal Keberangkatan',
        line1: 'Masuk melalui Pintu Keberangkatan.',
        line2: 'Pemeriksaan Security Check Point (SCP).',
      },
      {
        title: '2. Batas Masuk Gerbang',
        line1: 'Gerbang ditutup 15 menit sebelum',
        line2: `jadwal lepas landas (${depTimeStr}).`,
      },
      {
        title: '3. Ketentuan Identitas Resmi',
        line1: 'Wajib menunjukkan fisik asli e-KTP,',
        line2: 'SIM, atau Paspor yang masih berlaku.',
      },
    ]

    reminders.forEach((r, idx) => {
      const rx = outerX + idx * (remW + 10.5)
      page.drawRectangle({
        x: rx,
        y: remY,
        width: remW,
        height: remH,
        color: cardWhite,
        borderColor: borderCol,
        borderWidth: 0.8,
      })
      page.drawText(r.title, {
        x: rx + 10,
        y: remY + 38,
        size: 8,
        font: fontBold,
        color: primaryBlue,
      })
      page.drawText(r.line1, {
        x: rx + 10,
        y: remY + 23,
        size: 7,
        font: fontRegular,
        color: darkInk,
      })
      page.drawText(r.line2, {
        x: rx + 10,
        y: remY + 12,
        size: 7,
        font: fontRegular,
        color: mutedSlate,
      })
    })

    // ─── 9. Aturan & Panduan Masuk Boarding ───
    let infoY = remY - 28
    page.drawText('PETUNJUK KESELAMATAN & KEBERANGKATAN DI BANDARA:', {
      x: outerX,
      y: infoY,
      size: 9,
      font: fontBold,
      color: darkInk,
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
        x: outerX,
        y: infoY,
        size: 7.8,
        font: fontRegular,
        color: mutedSlate,
      })
      infoY -= 13
    })

    // Footer
    page.drawText(
      'Boarding pass resmi ini diterbitkan secara sah oleh sistem SkyBook Ticketing • Enkripsi sertifikat IATA standar aviasi.',
      {
        x: outerX,
        y: 36,
        size: 7,
        font: fontRegular,
        color: mutedSlate,
      },
    )

    return await pdfDoc.save()
  }
}

export const pdfService = new PdfService()

