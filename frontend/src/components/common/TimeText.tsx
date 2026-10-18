interface TimeTextProps {
  time: string | Date
  timezone?: string
  className?: string
  showPeriod?: boolean
}

export function formatTime(time: string | Date): string {
  if (typeof time === 'string') {
    // If format is like HH:mm:ss or ISO
    if (time.includes('T')) {
      const d = new Date(time)
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${hours}.${minutes}`
    }
    // If format is HH:mm
    if (time.includes(':')) {
      return time.slice(0, 5).replace(':', '.')
    }
  } else if (time instanceof Date) {
    const hours = String(time.getHours()).padStart(2, '0')
    const minutes = String(time.getMinutes()).padStart(2, '0')
    return `${hours}.${minutes}`
  }
  return String(time)
}

export default function TimeText({
  time,
  timezone = 'WIB',
  className = '',
  showPeriod = false,
}: TimeTextProps) {
  const formatted = formatTime(time)

  return (
    <span className={`tabular-nums font-bold text-ink ${className}`}>
      {formatted}
      {timezone && (
        <span className="text-[10px] font-normal text-subtle ml-1 tracking-wider uppercase">
          {timezone}
        </span>
      )}
      {showPeriod && (
        <span className="text-[10px] text-subtle ml-0.5">
          {Number(formatted.slice(0, 2)) >= 12 ? 'sore/malam' : 'pagi/siang'}
        </span>
      )}
    </span>
  )
}
