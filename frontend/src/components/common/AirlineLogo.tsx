import React, { useState } from 'react'

export interface AirlineLogoProps {
  code?: string | null
  name?: string | null
  logo?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  alt?: string
}

interface AirlineBrandTheme {
  bg: string
  fg: string
  accent: string
  fullName: string
  shortName: string
  renderEmblem: (size: string) => React.ReactNode
}

// Koleksi Brand Vector & Identitas Resmi Maskapai Penerbangan Indonesia & Regional
const AIRLINE_THEMES: Record<string, AirlineBrandTheme> = {
  GA: {
    bg: '#0C2340',
    fg: '#FFFFFF',
    accent: '#00A39D',
    fullName: 'Garuda Indonesia',
    shortName: 'GARUDA',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6 24C12 17 24 13 42 16C36 21 28 23 20 23C13 23 8 23.5 6 24Z"
          fill="#00A39D"
        />
        <path
          d="M8 26C15 20 26 18 42 21C35 25 27 27 18 28C12 28.5 9 27.5 8 26Z"
          fill="#2CD5C4"
        />
        <path
          d="M10 28.5C18 24 30 23 42 26C33 29 24 32 16 33C11 33.5 10 30 10 28.5Z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  QG: {
    bg: '#008744',
    fg: '#FFFFFF',
    accent: '#8ED204',
    fullName: 'Citilink',
    shortName: 'CITILINK',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 36L24 12L36 36H28L24 24L20 36H12Z"
          fill="#FFFFFF"
        />
        <path
          d="M24 8L38 38H32L24 18L16 38H10L24 8Z"
          fill="#8ED204"
          opacity="0.9"
        />
      </svg>
    ),
  },
  JT: {
    bg: '#D91B1B',
    fg: '#FFFFFF',
    accent: '#FFD700',
    fullName: 'Lion Air',
    shortName: 'LION',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="18" fill="#D91B1B" />
        <path
          d="M14 26C14 18 20 14 26 14C32 14 36 18 36 24C36 30 30 34 24 34C18 34 14 30 14 26Z"
          fill="#FFD700"
        />
        <path
          d="M18 25C20 20 25 17 30 19C33 21 34 25 32 28C29 32 23 32 20 29L18 25Z"
          fill="#D91B1B"
        />
        <path
          d="M22 22C24 20 27 21 28 23C29 25 27 27 25 27C23 27 21 24 22 22Z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  ID: {
    bg: '#6E1321',
    fg: '#FFFFFF',
    accent: '#D4AF37',
    fullName: 'Batik Air',
    shortName: 'BATIK',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="32" height="32" rx="4" fill="#6E1321" />
        <path
          d="M24 10L36 24L24 38L12 24L24 10Z"
          stroke="#D4AF37"
          strokeWidth="2.5"
          fill="none"
        />
        <circle cx="24" cy="24" r="5" fill="#D4AF37" />
        <path d="M24 15V33M15 24H33" stroke="#D4AF37" strokeWidth="1.5" />
      </svg>
    ),
  },
  QZ: {
    bg: '#ED1C24',
    fg: '#FFFFFF',
    accent: '#FFFFFF',
    fullName: 'AirAsia',
    shortName: 'AIRASIA',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="19" fill="#ED1C24" />
        <text
          x="24"
          y="28"
          fill="#FFFFFF"
          fontSize="13"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          fontStyle="italic"
          textAnchor="middle"
        >
          airasia
        </text>
      </svg>
    ),
  },
  IU: {
    bg: '#B89758',
    fg: '#211C18',
    accent: '#211C18',
    fullName: 'Super Air Jet',
    shortName: 'SAJ',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M8 28L24 10L40 28H30L24 18L18 28H8Z"
          fill="#211C18"
        />
        <path
          d="M16 32L24 22L32 32H27L24 26L21 32H16Z"
          fill="#211C18"
          opacity="0.85"
        />
      </svg>
    ),
  },
  SJ: {
    bg: '#002B66',
    fg: '#FFFFFF',
    accent: '#CC0000',
    fullName: 'Sriwijaya Air',
    shortName: 'SRIWIJAYA',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="18" fill="#002B66" />
        <path
          d="M12 24C18 16 30 16 38 20C32 23 24 24 16 26L12 24Z"
          fill="#CC0000"
        />
        <path
          d="M14 26C20 20 30 20 38 24C30 27 22 28 14 29V26Z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  IW: {
    bg: '#E30613',
    fg: '#FFFFFF',
    accent: '#FFD700',
    fullName: 'Wings Air',
    shortName: 'WINGS',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="18" fill="#E30613" />
        <path
          d="M10 24C16 17 26 15 38 18C30 22 22 24 14 26L10 24Z"
          fill="#FFD700"
        />
        <path
          d="M12 26C18 21 28 20 38 23C28 26 20 28 12 30V26Z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  IP: {
    bg: '#005B94',
    fg: '#FFFFFF',
    accent: '#E50012',
    fullName: 'Pelita Air',
    shortName: 'PELITA',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="18" fill="#005B94" />
        <path
          d="M14 30C16 20 24 14 34 14C30 20 26 24 20 32C17 32 15 31 14 30Z"
          fill="#E50012"
        />
        <path
          d="M18 32C22 24 28 20 36 18C32 24 28 28 22 34L18 32Z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  KA: {
    bg: '#0284C7',
    fg: '#FFFFFF',
    accent: '#38BDF8',
    fullName: 'Kenari Air',
    shortName: 'KENARI',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 28L24 12L38 28H28L24 20L20 28H10Z" fill="#FFFFFF" />
        <circle cx="24" cy="18" r="3" fill="#38BDF8" />
      </svg>
    ),
  },
  HA: {
    bg: '#D97706',
    fg: '#FFFFFF',
    accent: '#FDE68A',
    fullName: 'Halmahera Air',
    shortName: 'HALMAHERA',
    renderEmblem: () => (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="18" fill="#D97706" />
        <path d="M12 26C18 18 30 18 36 24C30 26 24 28 16 30L12 26Z" fill="#FFFFFF" />
      </svg>
    ),
  },
}

export const AirlineLogo: React.FC<AirlineLogoProps> = ({
  code,
  name,
  logo,
  size = 'md',
  className = '',
  alt,
}) => {
  const [imgFailed, setImgFailed] = useState(false)

  const cleanCode = (code || '').trim().toUpperCase()

  // Resolusi Brand Theme berdasarkan IATA code atau substring nama
  let brandTheme = AIRLINE_THEMES[cleanCode]
  if (!brandTheme && name) {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('garuda')) brandTheme = AIRLINE_THEMES.GA
    else if (lowerName.includes('citilink')) brandTheme = AIRLINE_THEMES.QG
    else if (lowerName.includes('lion')) brandTheme = AIRLINE_THEMES.JT
    else if (lowerName.includes('batik')) brandTheme = AIRLINE_THEMES.ID
    else if (lowerName.includes('airasia')) brandTheme = AIRLINE_THEMES.QZ
    else if (lowerName.includes('super air')) brandTheme = AIRLINE_THEMES.IU
    else if (lowerName.includes('sriwijaya')) brandTheme = AIRLINE_THEMES.SJ
    else if (lowerName.includes('wings')) brandTheme = AIRLINE_THEMES.IW
    else if (lowerName.includes('pelita')) brandTheme = AIRLINE_THEMES.IP
    else if (lowerName.includes('kenari')) brandTheme = AIRLINE_THEMES.KA
    else if (lowerName.includes('halmahera')) brandTheme = AIRLINE_THEMES.HA
  }

  // Tentukan URL gambar: logo URL eksplisit atau CDN resmi travelpayouts
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
    xl: 'w-14 h-14 sm:w-16 sm:h-16 text-base p-2',
  }

  const containerClasses = {
    xs: 'w-5 h-5 rounded',
    sm: 'w-7 h-7 rounded-control',
    md: 'w-10 h-10 rounded-control',
    lg: 'w-12 h-12 rounded-xl',
    xl: 'w-14 h-14 sm:w-16 sm:h-16 rounded-xl',
  }

  const initials = cleanCode || (name ? name.slice(0, 2).toUpperCase() : 'SB')
  const titleText = name
    ? `${name}${cleanCode ? ` (${cleanCode})` : ''}`
    : cleanCode || 'Maskapai Penerbangan'

  // Jika ada brand theme resmi & gambar eksternal gagal / belum dimuat, tampilkan emblem SVG resmi
  if (imgFailed || !resolvedSrc) {
    if (brandTheme) {
      return (
        <div
          className={`relative shrink-0 flex items-center justify-center overflow-hidden border border-black/10 shadow-2xs select-none ${containerClasses[size]} ${className}`}
          style={{ backgroundColor: brandTheme.bg }}
          title={titleText}
        >
          {brandTheme.renderEmblem(size)}
        </div>
      )
    }

    // Default monogram badge maskapai penerbangan
    return (
      <div
        className={`relative shrink-0 flex flex-col items-center justify-center bg-tint text-brand-fg font-black uppercase border border-line select-none shadow-2xs ${containerClasses[size]} ${className}`}
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
        onError={() => setImgFailed(true)}
      />
    </div>
  )
}

export default AirlineLogo
