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
