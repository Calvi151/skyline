import crypto from 'node:crypto'
import midtransClient from 'midtrans-client'

export interface CreateSnapTransactionParams {
  orderId: string
  grossAmount: number
  customerDetails?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
  }
  itemDetails?: Array<{
    id: string
    price: number
    quantity: number
    name: string
  }>
  callbacks?: {
    finish?: string
  }
}

export interface SnapTransactionResult {
  token: string
  redirect_url: string
  order_id: string
}

export class MidtransService {
  private snap: any = null
  private serverKey: string
  private clientKey: string
  private isProduction: boolean

  constructor() {
    this.serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    this.clientKey = process.env.MIDTRANS_CLIENT_KEY || ''
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

    if (this.serverKey) {
      try {
        this.snap = new midtransClient.Snap({
          isProduction: this.isProduction,
          serverKey: this.serverKey,
          clientKey: this.clientKey,
        })
      } catch (err) {
        console.warn('[MidtransService] Gagal inisialisasi Midtrans Snap SDK:', err)
      }
    }
  }

  /**
   * Membuat transaksi Snap ke Midtrans.
   * Jika MIDTRANS_SERVER_KEY tidak diset atau dalam mode offline/testing,
   * menyediakan token & redirect URL simulasi yang valid untuk dev.
   */
  async createTransaction(params: CreateSnapTransactionParams): Promise<SnapTransactionResult> {
    const { orderId, grossAmount, customerDetails, itemDetails, callbacks } = params

    // Jika server key tidak ada atau snap belum diinisialisasi
    if (!this.serverKey || !this.snap) {
      const mockToken = `mock-snap-${crypto.randomBytes(12).toString('hex')}`
      const mockUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${mockToken}`
      console.log(
        `[MidtransService] MIDTRANS_SERVER_KEY belum diisi. Mengembalikan mock Snap token untuk order ${orderId}`,
      )
      return {
        token: mockToken,
        redirect_url: mockUrl,
        order_id: orderId,
      }
    }

    const parameter: any = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(grossAmount),
      },
    }

    if (customerDetails) {
      parameter.customer_details = customerDetails
    }

    if (itemDetails && itemDetails.length > 0) {
      parameter.item_details = itemDetails.map((item) => ({
        id: item.id.substring(0, 50),
        price: Math.round(item.price),
        quantity: item.quantity,
        name: item.name.substring(0, 50),
      }))
    }

    if (callbacks?.finish) {
      parameter.callbacks = {
        finish: callbacks.finish,
      }
    }

    try {
      const transaction = await this.snap.createTransaction(parameter)
      return {
        token: transaction.token,
        redirect_url: transaction.redirect_url,
        order_id: orderId,
      }
    } catch (err: any) {
      console.error('[MidtransService] Gagal membuat Snap transaction:', err)
      throw new Error(`Midtrans Error: ${err.message || 'Gagal menghubungi gateway pembayaran'}`)
    }
  }

  /**
   * Verifikasi signature key dari Midtrans Notification Webhook.
   * Signature formula: SHA512(order_id + status_code + gross_amount + ServerKey)
   */
  verifySignature(
    orderId: string,
    statusCode: string,
    grossAmount: string | number,
    receivedSignature: string,
  ): boolean {
    if (!this.serverKey) {
      // Jika server key belum diatur di env (mode simulasi/dev), izinkan jika ada tanda dev
      return true
    }

    // Format gross_amount: Midtrans mengirim dengan dua desimal (e.g. "1500000.00") atau integer
    // Kita cek varian sesuai payload asli
    const strAmount = typeof grossAmount === 'number' ? grossAmount.toFixed(2) : grossAmount
    const expected1 = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${strAmount}${this.serverKey}`)
      .digest('hex')

    if (expected1.toLowerCase() === receivedSignature.toLowerCase()) {
      return true
    }

    // Coba juga jika gross_amount tanpa desimal jika string asli integer
    const intAmount = Math.round(Number(grossAmount)).toString()
    const expected2 = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${intAmount}${this.serverKey}`)
      .digest('hex')

    return expected2.toLowerCase() === receivedSignature.toLowerCase()
  }

  /**
   * Helper untuk mengurai order_id Midtrans ke booking code / id
   * Format orderId: e.g. "ABC123-1730000000" atau "ABC123"
   */
  parseBookingCodeFromOrderId(orderId: string): string {
    if (!orderId) return ''
    const parts = orderId.split('-')
    return parts[0]
  }
}

export const midtransService = new MidtransService()

