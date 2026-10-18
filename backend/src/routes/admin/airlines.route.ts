import { Hono } from 'hono'
import { eq, or, ilike } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { airlines, airplanes, flightSchedules } from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import { airlineSchema } from '../../utils/validators.js'
import type { UserContext } from '../../types/index.js'

const airlinesRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

// Hanya admin yang dapat mengakses
airlinesRoute.use('*', authMiddleware, requireRole('admin'))

// GET /api/admin/airlines
airlinesRoute.get('/', async (c) => {
  const q = c.req.query('q')?.trim()

  let result
  if (q) {
    result = await db
      .select()
      .from(airlines)
      .where(or(ilike(airlines.name, `%${q}%`), ilike(airlines.code, `%${q}%`)))
  } else {
    result = await db.select().from(airlines)
  }

  return c.json({
    error: false,
    data: result,
  })
})

// GET /api/admin/airlines/:id
airlinesRoute.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID maskapai tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [airline] = await db.select().from(airlines).where(eq(airlines.id, id)).limit(1)
  if (!airline) {
    return c.json({ error: true, message: 'Maskapai tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  return c.json({
    error: false,
    data: airline,
  })
})

// POST /api/admin/airlines
airlinesRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = airlineSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data maskapai tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { name, code, logo } = parsed.data

  // Cek duplikasi kode maskapai
  const [existing] = await db
    .select({ id: airlines.id })
    .from(airlines)
    .where(eq(airlines.code, code))
    .limit(1)

  if (existing) {
    return c.json(
      {
        error: true,
        message: `Maskapai dengan kode ${code} sudah terdaftar`,
        code: 'DUPLICATE_AIRLINE_CODE',
      },
      409,
    )
  }

  const [created] = await db
    .insert(airlines)
    .values({ name, code, logo: logo || null })
    .returning()

  return c.json(
    {
      error: false,
      data: {
        message: 'Maskapai berhasil ditambahkan',
        airline: created,
      },
    },
    201,
  )
})

// PUT /api/admin/airlines/:id
airlinesRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID maskapai tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [existingAirline] = await db.select().from(airlines).where(eq(airlines.id, id)).limit(1)
  if (!existingAirline) {
    return c.json({ error: true, message: 'Maskapai tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json().catch(() => ({}))
  const parsed = airlineSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data maskapai tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { name, code, logo } = parsed.data

  // Jika kode diubah, cek duplikasi
  if (code !== existingAirline.code) {
    const [duplicate] = await db
      .select({ id: airlines.id })
      .from(airlines)
      .where(eq(airlines.code, code))
      .limit(1)

    if (duplicate) {
      return c.json(
        {
          error: true,
          message: `Maskapai dengan kode ${code} sudah digunakan`,
          code: 'DUPLICATE_AIRLINE_CODE',
        },
        409,
      )
    }
  }

  const [updated] = await db
    .update(airlines)
    .set({ name, code, logo: logo || null })
    .where(eq(airlines.id, id))
    .returning()

  return c.json({
    error: false,
    data: {
      message: 'Data maskapai berhasil diperbarui',
      airline: updated,
    },
  })
})

// DELETE /api/admin/airlines/:id
airlinesRoute.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID maskapai tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [airline] = await db.select().from(airlines).where(eq(airlines.id, id)).limit(1)
  if (!airline) {
    return c.json({ error: true, message: 'Maskapai tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  // Cek apakah masih digunakan di armada pesawat atau jadwal
  const [hasAirplanes] = await db
    .select({ id: airplanes.id })
    .from(airplanes)
    .where(eq(airplanes.airlineId, id))
    .limit(1)

  if (hasAirplanes) {
    return c.json(
      {
        error: true,
        message: 'Maskapai tidak dapat dihapus karena masih memiliki armada pesawat terdaftar',
        code: 'AIRLINE_HAS_AIRPLANES',
      },
      409,
    )
  }

  const [hasSchedules] = await db
    .select({ id: flightSchedules.id })
    .from(flightSchedules)
    .where(eq(flightSchedules.airlineId, id))
    .limit(1)

  if (hasSchedules) {
    return c.json(
      {
        error: true,
        message: 'Maskapai tidak dapat dihapus karena masih digunakan dalam jadwal penerbangan',
        code: 'AIRLINE_HAS_SCHEDULES',
      },
      409,
    )
  }

  await db.delete(airlines).where(eq(airlines.id, id))

  return c.json({
    error: false,
    data: {
      message: 'Maskapai berhasil dihapus',
    },
  })
})

export default airlinesRoute
