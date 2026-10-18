import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import jwt from 'jsonwebtoken'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import type { JwtPayload, UserContext } from '../types/index.js'

export const authMiddleware = createMiddleware<{
  Variables: {
    user: UserContext
    userId: number
  }
}>(async (c, next) => {
  const cookieToken = getCookie(c, 'auth')
  const authHeader = c.req.header('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const token = cookieToken || bearerToken

  if (!token) {
    return c.json(
      {
        error: true,
        message: 'Akses ditolak, silakan login terlebih dahulu',
        code: 'UNAUTHORIZED',
      },
      401,
    )
  }

  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret'

  let decoded: JwtPayload
  try {
    decoded = jwt.verify(token, jwtSecret) as JwtPayload
  } catch {
    return c.json(
      {
        error: true,
        message: 'Token tidak valid atau telah kadaluarsa',
        code: 'UNAUTHORIZED',
      },
      401,
    )
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, decoded.userId))
    .limit(1)

  if (!user) {
    return c.json(
      {
        error: true,
        message: 'Pengguna tidak ditemukan',
        code: 'UNAUTHORIZED',
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

  c.set('user', user)
  c.set('userId', user.id)

  await next()
})

export const requireVerifiedEmail = createMiddleware<{
  Variables: {
    user: UserContext
    userId: number
  }
}>(async (c, next) => {
  const user = c.get('user')
  if (!user || !user.emailVerifiedAt) {
    return c.json(
      {
        error: true,
        message: 'Email Anda belum diverifikasi. Harap verifikasi email terlebih dahulu sebelum melakukan pemesanan.',
        code: 'EMAIL_NOT_VERIFIED',
      },
      403,
    )
  }
  await next()
})
