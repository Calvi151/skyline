interface PriceTextProps {
  amount: number
  prefix?: string
  suffix?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('Rp', 'Rp ')
}

export default function PriceText({
  amount,
  prefix = '',
  suffix = '',
  size = 'md',
  className = '',
}: PriceTextProps) {
  const sizeClasses = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-xl font-bold',
    xl: 'text-2xl sm:text-3xl font-extrabold',
  }

  const formatted = formatRupiah(amount)

  return (
    <span className={`tabular-nums text-ink ${sizeClasses[size]} ${className}`}>
      {prefix && <span className="text-xs font-normal text-subtle mr-1">{prefix}</span>}
      {formatted}
      {suffix && <span className="text-xs font-normal text-subtle ml-1">{suffix}</span>}
    </span>
  )
}
