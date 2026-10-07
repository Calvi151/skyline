import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  text,
  date,
  pgEnum,
  unique,
  index,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'staff', 'customer'])
export const flightTypeEnum = pgEnum('flight_type', ['direct', 'transit'])
export const flightStatusEnum = pgEnum('flight_status', ['scheduled', 'delayed', 'cancelled'])
export const seatClassEnum = pgEnum('seat_class', ['economy', 'business'])
export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'paid', 'cancelled', 'refunded'])
export const genderEnum = pgEnum('gender', ['male', 'female'])
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'success', 'failed'])
export const checkinStatusEnum = pgEnum('checkin_status', ['checked_in', 'boarded', 'no_show'])
export const refundStatusEnum = pgEnum('refund_status', ['pending', 'approved', 'rejected', 'refunded'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  googleId: varchar('google_id', { length: 255 }).unique(),
  phone: varchar('phone', { length: 20 }),
  role: roleEnum('role').notNull().default('customer'),
  isActive: boolean('is_active').default(true),
  emailVerifiedAt: timestamp('email_verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({ userCreatedIdx: index('evt_user_created_idx').on(t.userId, t.createdAt) }),
)

export const airports = pgTable('airports', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 3 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
})

export const airlines = pgTable('airlines', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 10 }).unique(),
  logo: varchar('logo', { length: 255 }),
})

export const airplanes = pgTable('airplanes', {
  id: serial('id').primaryKey(),
  airlineId: integer('airline_id').references(() => airlines.id),
  registrationNumber: varchar('registration_number', { length: 20 }).unique(),
  model: varchar('model', { length: 100 }),
  totalSeatEconomy: integer('total_seat_economy').notNull(),
  totalSeatBusiness: integer('total_seat_business').default(0),
})

export const flightSchedules = pgTable('flight_schedules', {
  id: serial('id').primaryKey(),
  flightNumber: varchar('flight_number', { length: 20 }).notNull(),
  airlineId: integer('airline_id').references(() => airlines.id),
  airplaneId: integer('airplane_id').references(() => airplanes.id),
  flightType: flightTypeEnum('flight_type').notNull(),
  priceEconomy: decimal('price_economy', { precision: 12, scale: 2 }).notNull(),
  priceBusiness: decimal('price_business', { precision: 12, scale: 2 }),
  status: flightStatusEnum('status').default('scheduled'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
})

export const flightSegments = pgTable('flight_segments', {
  id: serial('id').primaryKey(),
  flightScheduleId: integer('flight_schedule_id').references(() => flightSchedules.id),
  segmentOrder: integer('segment_order').notNull(),
  originAirportId: integer('origin_airport_id').references(() => airports.id),
  destinationAirportId: integer('destination_airport_id').references(() => airports.id),
  departureTime: timestamp('departure_time').notNull(),
  arrivalTime: timestamp('arrival_time').notNull(),
  transitDurationMinutes: integer('transit_duration_minutes'),
})

export const seats = pgTable(
  'seats',
  {
    id: serial('id').primaryKey(),
    flightScheduleId: integer('flight_schedule_id').references(() => flightSchedules.id),
    airplaneId: integer('airplane_id').references(() => airplanes.id),
    seatNumber: varchar('seat_number', { length: 5 }).notNull(),
    seatClass: seatClassEnum('seat_class').notNull(),
    isAvailable: boolean('is_available').default(true),
  },
  (t) => ({ uniqSeatPerFlight: unique().on(t.flightScheduleId, t.seatNumber) }),
)

export const baggageOptions = pgTable('baggage_options', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  weightKg: integer('weight_kg').notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
})

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  bookingCode: varchar('booking_code', { length: 10 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  flightScheduleId: integer('flight_schedule_id').references(() => flightSchedules.id),
  bookingDate: timestamp('booking_date').defaultNow(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  status: bookingStatusEnum('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const bookingPassengers = pgTable('booking_passengers', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id),
  seatId: integer('seat_id').references(() => seats.id),
  baggageOptionId: integer('baggage_option_id').references(() => baggageOptions.id),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  idNumber: varchar('id_number', { length: 50 }).notNull(),
  birthDate: date('birth_date').notNull(),
  gender: genderEnum('gender').notNull(),
  seatClass: seatClassEnum('seat_class').notNull(),
})

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id),
  transactionId: varchar('transaction_id', { length: 100 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending'),
  paidAt: timestamp('paid_at'),
})

export const checkIns = pgTable('check_ins', {
  id: serial('id').primaryKey(),
  bookingPassengerId: integer('booking_passenger_id').references(() => bookingPassengers.id),
  boardingPassCode: varchar('boarding_pass_code', { length: 50 }).unique(),
  checkedInAt: timestamp('checked_in_at').defaultNow(),
  status: checkinStatusEnum('status').default('checked_in'),
})

export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id),
  reason: text('reason').notNull(),
  refundAmount: decimal('refund_amount', { precision: 12, scale: 2 }).notNull(),
  status: refundStatusEnum('status').default('pending'),
  processedBy: integer('processed_by').references(() => users.id),
  requestedAt: timestamp('requested_at').defaultNow(),
  processedAt: timestamp('processed_at'),
})
