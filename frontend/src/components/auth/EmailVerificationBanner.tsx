import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

interface EmailVerificationBannerProps {
  email: string
}

export default function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [isSending, setIsSending] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleResend = async () => {
    setIsSending(true)
    setErrorMessage(null)
    try {
      await api.post('/auth/resend-verification', { email })
      setResendStatus('sent')
      setTimeout(() => setResendStatus('idle'), 60000)
    } catch (err: any) {
      setResendStatus('error')
      setErrorMessage(
        err.response?.data?.message || 'Gagal mengirim ulang email verifikasi. Coba lagi nanti.'
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="w-full bg-panel border-b border-line px-4 py-2.5 text-xs text-ink flex flex-col sm:flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-ink shrink-0">mail</span>
        <span>
          Email <strong className="font-semibold">{email}</strong> belum diverifikasi. Harap verifikasi untuk memesan tiket.
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {resendStatus === 'sent' ? (
          <span className="text-success font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Tautan dikirim ke inbox
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending}
            className="text-brand-fg hover:underline font-semibold disabled:opacity-50"
          >
            {isSending ? 'Mengirim...' : 'Kirim ulang email'}
          </button>
        )}
        <span className="text-subtle">•</span>
        <Link
          to={`/check-email?email=${encodeURIComponent(email)}`}
          className="text-brand-fg hover:underline font-semibold"
        >
          Lihat petunjuk
        </Link>
      </div>

      {errorMessage && (
        <span className="w-full text-danger text-[11px] text-center sm:text-right">
          {errorMessage}
        </span>
      )}
    </div>
  )
}
