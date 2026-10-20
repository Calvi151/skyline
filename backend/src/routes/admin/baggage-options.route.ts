import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { baggageOptions } from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import { baggageOptionSchema } from '../../utils/validators.js'
import type { UserContext } from '../../types/index.js'

const baggageOptionsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

// Hanya admin
baggageOptionsRoute.use('*', authMiddleware, requireRole('admin'))

// GET /api/admin/baggage-options
baggageOptionsRoute.get('/', async (c) => {
  const result = await db.select().from(baggageOptions)
  return c.json({
    error: false,
    data: result,
  })
})

// GET /api/admin/baggage-options/:id
baggageOptionsRoute.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID opsi bagasi tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [option] = await db
    .select()
    .from(baggageOptions)
    .where(eq(baggageOptions.id, id))
    .limit(1)

  if (!option) {
    return c.json({ error: true, message: 'Opsi bagasi tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  return c.json({
    error: false,
    data: option,
  })
})

// POST /api/admin/baggage-options
baggageOptionsRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = baggageOptionSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data opsi bagasi tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { name, weight_kg, price } = parsed.data

  const [created] = await db
    .insert(baggageOptions)
    .values({
      name,
      weightKg: weight_kg,
      price: price.toString(),
    })
    .returning()

  return c.json(
    {
      error: false,
      data: {
        message: 'Opsi bagasi berhasil ditambahkan',
        baggage_option: created,
      },
    },
    201,
  )
})

// PUT /api/admin/baggage-options/:id
baggageOptionsRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID opsi bagasi tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [existing] = await db
    .select()
    .from(baggageOptions)
    .where(eq(baggageOptions.id, id))
    .limit(1)

  if (!existing) {
    return c.json({ error: true, message: 'Opsi bagasi tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json().catch(() => ({}))
  const parsed = baggageOptionSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data opsi bagasi tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const { name, weight_kg, price } = parsed.data

  const [updated] = await db
    .update(baggageOptions)
    .set({
      name,
      weightKg: weight_kg,
      price: price.toString(),
    })
    .where(eq(baggageOptions.id, id))
    .returning()

  return c.json({
    error: false,
    data: {
      message: 'Opsi bagasi berhasil diperbarui',
      baggage_option: updated,
    },
  })
})

// DELETE /api/admin/baggage-options/:id
baggageOptionsRoute.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID opsi bagasi tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [existing] = await db
    .select()
    .from(baggageOptions)
    .where(eq(baggageOptions.id, id))
    .limit(1)

  if (!existing) {
    return c.json({ error: true, message: 'Opsi bagasi tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  await db.delete(baggageOptions).where(eq(baggageOptions.id, id))

  return c.json({
    error: false,
    data: {
      message: 'Opsi bagasi berhasil dihapus',
    },
  })
})

export default baggageOptionsRoute
