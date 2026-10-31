export type LandmarkSilhouetteType =
  | 'new_york'
  | 'bali'
  | 'jakarta'
  | 'yogyakarta'
  | 'singapore'
  | 'kuala_lumpur'
  | 'island'
  | 'skyline'

export interface DestinationVisual {
  city: string
  country: string
  tagline: string
  landmarkName: string
  imageUrl: string
  landmarkType: LandmarkSilhouetteType
  timezoneLabel: string
}

const DESTINATION_BY_CODE: Record<string, DestinationVisual> = {
  // Bali / Denpasar
  DPS: {
    city: 'Denpasar Bali',
    country: 'Indonesia',
    tagline: 'Island of the Gods • Bali Archipelago',
    landmarkName: 'Pura Ulun Danu & Candi Bentar',
    imageUrl:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'bali',
    timezoneLabel: 'WITA',
  },
  // Jakarta
  CGK: {
    city: 'Jakarta',
    country: 'Indonesia',
    tagline: 'Metropolitan Capital • Java Coast',
    landmarkName: 'Monumen Nasional & Sudirman Skyline',
    imageUrl:
      'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'jakarta',
    timezoneLabel: 'WIB',
  },
  HLP: {
    city: 'Jakarta',
    country: 'Indonesia',
    tagline: 'Metropolitan Capital • East Jakarta',
    landmarkName: 'Monumen Nasional & Skyline',
    imageUrl:
      'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'jakarta',
    timezoneLabel: 'WIB',
  },
  // Yogyakarta
  YIA: {
    city: 'Yogyakarta',
    country: 'Indonesia',
    tagline: 'Cultural Heart of Java • Heritage City',
    landmarkName: 'Tugu Pal Putih & Candi Prambanan',
    imageUrl:
      'https://images.unsplash.com/photo-1584810359583-96fc3448beaa?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'yogyakarta',
    timezoneLabel: 'WIB',
  },
  JOG: {
    city: 'Yogyakarta',
    country: 'Indonesia',
    tagline: 'Cultural Heart of Java • Heritage City',
    landmarkName: 'Tugu Pal Putih & Candi Prambanan',
    imageUrl:
      'https://images.unsplash.com/photo-1584810359583-96fc3448beaa?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'yogyakarta',
    timezoneLabel: 'WIB',
  },
  // Surabaya
  SUB: {
    city: 'Surabaya',
    country: 'Indonesia',
    tagline: 'City of Heroes • East Java Port',
    landmarkName: 'Jembatan Suramadu & Tunjungan',
    imageUrl:
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'skyline',
    timezoneLabel: 'WIB',
  },
  // Bandung
  BDO: {
    city: 'Bandung',
    country: 'Indonesia',
    tagline: 'Paris van Java • Parahyangan Highland',
    landmarkName: 'Gedung Sate & Jembatan Pasupati',
    imageUrl:
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'skyline',
    timezoneLabel: 'WIB',
  },
  // Labuan Bajo
  LBJ: {
    city: 'Labuan Bajo',
    country: 'Indonesia',
    tagline: 'Komodo National Park • Flores Sea',
    landmarkName: 'Pulau Padar & Kepulauan Komodo',
    imageUrl:
      'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'island',
    timezoneLabel: 'WITA',
  },
  // Lombok
  LOP: {
    city: 'Lombok',
    country: 'Indonesia',
    tagline: 'Mount Rinjani & Mandalika Coast',
    landmarkName: 'Bukit Merese & Gunung Rinjani',
    imageUrl:
      'https://images.unsplash.com/photo-1573790387438-4da905039392?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'island',
    timezoneLabel: 'WITA',
  },
  // Medan
  KNO: {
    city: 'Medan',
    country: 'Indonesia',
    tagline: 'Gateway to North Sumatra & Lake Toba',
    landmarkName: 'Istana Maimun & Danau Toba',
    imageUrl:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'skyline',
    timezoneLabel: 'WIB',
  },
  // Makassar
  UPG: {
    city: 'Makassar',
    country: 'Indonesia',
    tagline: 'Pearl of Eastern Indonesia • Losari',
    landmarkName: 'Pantai Losari & Center Point',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'island',
    timezoneLabel: 'WITA',
  },
  // Balikpapan
  BPN: {
    city: 'Balikpapan',
    country: 'Indonesia',
    tagline: 'Gateway to Nusantara • East Kalimantan',
    landmarkName: 'Teluk Balikpapan & Borneo Skyline',
    imageUrl:
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'skyline',
    timezoneLabel: 'WITA',
  },
  // Singapura
  SIN: {
    city: 'Singapura',
    country: 'Singapura',
    tagline: 'The Lion City • Marina Bay',
    landmarkName: 'Marina Bay Sands & Gardens by the Bay',
    imageUrl:
      'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'singapore',
    timezoneLabel: 'SGT',
  },
  // Kuala Lumpur
  KUL: {
    city: 'Kuala Lumpur',
    country: 'Malaysia',
    tagline: 'Golden Triangle • Federal Capital',
    landmarkName: 'Petronas Twin Towers & KLCC',
    imageUrl:
      'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'kuala_lumpur',
    timezoneLabel: 'MYT',
  },
  // New York (JFK / LGA / EWR / NYC)
  JFK: {
    city: 'New York',
    country: 'United States',
    tagline: 'The Big Apple • Manhattan Skyline',
    landmarkName: 'Statue of Liberty & Empire State',
    imageUrl:
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'new_york',
    timezoneLabel: 'EDT',
  },
  NYC: {
    city: 'New York',
    country: 'United States',
    tagline: 'The Big Apple • Manhattan Skyline',
    landmarkName: 'Statue of Liberty & Empire State',
    imageUrl:
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'new_york',
    timezoneLabel: 'EDT',
  },
  EWR: {
    city: 'New York / Newark',
    country: 'United States',
    tagline: 'Hudson River & Lower Manhattan',
    landmarkName: 'Statue of Liberty & One World Trade',
    imageUrl:
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'new_york',
    timezoneLabel: 'EDT',
  },
  // Tokyo
  NRT: {
    city: 'Tokyo',
    country: 'Jepang',
    tagline: 'Metropolis & Mount Fuji Horizon',
    landmarkName: 'Tokyo Tower & Shibuya Skyline',
    imageUrl:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'skyline',
    timezoneLabel: 'JST',
  },
  HND: {
    city: 'Tokyo',
    country: 'Jepang',
    tagline: 'Tokyo Bay & Metropolis Horizon',
    landmarkName: 'Tokyo Skytree & Rainbow Bridge',
    imageUrl:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'skyline',
    timezoneLabel: 'JST',
  },
}

/**
 * Mengambil visual kota tujuan (foto panorama, tagline, tipe siluet landmark)
 * berdasarkan kode IATA bandara atau nama kota tujuan.
 */
export function getDestinationVisual(
  destCode?: string | null,
  destCity?: string | null,
): DestinationVisual {
  const code = (destCode || '').trim().toUpperCase()
  if (code && DESTINATION_BY_CODE[code]) {
    return DESTINATION_BY_CODE[code]
  }

  const cityLower = (destCity || '').trim().toLowerCase()
  if (cityLower.includes('new york') || cityLower.includes('manhattan') || cityLower.includes('nyc')) {
    return DESTINATION_BY_CODE.JFK
  }
  if (cityLower.includes('bali') || cityLower.includes('denpasar')) {
    return DESTINATION_BY_CODE.DPS
  }
  if (cityLower.includes('jakarta')) {
    return DESTINATION_BY_CODE.CGK
  }
  if (cityLower.includes('yogyakarta') || cityLower.includes('jogja')) {
    return DESTINATION_BY_CODE.YIA
  }
  if (cityLower.includes('surabaya')) {
    return DESTINATION_BY_CODE.SUB
  }
  if (cityLower.includes('bandung')) {
    return DESTINATION_BY_CODE.BDO
  }
  if (cityLower.includes('labuan bajo') || cityLower.includes('komodo')) {
    return DESTINATION_BY_CODE.LBJ
  }
  if (cityLower.includes('lombok')) {
    return DESTINATION_BY_CODE.LOP
  }
  if (cityLower.includes('singap')) {
    return DESTINATION_BY_CODE.SIN
  }
  if (cityLower.includes('kuala lumpur')) {
    return DESTINATION_BY_CODE.KUL
  }
  if (cityLower.includes('jayapura') || cityLower.includes('sorong') || cityLower.includes('ambon')) {
    return {
      city: destCity || 'Indonesia Timur',
      country: 'Indonesia',
      tagline: 'Eastern Archipelago • Pacific Horizon',
      landmarkName: 'Kepulauan & Teluk Nusantara',
      imageUrl:
        'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1400&q=80',
      landmarkType: 'island',
      timezoneLabel: 'WIT',
    }
  }

  return {
    city: destCity || 'Destinasi Tujuan',
    country: 'Indonesia',
    tagline: `SkyBook Verified Route • ${destCity || code || 'Nusantara'}`,
    landmarkName: `${destCity || 'City'} Skyline & Horizon`,
    imageUrl:
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1400&q=80',
    landmarkType: 'skyline',
    timezoneLabel: 'WIB',
  }
}

/**
 * Menghitung durasi penerbangan dalam format "2j 50m"
 */
export function formatFlightDuration(
  departureIso?: string | null,
  arrivalIso?: string | null,
): string {
  if (!departureIso || !arrivalIso) return '1j 50m'
  try {
    const dep = new Date(departureIso).getTime()
    const arr = new Date(arrivalIso).getTime()
    const diffMins = Math.max(30, Math.round((arr - dep) / (1000 * 60)))
    const h = Math.floor(diffMins / 60)
    const m = diffMins % 60
    if (h > 0 && m > 0) return `${h}j ${m}m`
    if (h > 0) return `${h}j 00m`
    return `${m}m`
  } catch {
    return '1j 50m'
  }
}

