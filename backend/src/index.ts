import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import authRoute from './routes/auth.route.js'
import bookingsRoute from './routes/customer/bookings.route.js'
import customerFlightsRoute from './routes/customer/flights.route.js'
import airportsRoute from './routes/admin/airports.route.js'
import airlinesRoute from './routes/admin/airlines.route.js'
import airplanesRoute from './routes/admin/airplanes.route.js'
import flightsRoute from './routes/admin/flights.route.js'
import baggageOptionsRoute from './routes/admin/baggage-options.route.js'
import publicRoute from './routes/public.route.js'
import providerRoute from './routes/admin/provider.route.js'
import dashboardRoute from './routes/admin/dashboard.route.js'
import usersRoute from './routes/admin/users.route.js'
import refundsRoute from './routes/admin/refunds.route.js'

import checkinRoute from './routes/customer/checkin.route.js'
import paymentRoute from './routes/payment.route.js'

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
app.route('/api/flights', customerFlightsRoute)
app.route('/api/bookings', bookingsRoute)
app.route('/api/checkin', checkinRoute)
app.route('/api/payments', paymentRoute)

// Public Reference Data
app.route('/api', publicRoute)

// Admin Master Data Routes (Phase 2 & Phase 3 & Phase 7)
app.route('/api/admin/airports', airportsRoute)
app.route('/api/admin/airlines', airlinesRoute)
app.route('/api/admin/airplanes', airplanesRoute)
app.route('/api/admin/flights', flightsRoute)
app.route('/api/admin/baggage-options', baggageOptionsRoute)
app.route('/api/admin/provider', providerRoute)
app.route('/api/admin/dashboard', dashboardRoute)
app.route('/api/admin/users', usersRoute)
app.route('/api/admin/refunds', refundsRoute)

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
