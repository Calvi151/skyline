import { createMiddleware } from 'hono/factory'
import type { UserContext } from '../types/index.js'

export function roleMiddleware(allowedRoles: Array<'admin' | 'staff' | 'customer'>) {
  return createMiddleware<{
    Variables: {
      user: UserContext
      userId: number
    }
  }>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          error: true,
          message: 'Autentikasi diperlukan',
          code: 'UNAUTHORIZED',
        },
        401,
      )
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json(
        {
          error: true,
          message: 'Anda tidak memiliki akses ke halaman ini',
          code: 'FORBIDDEN',
        },
        403,
      )
    }

    await next()
  })
}
