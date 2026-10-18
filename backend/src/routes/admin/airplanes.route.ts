import { Hono } from 'hono'
import { eq, or, ilike } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { airplanes, airlines, flightSchedules } from '../../db/schema.js'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import { airplaneSchema } from '../../utils/validators.js'
import type { UserContext } from '../../types/index.js'

const airplanesRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

// Hanya admin yang dapat mengakses
airplanesRoute.use('*', authMiddleware, requireRole('admin'))

// GET /api/admin/airplanes
airplanesRoute.get('/', async (c) => {
  const q = c.req.query('q')?.trim()
  const airlineIdParam = c.req.query('airline_id')

  const query = db
    .select({
      id: airplanes.id,
      airlineId: airplanes.airlineId,
      registrationNumber: airplanes.registrationNumber,
      model: airplanes.model,
      totalSeatEconomy: airplanes.totalSeatEconomy,
      totalSeatBusiness: airplanes.totalSeatBusiness,
      airline: {
        id: airlines.id,
        name: airlines.name,
        code: airlines.code,
        logo: airlines.logo,
      },
    })
    .from(airplanes)
    .leftJoin(airlines, eq(airplanes.airlineId, airlines.id))

  let conditions: any[] = []

  if (airlineIdParam) {
    const aid = Number(airlineIdParam)
    if (!isNaN(aid)) {
      conditions.push(eq(airplanes.airlineId, aid))
    }
  }

  if (q) {
    conditions.push(
      or(
        ilike(airplanes.registrationNumber, `%${q}%`),
        ilike(airplanes.model, `%${q}%`),
        ilike(airlines.name, `%${q}%`),
      ),
    )
  }

  let result
  if (conditions.length > 0) {
    result = await query.where(or(...conditions))
  } else {
    result = await query
  }

  return c.json({
    error: false,
    data: result,
  })
})

// GET /api/admin/airplanes/:id
airplanesRoute.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID pesawat tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [airplane] = await db
    .select({
      id: airplanes.id,
      airlineId: airplanes.airlineId,
      registrationNumber: airplanes.registrationNumber,
      model: airplanes.model,
      totalSeatEconomy: airplanes.totalSeatEconomy,
      totalSeatBusiness: airplanes.totalSeatBusiness,
      airline: {
        id: airlines.id,
        name: airlines.name,
        code: airlines.code,
        logo: airlines.logo,
      },
    })
    .from(airplanes)
    .leftJoin(airlines, eq(airplanes.airlineId, airlines.id))
    .where(eq(airplanes.id, id))
    .limit(1)

  if (!airplane) {
    return c.json({ error: true, message: 'Pesawat tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  return c.json({
    error: false,
    data: airplane,
  })
})

// POST /api/admin/airplanes
airplanesRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = airplaneSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data pesawat tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const {
    airline_id,
    registration_number,
    model,
    total_seat_economy,
    total_seat_business,
  } = parsed.data

  // Verifikasi apakah maskapai ada
  const [airline] = await db
    .select({ id: airlines.id })
    .from(airlines)
    .where(eq(airlines.id, airline_id))
    .limit(1)

  if (!airline) {
    return c.json(
      {
        error: true,
        message: 'Maskapai yang dipilih tidak ditemukan',
        code: 'AIRLINE_NOT_FOUND',
      },
      404,
    )
  }

  // Cek duplikasi nomor registrasi
  const [existing] = await db
    .select({ id: airplanes.id })
    .from(airplanes)
    .where(eq(airplanes.registrationNumber, registration_number))
    .limit(1)

  if (existing) {
    return c.json(
      {
        error: true,
        message: `Pesawat dengan nomor registrasi ${registration_number} sudah terdaftar`,
        code: 'DUPLICATE_REGISTRATION_NUMBER',
      },
      409,
    )
  }

  const [created] = await db
    .insert(airplanes)
    .values({
      airlineId: airline_id,
      registrationNumber: registration_number,
      model,
      totalSeatEconomy: total_seat_economy,
      totalSeatBusiness: total_seat_business,
    })
    .returning()

  return c.json(
    {
      error: false,
      data: {
        message: 'Pesawat berhasil ditambahkan',
        airplane: created,
      },
    },
    201,
  )
})

// PUT /api/admin/airplanes/:id
airplanesRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID pesawat tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [existingAirplane] = await db.select().from(airplanes).where(eq(airplanes.id, id)).limit(1)
  if (!existingAirplane) {
    return c.json({ error: true, message: 'Pesawat tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json().catch(() => ({}))
  const parsed = airplaneSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: true,
        message: parsed.error.errors[0]?.message || 'Data pesawat tidak valid',
        code: 'VALIDATION_ERROR',
      },
      400,
    )
  }

  const {
    airline_id,
    registration_number,
    model,
    total_seat_economy,
    total_seat_business,
  } = parsed.data

  // Verifikasi maskapai jika diubah
  const [airline] = await db
    .select({ id: airlines.id })
    .from(airlines)
    .where(eq(airlines.id, airline_id))
    .limit(1)

  if (!airline) {
    return c.json(
      {
        error: true,
        message: 'Maskapai yang dipilih tidak ditemukan',
        code: 'AIRLINE_NOT_FOUND',
      },
      404,
    )
  }

  // Jika nomor registrasi diubah, cek duplikasi
  if (registration_number !== existingAirplane.registrationNumber) {
    const [duplicate] = await db
      .select({ id: airplanes.id })
      .from(airplanes)
      .where(eq(airplanes.registrationNumber, registration_number))
      .limit(1)

    if (duplicate) {
      return c.json(
        {
          error: true,
          message: `Nomor registrasi ${registration_number} sudah digunakan pesawat lain`,
          code: 'DUPLICATE_REGISTRATION_NUMBER',
        },
        409,
      )
    }
  }

  const [updated] = await db
    .update(airplanes)
    .set({
      airlineId: airline_id,
      registrationNumber: registration_number,
      model,
      totalSeatEconomy: total_seat_economy,
      totalSeatBusiness: total_seat_business,
    })
    .where(eq(airplanes.id, id))
    .returning()

  return c.json({
    error: false,
    data: {
      message: 'Data pesawat berhasil diperbarui',
      airplane: updated,
    },
  })
})

// DELETE /api/admin/airplanes/:id
airplanesRoute.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: true, message: 'ID pesawat tidak valid', code: 'INVALID_ID' }, 400)
  }

  const [airplane] = await db.select().from(airplanes).where(eq(airplanes.id, id)).limit(1)
  if (!airplane) {
    return c.json({ error: true, message: 'Pesawat tidak ditemukan', code: 'NOT_FOUND' }, 404)
  }

  // Cek apakah pesawat masih digunakan di jadwal penerbangan
  const [hasSchedules] = await db
    .select({ id: flightSchedules.id })
    .from(flightSchedules)
    .where(eq(flightSchedules.airplaneId, id))
    .limit(1)

  if (hasSchedules) {
    return c.json(
      {
        error: true,
        message: 'Pesawat tidak dapat dihapus karena masih digunakan dalam jadwal penerbangan',
        code: 'AIRPLANE_IN_USE',
      },
      409,
    )
  }

  await db.delete(airplanes).where(eq(airplanes.id, id))

  return c.json({
    error: false,
    data: {
      message: 'Pesawat berhasil dihapus',
    },
  })
})

export default airplanesRoute
