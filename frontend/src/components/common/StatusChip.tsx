export type StatusType =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'refunded'
  | 'checked_in'
  | 'boarded'
  | 'no_show'
  | 'approved'
  | 'rejected'

interface StatusChipProps {
  status: StatusType | string
  customLabel?: string
}

export default function StatusChip({ status, customLabel }: StatusChipProps) {
  const normalized = status.toLowerCase()

  const config: Record<
    string,
    { label: string; icon: string; className: string }
  > = {
    pending: {
      label: 'Menunggu',
      icon: 'hourglass_empty',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    paid: {
      label: 'Lunas',
      icon: 'check_circle',
      className: 'bg-success/10 text-success border-success/20',
    },
    cancelled: {
      label: 'Dibatalkan',
      icon: 'cancel',
      className: 'bg-danger/10 text-danger border-danger/20',
    },
    refunded: {
      label: 'Refund Selesai',
      icon: 'currency_exchange',
      className: 'bg-brand/10 text-brand-fg border-brand-fg/20',
    },
    checked_in: {
      label: 'Sudah Check-in',
      icon: 'airline_seat_recline_normal',
      className: 'bg-brand/10 text-brand-fg border-brand-fg/20',
    },
    boarded: {
      label: 'Sudah Boarding',
      icon: 'flight_takeoff',
      className: 'bg-success/10 text-success border-success/20',
    },
    no_show: {
      label: 'Tidak Hadir',
      icon: 'person_off',
      className: 'bg-danger/10 text-danger border-danger/20',
    },
    approved: {
      label: 'Disetujui',
      icon: 'verified',
      className: 'bg-success/10 text-success border-success/20',
    },
    rejected: {
      label: 'Ditolak',
      icon: 'block',
      className: 'bg-danger/10 text-danger border-danger/20',
    },
  }

  const current = config[normalized] || {
    label: normalized,
    icon: 'info',
    className: 'bg-tint text-subtle border-line',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${current.className}`}
    >
      <span className="material-symbols-outlined text-[13px]">{current.icon}</span>
      <span>{customLabel || current.label}</span>
    </span>
  )
}
