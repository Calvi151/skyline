import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js'
import { importSchedulesJob } from '../../jobs/import-schedules.job.js'
import { syncStatusJob } from '../../jobs/sync-status.job.js'
import { quotaGuardService } from '../../services/quota-guard.service.js'
import { providerCacheService } from '../../services/provider-cache.service.js'
import type { UserContext } from '../../types/index.js'

const providerRoute = new Hono<{
  Variables: {
    user: UserContext
    userId: number
  }
}>()

providerRoute.use('*', authMiddleware, requireRole('admin'))

// POST /api/admin/provider/import
providerRoute.post('/import', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const routes: string[] | undefined = body.routes
  const daysAhead: number | undefined = body.days_ahead

  try {
    const result = await importSchedulesJob(routes, daysAhead)

    return c.json({
      error: false,
      data: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        units_used: result.units_used,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    })
  } catch (err: any) {
    const code = err.message === 'PROVIDER_QUOTA_EXCEEDED'
      ? 'PROVIDER_QUOTA_EXCEEDED'
      : 'PROVIDER_UNAVAILABLE'
    return c.json({ error: true, message: err.message, code }, 503)
  }
})

// POST /api/admin/provider/sync-status
providerRoute.post('/sync-status', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const scheduleId: number | undefined = body.flight_schedule_id

  try {
    const result = await syncStatusJob(scheduleId)

    return c.json({
      error: false,
      data: {
        checked: result.checked,
        changed: result.changed,
        notified: result.notified,
        units_used: result.units_used,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    })
  } catch (err: any) {
    const code = err.message === 'PROVIDER_QUOTA_EXCEEDED'
      ? 'PROVIDER_QUOTA_EXCEEDED'
      : 'PROVIDER_UNAVAILABLE'
    return c.json({ error: true, message: err.message, code }, 503)
  }
})

// GET /api/admin/provider/usage
providerRoute.get('/usage', async (c) => {
  const usage = await quotaGuardService.getUsage('aerodatabox')

  return c.json({
    error: false,
    data: usage,
  })
})

export default providerRoute
