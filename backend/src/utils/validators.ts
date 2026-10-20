import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email: z.string().trim().email('Format email tidak valid').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Password harus memiliki minimal satu huruf besar')
    .regex(/[0-9]/, 'Password harus memiliki minimal satu angka'),
  phone: z.string().trim().optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Format email tidak valid').toLowerCase(),
  password: z.string().min(1, 'Password tidak boleh kosong'),
})

export const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Credential token Google tidak boleh kosong'),
  mode: z.enum(['login', 'register']).optional().default('login'),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token verifikasi tidak boleh kosong'),
})

// ─── Master Data: Airports ───
export const airportSchema = z.object({
  code: z
    .string()
    .trim()
    .length(3, 'Kode bandara harus tepat 3 huruf')
    .toUpperCase(),
  name: z.string().trim().min(2, 'Nama bandara minimal 2 karakter').max(100),
  city: z.string().trim().min(2, 'Nama kota minimal 2 karakter').max(100),
  country: z.string().trim().min(2, 'Nama negara minimal 2 karakter').max(100),
  timezone: z.string().trim().max(50).optional().nullable(),
})

// ─── Master Data: Airlines ───
export const airlineSchema = z.object({
  name: z.string().trim().min(2, 'Nama maskapai minimal 2 karakter').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Kode maskapai minimal 2 karakter')
    .max(10, 'Kode maskapai maksimal 10 karakter')
    .toUpperCase(),
  logo: z.string().trim().optional().nullable(),
})

// ─── Master Data: Airplanes ───
export const airplaneSchema = z.object({
  airline_id: z.coerce.number().int().positive('Maskapai wajib dipilih'),
  registration_number: z
    .string()
    .trim()
    .min(2, 'Nomor registrasi pesawat minimal 2 karakter')
    .max(20, 'Nomor registrasi pesawat maksimal 20 karakter')
    .toUpperCase(),
  model: z.string().trim().min(2, 'Model pesawat minimal 2 karakter').max(100),
  total_seat_economy: z.coerce
    .number()
    .int()
    .min(1, 'Kapasitas kursi ekonomi minimal 1'),
  total_seat_business: z.coerce
    .number()
    .int()
    .min(0, 'Kapasitas kursi bisnis minimal 0')
    .default(0),
})

// ─── Master Data: Baggage Options ───
export const baggageOptionSchema = z.object({
  name: z.string().trim().min(2, 'Nama opsi bagasi minimal 2 karakter').max(50),
  weight_kg: z.coerce.number().int().min(1, 'Berat bagasi minimal 1 kg'),
  price: z.coerce.number().min(0, 'Harga bagasi tidak boleh negatif'),
})

// ─── Flight Schedule & Segments ───
export const flightSegmentInputSchema = z.object({
  segment_order: z.coerce.number().int().min(1, 'Urutan segmen minimal 1'),
  origin_airport_id: z.coerce.number().int().positive('Bandara asal wajib dipilih'),
  destination_airport_id: z.coerce.number().int().positive('Bandara tujuan wajib dipilih'),
  departure_time: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Format waktu keberangkatan tidak valid',
  }),
  arrival_time: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Format waktu kedatangan tidak valid',
  }),
  transit_duration_minutes: z.coerce.number().int().min(0).optional().nullable(),
})

export const flightScheduleSchema = z
  .object({
    flight_number: z
      .string()
      .trim()
      .min(2, 'Nomor penerbangan minimal 2 karakter')
      .max(20, 'Nomor penerbangan maksimal 20 karakter')
      .toUpperCase(),
    airline_id: z.coerce.number().int().positive('Maskapai wajib dipilih'),
    airplane_id: z.coerce.number().int().positive('Pesawat wajib dipilih'),
    flight_type: z.enum(['direct', 'transit']),
    price_economy: z.coerce.number().positive('Harga kelas ekonomi harus lebih dari 0'),
    price_business: z.coerce.number().min(0, 'Harga kelas bisnis tidak boleh negatif').optional().nullable(),
    status: z.enum(['scheduled', 'delayed', 'cancelled']).optional().default('scheduled'),
    segments: z.array(flightSegmentInputSchema).min(1, 'Penerbangan harus memiliki minimal 1 segmen rute'),
  })
  .refine(
    (data) => {
      if (data.flight_type === 'direct') {
        return data.segments.length === 1
      }
      return data.segments.length >= 2
    },
    {
      message: 'Penerbangan langsung (direct) harus memiliki tepat 1 segmen, sedangkan transit minimal 2 segmen',
      path: ['segments'],
    },
  )
  .refine(
    (data) => {
      // Check segment departure < arrival
      for (const seg of data.segments) {
        if (new Date(seg.departure_time) >= new Date(seg.arrival_time)) {
          return false
        }
        if (seg.origin_airport_id === seg.destination_airport_id) {
          return false
        }
      }
      return true
    },
    {
      message: 'Waktu keberangkatan harus sebelum waktu kedatangan, dan bandara asal tidak boleh sama dengan tujuan',
      path: ['segments'],
    },
  )

export const flightScheduleUpdateSchema = z
  .object({
    flight_number: z.string().trim().min(2).max(20).toUpperCase().optional(),
    airline_id: z.coerce.number().int().positive().optional(),
    airplane_id: z.coerce.number().int().positive().optional(),
    flight_type: z.enum(['direct', 'transit']).optional(),
    price_economy: z.coerce.number().positive().optional(),
    price_business: z.coerce.number().min(0).optional().nullable(),
    status: z.enum(['scheduled', 'delayed', 'cancelled']).optional(),
    delay_minutes: z.coerce.number().int().min(0).optional().nullable(),
    segments: z.array(flightSegmentInputSchema).min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'delayed' && (data.delay_minutes === undefined || data.delay_minutes === null || data.delay_minutes <= 0)) {
        return false
      }
      return true
    },
    {
      message: 'Jika status penerbangan tertunda (delayed), delay_minutes wajib diisi lebih dari 0 menit',
      path: ['delay_minutes'],
    },
  )

