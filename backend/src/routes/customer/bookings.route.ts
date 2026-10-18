import { Hono } from 'hono'
import { authMiddleware, requireVerifiedEmail } from '../../middleware/auth.middleware.js'
import type { UserContext } from '../../types/index.js'

const bookingsRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

// Wajib autentikasi untuk semua endpoint booking
bookingsRoute.use('*', authMiddleware)

// Guard EMAIL_NOT_VERIFIED pada POST / (POST /api/bookings)
bookingsRoute.post('/', requireVerifiedEmail, async (c) => {
  return c.json({
    error: false,
    data: {
      message: 'Booking endpoint siap. Implementasi transaction booking di Phase 4.',
    },
  })
})

export default bookingsRoute
