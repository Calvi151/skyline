import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, bookings } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  verifyEmailSchema,
} from '../utils/validators.js'
import { emailService } from '../services/email.service.js'
import { verificationService } from '../services/verification.service.js'
import { googleService } from '../services/google.service.js'
import type { JwtPayload, UserContext } from '../types/index.js'

const authRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

function createJwtToken(userId: number, role: 'admin' | 'staff' | 'customer'): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret'
  const payload: JwtPayload = { userId, role }
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

function setAuthCookie(c: any, token: string) {
  setCookie(c, 'auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 hari
  })
}

// POST /api/auth/register
authRoute.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data registrasi tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { name, email, password, phone } = parsed.data

  // Cek apakah email sudah terdaftar
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser) {
    return c.json(
      {
        error: true,
        message: 'Email sudah terdaftar. Silakan masuk dengan akun Anda.',
        code: 'EMAIL_ALREADY_REGISTERED',
        email,
      },
      409,
    )
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      role: 'customer',
      isActive: true,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
    })

  // Buat token verifikasi & kirim email secara asinkron
  verificationService
    .createToken(newUser.id)
    .then((token) => emailService.sendVerificationEmail({ to: email, name, token }))
    .catch((err) => console.error('[Register] Gagal membuat token/mengirim email verifikasi:', err))

  // Registrasi berhasil: Tidak memberi cookie login agar user wajib verifikasi email terlebih dahulu
  return c.json(
    {
      error: false,
      data: {
        message: 'Registrasi berhasil. Silakan periksa email Anda untuk verifikasi akun.',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          email_verified: false,
        },
      },
    },
    201,
  )
})

// POST /api/auth/login
authRoute.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data login tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { email, password } = parsed.data

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (!user) {
    return c.json(
      {
        error: true,
        message: 'Akun dengan email ini belum terdaftar. Silakan daftar terlebih dahulu.',
        code: 'USER_NOT_FOUND',
      },
      404,
    )
  }

  // Jika akun dibuat via Google dan belum punya password
  if (!user.password && user.googleId) {
    return c.json(
      {
        error: true,
        message: 'Akun ini terdaftar melalui Google. Silakan masuk dengan tombol Google.',
        code: 'USE_GOOGLE_SIGNIN',
      },
      400,
    )
  }

  if (!user.password) {
    return c.json(
      {
        error: true,
        message: 'Kata sandi tidak valid atau belum diatur untuk akun ini.',
        code: 'INVALID_CREDENTIALS',
      },
      401,
    )
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return c.json(
      {
        error: true,
        message: 'Kata sandi yang Anda masukkan salah. Silakan coba lagi.',
        code: 'INVALID_CREDENTIALS',
      },
      401,
    )
  }

  if (user.isActive === false) {
    return c.json(
      {
        error: true,
        message: 'Akun telah dinonaktifkan',
        code: 'ACCOUNT_DISABLED',
      },
      403,
    )
  }

  // Wajib verifikasi email sebelum login (Alur Strict)
  if (!user.emailVerifiedAt) {
    return c.json(
      {
        error: true,
        message: 'Email akun Anda belum diverifikasi. Silakan periksa inbox email Anda untuk mengaktifkan akun.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      },
      403,
    )
  }

  const token = createJwtToken(user.id, user.role)
  setAuthCookie(c, token)

  return c.json({
    error: false,
    data: {
      message: 'Login berhasil',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        email_verified: Boolean(user.emailVerifiedAt),
      },
    },
  })
})

// POST /api/auth/google
authRoute.post('/google', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = googleAuthSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: 'Credential Google tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  let googleData
  try {
    googleData = await googleService.verifyIdToken(parsed.data.credential)
  } catch (error: any) {
    return c.json(
      {
        error: true,
        message: 'Token Google tidak valid atau telah kadaluarsa',
        code: 'GOOGLE_TOKEN_INVALID',
      },
      401,
    )
  }

  if (!googleData.emailVerified) {
    return c.json(
      {
        error: true,
        message: 'Email akun Google kamu belum diverifikasi',
        code: 'GOOGLE_EMAIL_NOT_VERIFIED',
      },
      400,
    )
  }

  const { credential, mode = 'login' } = parsed.data

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, googleData.email))
    .limit(1)

  // LOGIK LOGIN: Akun HARUS sudah ada di database! Tidak boleh auto-create di halaman login.
  if (mode === 'login') {
    if (!existingUser) {
      return c.json(
        {
          error: true,
          message: 'Akun dengan email Google ini belum terdaftar. Silakan daftar terlebih dahulu.',
          code: 'USER_NOT_FOUND',
          email: googleData.email,
        },
        404,
      )
    }

    if (existingUser.role !== 'customer') {
      return c.json(
        {
          error: true,
          message: 'Login Google hanya diizinkan untuk akun customer',
          code: 'GOOGLE_NOT_ALLOWED_FOR_ROLE',
        },
        403,
      )
    }

    if (existingUser.isActive === false) {
      return c.json(
        {
          error: true,
          message: 'Akun telah dinonaktifkan',
          code: 'ACCOUNT_DISABLED',
        },
        403,
      )
    }

    // Tautkan google_id jika belum ada, dan sinkronkan status verifikasi dari Google
    let user = existingUser
    const updateData: Partial<typeof users.$inferInsert> = {}
    if (!user.googleId) updateData.googleId = googleData.googleId
    if (!user.emailVerifiedAt) updateData.emailVerifiedAt = new Date()

    if (Object.keys(updateData).length > 0) {
      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, user.id))
        .returning()
      user = updated
    }

    const token = createJwtToken(user.id, user.role)
    setAuthCookie(c, token)

    return c.json({
      error: false,
      data: {
        message: 'Login dengan Google berhasil',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          email_verified: Boolean(user.emailVerifiedAt),
        },
        is_new_user: false,
      },
    })
  }

  // LOGIK REGISTER: Akun TIDAK BOLEH sudah ada di database!
  if (existingUser) {
    return c.json(
      {
        error: true,
        message: 'Email Google ini sudah terdaftar. Silakan masuk melalui halaman login.',
        code: 'EMAIL_ALREADY_REGISTERED',
        email: googleData.email,
      },
      409,
    )
  }

  // Buat customer baru dari pendaftaran Google
  const [createdUser] = await db
    .insert(users)
    .values({
      name: googleData.name,
      email: googleData.email,
      googleId: googleData.googleId,
      role: 'customer',
      isActive: true,
      emailVerifiedAt: new Date(),
    })
    .returning()

  const token = createJwtToken(createdUser.id, createdUser.role)
  setAuthCookie(c, token)

  return c.json(
    {
      error: false,
      data: {
        message: 'Registrasi dengan Google berhasil',
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          email_verified: true,
        },
        is_new_user: true,
      },
    },
    201,
  )
})

// GET /api/auth/verify-email
authRoute.get('/verify-email', async (c) => {
  const token = c.req.query('token')

  if (!token) {
    return c.json(
      {
        error: true,
        message: 'Token verifikasi tidak boleh kosong',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const result = await verificationService.verifyToken(token)

  if (!result.success) {
    const isExpired = result.code === 'TOKEN_EXPIRED'
    return c.json(
      {
        error: true,
        message: isExpired
          ? 'Token verifikasi telah kadaluarsa. Silakan ajukan kirim ulang.'
          : 'Token verifikasi tidak valid atau telah digunakan.',
        code: result.code || 'TOKEN_INVALID',
      },
      400,
    )
  }

  return c.json({
    error: false,
    data: {
      message: 'Email berhasil diverifikasi',
      email_verified: true,
    },
  })
})

// POST /api/auth/verify-email
authRoute.post('/verify-email', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = verifyEmailSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: 'Token verifikasi tidak boleh kosong',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const result = await verificationService.verifyToken(parsed.data.token)

  if (!result.success) {
    const isExpired = result.code === 'TOKEN_EXPIRED'
    return c.json(
      {
        error: true,
        message: isExpired
          ? 'Token verifikasi telah kadaluarsa. Silakan ajukan kirim ulang.'
          : 'Token verifikasi tidak valid atau telah digunakan.',
        code: result.code || 'TOKEN_INVALID',
      },
      400,
    )
  }

  return c.json({
    error: false,
    data: {
      message: 'Email berhasil diverifikasi',
      email_verified: true,
    },
  })
})

// POST /api/auth/resend-verification
authRoute.post('/resend-verification', async (c) => {
  let targetUserId: number | null = null
  let targetUserEmail: string | null = null
  let targetUserName: string | null = null
  let isVerified = false

  // 1. Check JWT auth session
  const cookieToken = getCookie(c, 'auth')
  const authHeader = c.req.header('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = cookieToken || bearerToken

  if (token) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret'
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload
      if (decoded?.userId) {
        const [u] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)
        if (u) {
          targetUserId = u.id
          targetUserEmail = u.email
          targetUserName = u.name
          isVerified = Boolean(u.emailVerifiedAt)
        }
      }
    } catch {
      // invalid token, fallback to body
    }
  }

  // 2. Fallback to email in request body
  if (!targetUserId) {
    const body = await c.req.json().catch(() => ({}))
    if (body.email) {
      const [u] = await db.select().from(users).where(eq(users.email, String(body.email).toLowerCase())).limit(1)
      if (u) {
        targetUserId = u.id
        targetUserEmail = u.email
        targetUserName = u.name
        isVerified = Boolean(u.emailVerifiedAt)
      }
    }
  }

  if (!targetUserId || !targetUserEmail || !targetUserName) {
    return c.json(
      {
        error: true,
        message: 'Pengguna tidak ditemukan. Silakan masuk atau masukkan email Anda.',
        code: 'NOT_FOUND',
      },
      404,
    )
  }

  if (isVerified) {
    return c.json(
      {
        error: true,
        message: 'Email Anda sudah terverifikasi',
        code: 'ALREADY_VERIFIED',
      },
      400,
    )
  }

  const rateLimit = await verificationService.checkRateLimit(targetUserId)
  if (!rateLimit.allowed) {
    if (rateLimit.code === 'RESEND_TOO_SOON') {
      return c.json(
        {
          error: true,
          message: `Harap tunggu ${rateLimit.retryAfter} detik sebelum meminta kirim ulang lagi`,
          code: 'RESEND_TOO_SOON',
          retry_after: rateLimit.retryAfter,
        },
        429,
      )
    }

    return c.json(
      {
        error: true,
        message: 'Batas pengiriman ulang verifikasi telah tercapai (maks 5 kali per jam)',
        code: 'RESEND_LIMIT_REACHED',
      },
      429,
    )
  }

  const verificationToken = await verificationService.createToken(targetUserId)
  await emailService.sendVerificationEmail({
    to: targetUserEmail,
    name: targetUserName,
    token: verificationToken,
  })

  return c.json({
    error: false,
    data: {
      message: 'Tautan verifikasi telah dikirim ke email kamu',
      retry_after: 60,
    },
  })
})

// POST /api/auth/logout
authRoute.post('/logout', (c) => {
  deleteCookie(c, 'auth', { path: '/' })
  return c.json({
    error: false,
    data: {
      message: 'Logout berhasil',
    },
  })
})

// GET /api/auth/me
authRoute.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      password: users.password,
      googleId: users.googleId,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return c.json(
      {
        error: true,
        message: 'Pengguna tidak ditemukan',
        code: 'NOT_FOUND',
      },
      404,
    )
  }

  // Count user bookings
  const userBookings = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.userId, userId))

  const totalBookings = userBookings.length
  const paidBookings = userBookings.filter((b) => b.status === 'paid').length

  return c.json({
    error: false,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      email_verified: Boolean(user.emailVerifiedAt),
      has_password: Boolean(user.password),
      has_google: Boolean(user.googleId),
      created_at: user.createdAt,
      stats: {
        total_bookings: totalBookings,
        paid_bookings: paidBookings,
      },
    },
  })
})

// PUT /api/auth/profile
authRoute.put('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const { name, phone } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return c.json({ error: true, message: 'Nama lengkap minimal 2 karakter' }, 400)
  }

  const [updated] = await db
    .update(users)
    .set({
      name: name.trim(),
      phone: phone ? String(phone).trim() : null,
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
    })

  return c.json({
    error: false,
    message: 'Profil berhasil diperbarui',
    data: updated,
  })
})

// PUT /api/auth/change-password
authRoute.put('/change-password', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const { current_password, new_password } = body

  if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
    return c.json({ error: true, message: 'Kata sandi baru minimal 6 karakter' }, 400)
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) {
    return c.json({ error: true, message: 'Pengguna tidak ditemukan' }, 404)
  }

  // If user has existing password, verify it
  if (user.password) {
    if (!current_password) {
      return c.json({ error: true, message: 'Kata sandi saat ini wajib diisi' }, 400)
    }
    const isValid = await bcrypt.compare(current_password, user.password)
    if (!isValid) {
      return c.json({ error: true, message: 'Kata sandi saat ini tidak sesuai' }, 400)
    }
  }

  const hashedPassword = await bcrypt.hash(new_password, 10)
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId))

  return c.json({
    error: false,
    message: 'Kata sandi berhasil diperbarui',
  })
})

export default authRoute
