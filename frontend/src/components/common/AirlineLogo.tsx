import React, { useState } from 'react'

export interface AirlineLogoProps {
  code?: string | null
  name?: string | null
  logo?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  alt?: string
}

export const AirlineLogo: React.FC<AirlineLogoProps> = ({
  code,
  name,
  logo,
  size = 'md',
  className = '',
  alt,
}) => {
  const [hasError, setHasError] = useState(false)

  const cleanCode = (code || '').trim().toUpperCase()
  // Determine source: provided logo URL or open travelpayouts CDN by IATA code
  const resolvedSrc =
    logo && logo.trim().length > 0
      ? logo
      : cleanCode
      ? `https://pics.avs.io/200/200/${cleanCode}@2x.png`
      : null

  const sizeClasses = {
    xs: 'w-5 h-5 text-[9px] p-0.5',
    sm: 'w-7 h-7 text-[11px] p-0.5',
    md: 'w-10 h-10 text-xs p-1',
    lg: 'w-12 h-12 text-sm p-1.5',
    xl: 'w-14 h-14 text-base p-2',
  }

  const containerClasses = {
    xs: 'w-5 h-5 rounded',
    sm: 'w-7 h-7 rounded-control',
    md: 'w-10 h-10 rounded-control',
    lg: 'w-12 h-12 rounded-control',
    xl: 'w-14 h-14 rounded-ticket',
  }

  const initials = cleanCode || (name ? name.slice(0, 2).toUpperCase() : 'SB')
  const titleText = name ? `${name}${cleanCode ? ` (${cleanCode})` : ''}` : cleanCode || 'Maskapai'

  if (!resolvedSrc || hasError) {
    return (
      <div
        className={`relative shrink-0 flex items-center justify-center bg-tint text-brand-fg font-extrabold uppercase border border-line select-none shadow-2xs ${containerClasses[size]} ${className}`}
        title={titleText}
      >
        <span className="leading-none">{initials.slice(0, 3)}</span>
      </div>
    )
  }

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center bg-white border border-line/80 overflow-hidden shadow-2xs ${containerClasses[size]} ${className}`}
      title={titleText}
    >
      <img
        src={resolvedSrc}
        alt={alt || name || cleanCode || 'Logo Maskapai'}
        className={`w-full h-full object-contain ${sizeClasses[size]}`}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  )
}

export default AirlineLogo

