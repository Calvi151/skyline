import { Hono } from 'hono'
import { eq, or, ilike } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { airports, flightSegments } from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import { airportSchema } from '../../utils/validators.js'
import type { UserContext } from '../../types/index.js'

const airportsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

// Hanya admin yang dapat mengakses
airportsRoute.use('*', authMiddleware, requireRole('admin'))

// GET /api/admin/airports
airportsRoute.get('/', async (c) => {
  const q = c.req.query('q')?.trim()

  let result
  if (q) {
    result = await db
      .select()
      .from(airports)
      .where(
        or(
          ilike(airports.code, `%${q}%`),
          ilike(airports.name, `%${q}%`),
          ilike(airports.city, `%${q}%`),
          ilike(airports.country, `%${q}%`),
        ),
      )
  } else {
    result = await db.select().from(airports)
  }

  return c.json({
    error: false,
    data: result,
  })
})

// GET /api/admin/airports/:id
airportsRoute.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID bandara tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [airport] = await db.select().from(airports).where(eq(airports.id, id)).limit(1)
  if (!airport) {
    return c.json({ error: true, message: 'Bandara tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  return c.json({
    error: false,
    data: airport,
  })
})

// POST /api/admin/airports
airportsRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = airportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data bandara tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { code, name, city, country } = parsed.data

  // Cek duplikasi kode bandara
  const [existing] = await db
    .select({ id: airports.id })
    .from(airports)
    .where(eq(airports.code, code))
    .limit(1)

  if (existing) {
    return c.json(
      {
        error: true,
        message: `Bandara dengan kode ${code} sudah terdaftar`,
        code: 'DUPLICATE_AIRPORT_CODE',
      },
      409,
    )
  }

  const [created] = await db
    .insert(airports)
    .values({ code, name, city, country })
    .returning()

  return c.json(
    {
      error: false,
      data: {
        message: 'Bandara berhasil ditambahkan',
        airport: created,
      },
    },
    201,
  )
})

// PUT /api/admin/airports/:id
airportsRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID bandara tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [existingAirport] = await db.select().from(airports).where(eq(airports.id, id)).limit(1)
  if (!existingAirport) {
    return c.json({ error: true, message: 'Bandara tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json().catch(() => ({}))
  const parsed = airportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data bandara tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { code, name, city, country } = parsed.data

  // Jika kode diubah, cek apakah kode baru sudah dipakai bandara lain
  if (code !== existingAirport.code) {
    const [duplicate] = await db
      .select({ id: airports.id })
      .from(airports)
      .where(eq(airports.code, code))
      .limit(1)

    if (duplicate) {
      return c.json(
        {
          error: true,
          message: `Bandara dengan kode ${code} sudah digunakan`,
          code: 'DUPLICATE_AIRPORT_CODE',
        },
        409,
      )
    }
  }

  const [updated] = await db
    .update(airports)
    .set({ code, name, city, country })
    .where(eq(airports.id, id))
    .returning()

  return c.json({
    error: false,
    data: {
      message: 'Data bandara berhasil diperbarui',
      airport: updated,
    },
  })
})

// DELETE /api/admin/airports/:id
airportsRoute.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID bandara tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [airport] = await db.select().from(airports).where(eq(airports.id, id)).limit(1)
  if (!airport) {
    return c.json({ error: true, message: 'Bandara tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  // Cek apakah bandara masih digunakan di flight segments
  const [inUse] = await db
    .select({ id: flightSegments.id })
    .from(flightSegments)
    .where(
      or(
        eq(flightSegments.originAirportId, id),
        eq(flightSegments.destinationAirportId, id),
      ),
    )
    .limit(1)

  if (inUse) {
    return c.json(
      {
        error: true,
        message: 'Bandara tidak dapat dihapus karena masih digunakan dalam jadwal penerbangan aktif',
        code: 'AIRPORT_IN_USE',
      },
      409,
    )
  }

  await db.delete(airports).where(eq(airports.id, id))

  return c.json({
    error: false,
    data: {
      message: 'Bandara berhasil dihapus',
    },
  })
})

export default airportsRoute
