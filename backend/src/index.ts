import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import authRoute from './routes/auth.route.js'

const app = new Hono()

app.use(
  '/*',
  cors({
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)

// Health check / welcome
app.get('/', (c) => c.json({ error: false, data: { message: 'SkyBook API' } }))

// Mount API routes
app.route('/api/auth', authRoute)

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: true,
      message: 'Endpoint tidak ditemukan',
      code: 'NOT_FOUND',
    },
    404,
  )
})

// Global error handler
app.onError((err, c) => {
  console.error('[Unhandled Error]', err)
  return c.json(
    {
      error: true,
      message: err.message || 'Terjadi kesalahan internal pada server',
      code: 'INTERNAL_SERVER_ERROR',
    },
    500,
  )
})

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`)
})

export default app
