import nodemailer from 'nodemailer'

interface SendVerificationEmailParams {
  to: string
  name: string
  token: string
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter

    const host = process.env.SMTP_HOST
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host || !user) {
      return null
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user,
        pass: pass ?? '',
      },
    })

    return this.transporter
  }

  async sendVerificationEmail({ to, name, token }: SendVerificationEmailParams): Promise<boolean> {
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`
    const from = process.env.EMAIL_FROM ?? 'SkyBook <no-reply@skybook.id>'

    const html = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verifikasi email SkyBook</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .brand { font-size: 24px; font-weight: 700; color: #0284c7; margin-bottom: 24px; }
            h2 { color: #0f172a; margin-top: 0; }
            p { font-size: 15px; line-height: 1.6; color: #475569; margin: 16px 0; }
            .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; font-weight: 600; padding: 12px 28px; border-radius: 8px; margin: 20px 0; }
            .note { font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
            .link-alt { word-break: break-all; color: #0284c7; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="brand">SkyBook</div>
            <h2>Halo, ${escapeHtml(name)}!</h2>
            <p>Terima kasih telah mendaftar di SkyBook. Silakan klik tombol di bawah ini untuk memverifikasi alamat email kamu:</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="btn" target="_blank">Verifikasi Email</a>
            </div>
            <p>Jika tombol di atas tidak dapat diklik, salin dan tempel tautan berikut ke browser kamu:</p>
            <p class="link-alt"><a href="${verificationUrl}" class="link-alt">${verificationUrl}</a></p>
            <p class="note">Tautan ini berlaku selama <strong>24 jam</strong>.<br />Abaikan email ini jika kamu tidak merasa membuat akun di SkyBook.</p>
          </div>
        </body>
      </html>
    `

    const transporter = this.getTransporter()
    if (!transporter) {
      console.log(`[EmailService] SMTP not configured. Verification URL for ${to}: ${verificationUrl}`)
      return true
    }

    try {
      await transporter.sendMail({
        from,
        to,
        subject: 'Verifikasi email SkyBook',
        html,
      })
      return true
    } catch (error) {
      console.error('[EmailService] Gagal mengirim email verifikasi:', error)
      return false
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const emailService = new EmailService()
