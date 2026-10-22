import { Hono } from 'hono'
import { eq, or, ilike, and, desc } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const usersRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

usersRoute.use('*', authMiddleware, requireRole('admin'))

// GET /api/admin/users
usersRoute.get('/', async (c) => {
  const roleParam = c.req.query('role')
  const q = c.req.query('q')?.trim()

  const conditions: any[] = []

  if (roleParam && ['admin', 'staff', 'customer'].includes(roleParam)) {
    conditions.push(eq(users.role, roleParam as 'admin' | 'staff' | 'customer'))
  }

  if (q) {
    conditions.push(
      or(
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`),
        ilike(users.phone, `%${q}%`),
      ),
    )
  }

  const query = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      is_active: users.isActive,
      created_at: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  let userList
  if (conditions.length > 0) {
    userList = await query.where(and(...conditions))
  } else {
    userList = await query
  }

  return c.json({
    error: false,
    data: userList,
  })
})

// POST /api/admin/users (Create staff)
usersRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, email, phone, password, role } = body

  if (!name || !email || !password) {
    return c.json(
      {
        error: true,
        message: 'Nama, email, dan kata sandi wajib diisi',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const cleanEmail = String(email).trim().toLowerCase()

  // Check email uniqueness
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, cleanEmail))
    .limit(1)

  if (existing) {
    return c.json(
      {
        error: true,
        message: 'Email sudah terdaftar',
        code: 'EMAIL_ALREADY_REGISTERED',
      },
      409,
    )
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const userRole = role === 'admin' ? 'admin' : 'staff'

  const [newUser] = await db
    .insert(users)
    .values({
      name: String(name).trim(),
      email: cleanEmail,
      phone: phone ? String(phone).trim() : null,
      password: hashedPassword,
      role: userRole,
      isActive: true,
      emailVerifiedAt: new Date(), // Staf langsung diverifikasi
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })

  return c.json(
    {
      error: false,
      message: 'Pengguna staf berhasil dibuat',
      data: newUser,
    },
    201,
  )
})

// PUT /api/admin/users/:id (Update role or isActive status)
usersRoute.put('/:id', async (c) => {
  const targetId = Number(c.req.param('id'))
  const currentUserId = c.get('userId')

  if (isNaN(targetId)) {
    return c.json({ error: true, message: 'ID pengguna tidak valid', code: 'INVALID_ID' }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const { role, is_active } = body

  // Check CANNOT_MODIFY_SELF
  if (targetId === currentUserId) {
    if (role && role !== 'admin') {
      return c.json(
        {
          error: true,
          message: 'Admin tidak boleh menurunkan role akunnya sendiri',
          code: 'CANNOT_MODIFY_SELF',
        },
        403,
      )
    }
    if (is_active === false) {
      return c.json(
        {
          error: true,
          message: 'Admin tidak boleh menonaktifkan akunnya sendiri',
          code: 'CANNOT_MODIFY_SELF',
        },
        403,
      )
    }
  }

  const [targetUser] = await db.select().from(users).where(eq(users.id, targetId)).limit(1)
  if (!targetUser) {
    return c.json({ error: true, message: 'Pengguna tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  const updateData: Record<string, any> = {}
  if (role && ['admin', 'staff', 'customer'].includes(role)) {
    updateData.role = role
  }
  if (typeof is_active === 'boolean') {
    updateData.isActive = is_active
  }

  if (Object.keys(updateData).length === 0) {
    return c.json({ error: true, message: 'Tidak ada perubahan yang dikirim', code: 'NO_CHANGES' }, 400)
  }

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, targetId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      is_active: users.isActive,
    })

  return c.json({
    error: false,
    message: 'Data pengguna berhasil diperbarui',
    data: updatedUser,
  })
})

export default usersRoute
