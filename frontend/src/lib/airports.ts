export interface AirportItem {
  code: string
  city: string
  primaryCity: string
  name: string
  province?: string
  country: string
  aliases: string[]
  isPopular?: boolean
}

export const INDONESIAN_AIRPORTS: AirportItem[] = [
  // ─── JAWA & BALI & NUSA TENGGARA ───
  {
    code: 'DPS',
    city: 'Denpasar, Bali',
    primaryCity: 'Bali (Denpasar)',
    name: 'Bandara Internasional I Gusti Ngurah Rai',
    province: 'Bali',
    country: 'Indonesia',
    aliases: ['bali', 'denpasar', 'kuta', 'ubud', 'ngurah rai', 'dps'],
    isPopular: true,
  },
  {
    code: 'CGK',
    city: 'Jakarta',
    primaryCity: 'Jakarta (Soekarno-Hatta)',
    name: 'Bandara Internasional Soekarno-Hatta',
    province: 'Banten / DKI Jakarta',
    country: 'Indonesia',
    aliases: ['jakarta', 'jkt', 'jak', 'tangerang', 'cengkareng', 'soekarno', 'hatta', 'cgk'],
    isPopular: true,
  },
  {
    code: 'HLP',
    city: 'Jakarta',
    primaryCity: 'Jakarta (Halim)',
    name: 'Bandara Halim Perdanakusuma',
    province: 'DKI Jakarta',
    country: 'Indonesia',
    aliases: ['jakarta', 'halim', 'perdanakusuma', 'hlp'],
    isPopular: false,
  },
  {
    code: 'SUB',
    city: 'Surabaya',
    primaryCity: 'Surabaya',
    name: 'Bandara Internasional Juanda',
    province: 'Jawa Timur',
    country: 'Indonesia',
    aliases: ['surabaya', 'sby', 'sidoarjo', 'juanda', 'sub'],
    isPopular: true,
  },
  {
    code: 'YIA',
    city: 'Yogyakarta',
    primaryCity: 'Yogyakarta (Kulon Progo)',
    name: 'Yogyakarta International Airport',
    province: 'DI Yogyakarta',
    country: 'Indonesia',
    aliases: ['yogyakarta', 'jogja', 'yogya', 'kulon progo', 'yia'],
    isPopular: true,
  },
  {
    code: 'JOG',
    city: 'Yogyakarta',
    primaryCity: 'Yogyakarta (Adisutjipto)',
    name: 'Bandara Adisutjipto',
    province: 'DI Yogyakarta',
    country: 'Indonesia',
    aliases: ['yogyakarta', 'jogja', 'yogya', 'adisutjipto', 'jog'],
    isPopular: false,
  },
  {
    code: 'BDO',
    city: 'Bandung',
    primaryCity: 'Bandung',
    name: 'Bandara Husein Sastranegara',
    province: 'Jawa Barat',
    country: 'Indonesia',
    aliases: ['bandung', 'bdg', 'husein', 'sastranegara', 'bdo'],
    isPopular: true,
  },
  {
    code: 'SRG',
    city: 'Semarang',
    primaryCity: 'Semarang',
    name: 'Bandara Internasional Jenderal Ahmad Yani',
    province: 'Jawa Tengah',
    country: 'Indonesia',
    aliases: ['semarang', 'smg', 'ahmad yani', 'srg'],
    isPopular: false,
  },
  {
    code: 'SOC',
    city: 'Solo',
    primaryCity: 'Solo (Surakarta)',
    name: 'Bandara Internasional Adi Soemarmo',
    province: 'Jawa Tengah',
    country: 'Indonesia',
    aliases: ['solo', 'surakarta', 'adi soemarmo', 'soc'],
    isPopular: false,
  },
  {
    code: 'MLG',
    city: 'Malang',
    primaryCity: 'Malang',
    name: 'Bandara Abdul Rachman Saleh',
    province: 'Jawa Timur',
    country: 'Indonesia',
    aliases: ['malang', 'abdul rachman saleh', 'mlg'],
    isPopular: false,
  },
  {
    code: 'LOP',
    city: 'Lombok',
    primaryCity: 'Lombok (Praya)',
    name: 'Bandara Internasional Zainuddin Abdul Madjid',
    province: 'Nusa Tenggara Barat',
    country: 'Indonesia',
    aliases: ['lombok', 'praya', 'mataram', 'gili', 'zainuddin', 'lop'],
    isPopular: true,
  },
  {
    code: 'LBJ',
    city: 'Labuan Bajo',
    primaryCity: 'Labuan Bajo (Komodo)',
    name: 'Bandara Internasional Komodo',
    province: 'Nusa Tenggara Timur',
    country: 'Indonesia',
    aliases: ['labuan bajo', 'komodo', 'flores', 'lbj'],
    isPopular: true,
  },
  {
    code: 'KOE',
    city: 'Kupang',
    primaryCity: 'Kupang',
    name: 'Bandara El Tari',
    province: 'Nusa Tenggara Timur',
    country: 'Indonesia',
    aliases: ['kupang', 'el tari', 'timor', 'koe'],
    isPopular: false,
  },

  // ─── SUMATERA ───
  {
    code: 'KNO',
    city: 'Medan',
    primaryCity: 'Medan',
    name: 'Bandara Internasional Kualanamu',
    province: 'Sumatera Utara',
    country: 'Indonesia',
    aliases: ['medan', 'deli serdang', 'kualanamu', 'kno'],
    isPopular: true,
  },
  {
    code: 'BTH',
    city: 'Batam',
    primaryCity: 'Batam',
    name: 'Bandara Internasional Hang Nadim',
    province: 'Kepulauan Riau',
    country: 'Indonesia',
    aliases: ['batam', 'hang nadim', 'kepri', 'bth'],
    isPopular: true,
  },
  {
    code: 'PKU',
    city: 'Pekanbaru',
    primaryCity: 'Pekanbaru',
    name: 'Bandara Internasional Sultan Syarif Kasim II',
    province: 'Riau',
    country: 'Indonesia',
    aliases: ['pekanbaru', 'riau', 'syarif kasim', 'pku'],
    isPopular: false,
  },
  {
    code: 'PDG',
    city: 'Padang',
    primaryCity: 'Padang',
    name: 'Bandara Internasional Minangkabau',
    province: 'Sumatera Barat',
    country: 'Indonesia',
    aliases: ['padang', 'minangkabau', 'bukittinggi', 'pdg'],
    isPopular: false,
  },
  {
    code: 'PLM',
    city: 'Palembang',
    primaryCity: 'Palembang',
    name: 'Bandara Internasional Sultan Mahmud Badaruddin II',
    province: 'Sumatera Selatan',
    country: 'Indonesia',
    aliases: ['palembang', 'plm', 'mahmud badaruddin'],
    isPopular: false,
  },
  {
    code: 'BTJ',
    city: 'Banda Aceh',
    primaryCity: 'Banda Aceh',
    name: 'Bandara Internasional Sultan Iskandar Muda',
    province: 'Aceh',
    country: 'Indonesia',
    aliases: ['aceh', 'banda aceh', 'iskandar muda', 'btj'],
    isPopular: false,
  },

  // ─── KALIMANTAN ───
  {
    code: 'BPN',
    city: 'Balikpapan',
    primaryCity: 'Balikpapan (IKN)',
    name: 'Bandara Internasional Sultan Aji Muhammad Sulaiman Sepinggan',
    province: 'Kalimantan Timur',
    country: 'Indonesia',
    aliases: ['balikpapan', 'ikn', 'nusantara', 'sepinggan', 'bpn'],
    isPopular: true,
  },
  {
    code: 'AAP',
    city: 'Samarinda',
    primaryCity: 'Samarinda (IKN)',
    name: 'Bandara Aji Pangeran Tumenggung Pranoto',
    province: 'Kalimantan Timur',
    country: 'Indonesia',
    aliases: ['samarinda', 'ikn', 'nusantara', 'pranoto', 'aap'],
    isPopular: false,
  },
  {
    code: 'BDJ',
    city: 'Banjarmasin',
    primaryCity: 'Banjarmasin',
    name: 'Bandara Internasional Syamsudin Noor',
    province: 'Kalimantan Selatan',
    country: 'Indonesia',
    aliases: ['banjarmasin', 'banjarbaru', 'syamsudin noor', 'bdj'],
    isPopular: false,
  },
  {
    code: 'PNK',
    city: 'Pontianak',
    primaryCity: 'Pontianak',
    name: 'Bandara Supadio',
    province: 'Kalimantan Barat',
    country: 'Indonesia',
    aliases: ['pontianak', 'supadio', 'khatulistiwa', 'pnk'],
    isPopular: false,
  },

  // ─── SULAWESI & MALUKU & PAPUA ───
  {
    code: 'UPG',
    city: 'Makassar',
    primaryCity: 'Makassar',
    name: 'Bandara Internasional Sultan Hasanuddin',
    province: 'Sulawesi Selatan',
    country: 'Indonesia',
    aliases: ['makassar', 'maros', 'ujung pandang', 'hasanuddin', 'upg'],
    isPopular: true,
  },
  {
    code: 'MDC',
    city: 'Manado',
    primaryCity: 'Manado',
    name: 'Bandara Internasional Sam Ratulangi',
    province: 'Sulawesi Utara',
    country: 'Indonesia',
    aliases: ['manado', 'sam ratulangi', 'bunaken', 'mdc'],
    isPopular: false,
  },
  {
    code: 'AMQ',
    city: 'Ambon',
    primaryCity: 'Ambon',
    name: 'Bandara Pattimura',
    province: 'Maluku',
    country: 'Indonesia',
    aliases: ['ambon', 'pattimura', 'maluku', 'amq'],
    isPopular: false,
  },
  {
    code: 'DJJ',
    city: 'Jayapura',
    primaryCity: 'Jayapura',
    name: 'Bandara Internasional Sentani',
    province: 'Papua',
    country: 'Indonesia',
    aliases: ['jayapura', 'sentani', 'papua', 'djj'],
    isPopular: false,
  },
  {
    code: 'SOQ',
    city: 'Sorong',
    primaryCity: 'Sorong (Raja Ampat)',
    name: 'Bandara Domine Eduard Osok',
    province: 'Papua Barat Daya',
    country: 'Indonesia',
    aliases: ['sorong', 'raja ampat', 'domine', 'soq'],
    isPopular: true,
  },

  // ─── JEPANG / JAPAN (TOKYO & KOTA UTAMA) ───
  {
    code: 'HND',
    city: 'Tokyo',
    primaryCity: 'Tokyo (Haneda)',
    name: 'Tokyo International Airport (Haneda)',
    country: 'Japan',
    aliases: ['tokyo', 'haneda', 'japan', 'jepang', 'tokio', 'hnd'],
    isPopular: true,
  },
  {
    code: 'NRT',
    city: 'Tokyo',
    primaryCity: 'Tokyo (Narita)',
    name: 'Narita International Airport',
    country: 'Japan',
    aliases: ['tokyo', 'narita', 'japan', 'jepang', 'chiba', 'nrt'],
    isPopular: true,
  },
  {
    code: 'KIX',
    city: 'Osaka',
    primaryCity: 'Osaka (Kansai)',
    name: 'Kansai International Airport',
    country: 'Japan',
    aliases: ['osaka', 'kansai', 'kyoto', 'kobe', 'japan', 'jepang', 'kix'],
    isPopular: true,
  },
  {
    code: 'ITM',
    city: 'Osaka',
    primaryCity: 'Osaka (Itami)',
    name: 'Osaka International Airport (Itami)',
    country: 'Japan',
    aliases: ['osaka', 'itami', 'itm'],
    isPopular: false,
  },
  {
    code: 'NGO',
    city: 'Nagoya',
    primaryCity: 'Nagoya (Centrair)',
    name: 'Chubu Centrair International Airport',
    country: 'Japan',
    aliases: ['nagoya', 'centrair', 'chubu', 'japan', 'jepang', 'ngo'],
    isPopular: false,
  },
  {
    code: 'FUK',
    city: 'Fukuoka',
    primaryCity: 'Fukuoka',
    name: 'Fukuoka Airport',
    country: 'Japan',
    aliases: ['fukuoka', 'kyushu', 'japan', 'jepang', 'fuk'],
    isPopular: false,
  },
  {
    code: 'CTS',
    city: 'Sapporo',
    primaryCity: 'Sapporo (Hokkaido)',
    name: 'New Chitose Airport',
    country: 'Japan',
    aliases: ['sapporo', 'hokkaido', 'chitose', 'japan', 'jepang', 'cts'],
    isPopular: false,
  },

  // ─── KOREA SELATAN / SOUTH KOREA ───
  {
    code: 'ICN',
    city: 'Seoul',
    primaryCity: 'Seoul (Incheon)',
    name: 'Incheon International Airport',
    country: 'South Korea',
    aliases: ['seoul', 'incheon', 'korea', 'south korea', 'korsel', 'icn'],
    isPopular: true,
  },
  {
    code: 'GMP',
    city: 'Seoul',
    primaryCity: 'Seoul (Gimpo)',
    name: 'Gimpo International Airport',
    country: 'South Korea',
    aliases: ['seoul', 'gimpo', 'korea', 'gmp'],
    isPopular: false,
  },
  {
    code: 'PUS',
    city: 'Busan',
    primaryCity: 'Busan',
    name: 'Gimhae International Airport',
    country: 'South Korea',
    aliases: ['busan', 'pusan', 'gimhae', 'pus'],
    isPopular: false,
  },
  {
    code: 'CJU',
    city: 'Jeju',
    primaryCity: 'Jeju Island',
    name: 'Jeju International Airport',
    country: 'South Korea',
    aliases: ['jeju', 'cheju', 'korea', 'cju'],
    isPopular: false,
  },

  // ─── ASIA TENGGARA / ASEAN ───
  {
    code: 'SIN',
    city: 'Singapura',
    primaryCity: 'Singapura (Changi)',
    name: 'Singapore Changi Airport',
    country: 'Singapore',
    aliases: ['singapura', 'singapore', 'changi', 'sin'],
    isPopular: true,
  },
  {
    code: 'KUL',
    city: 'Kuala Lumpur',
    primaryCity: 'Kuala Lumpur (KLIA)',
    name: 'Kuala Lumpur International Airport',
    country: 'Malaysia',
    aliases: ['kuala lumpur', 'kl', 'klia', 'malaysia', 'kul'],
    isPopular: true,
  },
  {
    code: 'PEN',
    city: 'Penang',
    primaryCity: 'Penang (George Town)',
    name: 'Penang International Airport',
    country: 'Malaysia',
    aliases: ['penang', 'pulau pinang', 'george town', 'pen'],
    isPopular: false,
  },
  {
    code: 'BKK',
    city: 'Bangkok',
    primaryCity: 'Bangkok (Suvarnabhumi)',
    name: 'Suvarnabhumi Airport',
    country: 'Thailand',
    aliases: ['bangkok', 'suvarnabhumi', 'thailand', 'siam', 'bkk'],
    isPopular: true,
  },
  {
    code: 'DMK',
    city: 'Bangkok',
    primaryCity: 'Bangkok (Don Mueang)',
    name: 'Don Mueang International Airport',
    country: 'Thailand',
    aliases: ['bangkok', 'don mueang', 'thailand', 'dmk'],
    isPopular: false,
  },
  {
    code: 'HKT',
    city: 'Phuket',
    primaryCity: 'Phuket',
    name: 'Phuket International Airport',
    country: 'Thailand',
    aliases: ['phuket', 'thailand', 'hkt'],
    isPopular: true,
  },
  {
    code: 'MNL',
    city: 'Manila',
    primaryCity: 'Manila',
    name: 'Ninoy Aquino International Airport',
    country: 'Philippines',
    aliases: ['manila', 'filipina', 'philippines', 'ninoy', 'mnl'],
    isPopular: false,
  },
  {
    code: 'SGN',
    city: 'Ho Chi Minh City',
    primaryCity: 'Ho Chi Minh (Saigon)',
    name: 'Tan Son Nhat International Airport',
    country: 'Vietnam',
    aliases: ['ho chi minh', 'saigon', 'vietnam', 'sgn'],
    isPopular: true,
  },
  {
    code: 'HAN',
    city: 'Hanoi',
    primaryCity: 'Hanoi',
    name: 'Noi Bai International Airport',
    country: 'Vietnam',
    aliases: ['hanoi', 'vietnam', 'noi bai', 'han'],
    isPopular: false,
  },

  // ─── TIONGKOK, HONG KONG, TAIWAN ───
  {
    code: 'HKG',
    city: 'Hong Kong',
    primaryCity: 'Hong Kong',
    name: 'Hong Kong International Airport',
    country: 'Hong Kong',
    aliases: ['hong kong', 'hongkong', 'hk', 'chep lap kok', 'hkg'],
    isPopular: true,
  },
  {
    code: 'TPE',
    city: 'Taipei',
    primaryCity: 'Taipei (Taoyuan)',
    name: 'Taiwan Taoyuan International Airport',
    country: 'Taiwan',
    aliases: ['taipei', 'taiwan', 'taoyuan', 'tpe'],
    isPopular: true,
  },
  {
    code: 'PVG',
    city: 'Shanghai',
    primaryCity: 'Shanghai (Pudong)',
    name: 'Shanghai Pudong International Airport',
    country: 'China',
    aliases: ['shanghai', 'pudong', 'china', 'tiongkok', 'pvg'],
    isPopular: true,
  },
  {
    code: 'PEK',
    city: 'Beijing',
    primaryCity: 'Beijing (Capital)',
    name: 'Beijing Capital International Airport',
    country: 'China',
    aliases: ['beijing', 'peking', 'china', 'tiongkok', 'pek'],
    isPopular: true,
  },
  {
    code: 'CAN',
    city: 'Guangzhou',
    primaryCity: 'Guangzhou (Canton)',
    name: 'Guangzhou Baiyun International Airport',
    country: 'China',
    aliases: ['guangzhou', 'canton', 'china', 'can'],
    isPopular: false,
  },

  // ─── TIMUR TENGAH (UMRAH, HAJI & TRANSIT HUB) ───
  {
    code: 'JED',
    city: 'Jeddah',
    primaryCity: 'Jeddah (Makkah)',
    name: 'King Abdulaziz International Airport',
    country: 'Saudi Arabia',
    aliases: ['jeddah', 'jedah', 'makkah', 'mekkah', 'umroh', 'umrah', 'haji', 'saudi', 'arab saudi', 'jed'],
    isPopular: true,
  },
  {
    code: 'MED',
    city: 'Madinah',
    primaryCity: 'Madinah (Medina)',
    name: 'Prince Mohammad bin Abdulaziz Airport',
    country: 'Saudi Arabia',
    aliases: ['madinah', 'medina', 'umroh', 'umrah', 'saudi', 'arab saudi', 'med'],
    isPopular: true,
  },
  {
    code: 'RUH',
    city: 'Riyadh',
    primaryCity: 'Riyadh',
    name: 'King Khalid International Airport',
    country: 'Saudi Arabia',
    aliases: ['riyadh', 'saudi', 'arab saudi', 'ruh'],
    isPopular: false,
  },
  {
    code: 'DXB',
    city: 'Dubai',
    primaryCity: 'Dubai',
    name: 'Dubai International Airport',
    country: 'United Arab Emirates',
    aliases: ['dubai', 'uae', 'emirates', 'uni emirat arab', 'dxb'],
    isPopular: true,
  },
  {
    code: 'AUH',
    city: 'Abu Dhabi',
    primaryCity: 'Abu Dhabi',
    name: 'Zayed International Airport',
    country: 'United Arab Emirates',
    aliases: ['abu dhabi', 'etihad', 'uae', 'auh'],
    isPopular: false,
  },
  {
    code: 'DOH',
    city: 'Doha',
    primaryCity: 'Doha (Hamad)',
    name: 'Hamad International Airport',
    country: 'Qatar',
    aliases: ['doha', 'hamad', 'qatar', 'doh'],
    isPopular: true,
  },
  {
    code: 'IST',
    city: 'Istanbul',
    primaryCity: 'Istanbul',
    name: 'Istanbul Airport',
    country: 'Turkey',
    aliases: ['istanbul', 'turki', 'turkey', 'ist'],
    isPopular: true,
  },

  // ─── EROPA / EUROPE ───
  {
    code: 'LHR',
    city: 'London',
    primaryCity: 'London (Heathrow)',
    name: 'London Heathrow Airport',
    country: 'United Kingdom',
    aliases: ['london', 'heathrow', 'inggris', 'uk', 'britania', 'lhr'],
    isPopular: true,
  },
  {
    code: 'AMS',
    city: 'Amsterdam',
    primaryCity: 'Amsterdam (Schiphol)',
    name: 'Amsterdam Airport Schiphol',
    country: 'Netherlands',
    aliases: ['amsterdam', 'schiphol', 'belanda', 'netherlands', 'ams'],
    isPopular: true,
  },
  {
    code: 'CDG',
    city: 'Paris',
    primaryCity: 'Paris (Charles de Gaulle)',
    name: 'Paris Charles de Gaulle Airport',
    country: 'France',
    aliases: ['paris', 'cdg', 'charles de gaulle', 'prancis', 'france'],
    isPopular: true,
  },
  {
    code: 'FRA',
    city: 'Frankfurt',
    primaryCity: 'Frankfurt',
    name: 'Frankfurt Airport',
    country: 'Germany',
    aliases: ['frankfurt', 'jerman', 'germany', 'fra'],
    isPopular: true,
  },
  {
    code: 'ZRH',
    city: 'Zurich',
    primaryCity: 'Zurich',
    name: 'Zurich Airport',
    country: 'Switzerland',
    aliases: ['zurich', 'swiss', 'switzerland', 'zrh'],
    isPopular: false,
  },
  {
    code: 'FCO',
    city: 'Rome',
    primaryCity: 'Roma (Fiumicino)',
    name: 'Leonardo da Vinci-Fiumicino Airport',
    country: 'Italy',
    aliases: ['rome', 'roma', 'italia', 'italy', 'fco'],
    isPopular: false,
  },

  // ─── AUSTRALIA & OCEANIA ───
  {
    code: 'SYD',
    city: 'Sydney',
    primaryCity: 'Sydney',
    name: 'Sydney Kingsford Smith Airport',
    country: 'Australia',
    aliases: ['sydney', 'australia', 'syd'],
    isPopular: true,
  },
  {
    code: 'MEL',
    city: 'Melbourne',
    primaryCity: 'Melbourne',
    name: 'Melbourne Airport',
    country: 'Australia',
    aliases: ['melbourne', 'australia', 'mel'],
    isPopular: true,
  },
  {
    code: 'PER',
    city: 'Perth',
    primaryCity: 'Perth',
    name: 'Perth Airport',
    country: 'Australia',
    aliases: ['perth', 'australia', 'per'],
    isPopular: true,
  },
  {
    code: 'AKL',
    city: 'Auckland',
    primaryCity: 'Auckland',
    name: 'Auckland Airport',
    country: 'New Zealand',
    aliases: ['auckland', 'new zealand', 'selandia baru', 'akl'],
    isPopular: false,
  },

  // ─── AMERIKA / AMERICAS ───
  {
    code: 'JFK',
    city: 'New York',
    primaryCity: 'New York (JFK)',
    name: 'John F. Kennedy International Airport',
    country: 'United States',
    aliases: ['new york', 'nyc', 'jfk', 'amerika', 'usa', 'united states'],
    isPopular: true,
  },
  {
    code: 'LAX',
    city: 'Los Angeles',
    primaryCity: 'Los Angeles (LAX)',
    name: 'Los Angeles International Airport',
    country: 'United States',
    aliases: ['los angeles', 'la', 'lax', 'amerika', 'usa'],
    isPopular: true,
  },
  {
    code: 'SFO',
    city: 'San Francisco',
    primaryCity: 'San Francisco',
    name: 'San Francisco International Airport',
    country: 'United States',
    aliases: ['san francisco', 'sfo', 'bay area', 'amerika', 'usa'],
    isPopular: false,
  },
  {
    code: 'YVR',
    city: 'Vancouver',
    primaryCity: 'Vancouver',
    name: 'Vancouver International Airport',
    country: 'Canada',
    aliases: ['vancouver', 'kanada', 'canada', 'yvr'],
    isPopular: false,
  },
]

export const ALL_AIRPORTS = INDONESIAN_AIRPORTS

export const POPULAR_AIRPORTS = ALL_AIRPORTS.filter((a) => a.isPopular)

export function getAirportByCode(code?: string | null): AirportItem | null {
  if (!code) return null
  const clean = code.trim().toUpperCase()
  const direct = ALL_AIRPORTS.find((a) => a.code === clean)
  if (direct) return direct

  // Check aliases (e.g. TOKYO -> HND, JAK / JKT -> CGK, BALI -> DPS, SBY -> SUB)
  const lower = code.trim().toLowerCase()
  const aliasMatch = ALL_AIRPORTS.find(
    (a) => a.aliases.includes(lower) || a.city.toLowerCase() === lower || a.city.toLowerCase().startsWith(lower)
  )
  return aliasMatch || null
}

export function getCityName(code?: string | null, fallback = ''): string {
  if (!code) return fallback
  const a = getAirportByCode(code)
  return a ? a.city : fallback || code
}

export function getPrimaryCity(code?: string | null, fallback = ''): string {
  if (!code) return fallback
  const a = getAirportByCode(code)
  return a ? a.primaryCity : fallback || code
}

export function searchAirports(query: string, externalList?: AirportItem[]): AirportItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return POPULAR_AIRPORTS

  // Combine local dictionary with any external API results (deduplicating by code)
  const combined: AirportItem[] = [...ALL_AIRPORTS]
  if (externalList && externalList.length > 0) {
    const existingCodes = new Set(combined.map((a) => a.code))
    for (const ext of externalList) {
      if (!existingCodes.has(ext.code)) {
        combined.push(ext)
        existingCodes.add(ext.code)
      }
    }
  }

  // Score matching
  const scored = combined
    .map((item) => {
      let score = 0
      const code = item.code.toLowerCase()
      const city = item.city.toLowerCase()
      const primary = item.primaryCity.toLowerCase()
      const name = item.name.toLowerCase()
      const country = item.country.toLowerCase()

      // Exact code match
      if (code === q) score += 120
      else if (code.startsWith(q)) score += 90

      // Exact city match
      if (city === q || primary === q) score += 100
      else if (city.startsWith(q) || primary.startsWith(q)) score += 80
      else if (city.includes(q) || primary.includes(q)) score += 60

      // Aliases (e.g. "tokyo", "japan", "jepang", "bali", "jogja", "ikn")
      if (item.aliases.some((alias) => alias === q)) score += 95
      else if (item.aliases.some((alias) => alias.startsWith(q))) score += 75
      else if (item.aliases.some((alias) => alias.includes(q))) score += 50

      // Country match
      if (country === q || country.startsWith(q)) score += 40

      // Airport name match
      if (name.includes(q)) score += 30

      return { item, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map((s) => s.item)
}
