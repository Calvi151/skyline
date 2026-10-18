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
