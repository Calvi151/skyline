import QRCode from 'qrcode'

export class QrCodeService {
  /**
   * Menghasilkan QR Code dalam bentuk PNG Buffer untuk disematkan pada PDF e-ticket / boarding pass.
   */
  async generateQrCodeBuffer(text: string, width = 250): Promise<Buffer> {
    try {
      const buffer = await QRCode.toBuffer(text, {
        type: 'png',
        margin: 1,
        width,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0F172A', // Slate 900
          light: '#FFFFFF',
        },
      })
      return buffer
    } catch (err: any) {
      console.error('[QrCodeService] Gagal generate QR code buffer:', err)
      throw new Error(`Gagal membuat QR Code: ${err.message}`)
    }
  }

  /**
   * Menghasilkan QR Code dalam bentuk Data URL (Base64) untuk tampilan web / frontend.
   */
  async generateQrCodeDataUrl(text: string, width = 250): Promise<string> {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        margin: 1,
        width,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      })
      return dataUrl
    } catch (err: any) {
      console.error('[QrCodeService] Gagal generate QR code data URL:', err)
      throw new Error(`Gagal membuat QR Code: ${err.message}`)
    }
  }
}

export const qrcodeService = new QrCodeService()

