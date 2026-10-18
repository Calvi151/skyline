interface DurationTextProps {
  minutes: number
  className?: string
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}j ${remainingMinutes}m`
  }
  if (hours > 0) {
    return `${hours}j`
  }
  return `${remainingMinutes}m`
}

export default function DurationText({
  minutes,
  className = '',
}: DurationTextProps) {
  return (
    <span className={`tabular-nums font-medium text-subtle ${className}`}>
      {formatDuration(minutes)}
    </span>
  )
}
