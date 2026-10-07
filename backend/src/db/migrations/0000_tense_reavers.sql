CREATE TYPE "public"."booking_status" AS ENUM('pending', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."checkin_status" AS ENUM('checked_in', 'boarded', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."flight_status" AS ENUM('scheduled', 'delayed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."flight_type" AS ENUM('direct', 'transit');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'rejected', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'staff', 'customer');--> statement-breakpoint
CREATE TYPE "public"."seat_class" AS ENUM('economy', 'business');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airlines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(10),
	"logo" varchar(255),
	CONSTRAINT "airlines_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airplanes" (
	"id" serial PRIMARY KEY NOT NULL,
	"airline_id" integer,
	"registration_number" varchar(20),
	"model" varchar(100),
	"total_seat_economy" integer NOT NULL,
	"total_seat_business" integer DEFAULT 0,
	CONSTRAINT "airplanes_registration_number_unique" UNIQUE("registration_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airports" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(3) NOT NULL,
	"name" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"country" varchar(100) NOT NULL,
	CONSTRAINT "airports_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "baggage_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"weight_kg" integer NOT NULL,
	"price" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_passengers" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"seat_id" integer,
	"baggage_option_id" integer,
	"full_name" varchar(100) NOT NULL,
	"id_number" varchar(50) NOT NULL,
	"birth_date" date NOT NULL,
	"gender" "gender" NOT NULL,
	"seat_class" "seat_class" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_code" varchar(10) NOT NULL,
	"user_id" integer,
	"flight_schedule_id" integer,
	"booking_date" timestamp DEFAULT now(),
	"total_price" numeric(12, 2) NOT NULL,
	"status" "booking_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bookings_booking_code_unique" UNIQUE("booking_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_passenger_id" integer,
	"boarding_pass_code" varchar(50),
	"checked_in_at" timestamp DEFAULT now(),
	"status" "checkin_status" DEFAULT 'checked_in',
	CONSTRAINT "check_ins_boarding_pass_code_unique" UNIQUE("boarding_pass_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flight_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_number" varchar(20) NOT NULL,
	"airline_id" integer,
	"airplane_id" integer,
	"flight_type" "flight_type" NOT NULL,
	"price_economy" numeric(12, 2) NOT NULL,
	"price_business" numeric(12, 2),
	"status" "flight_status" DEFAULT 'scheduled',
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flight_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_schedule_id" integer,
	"segment_order" integer NOT NULL,
	"origin_airport_id" integer,
	"destination_airport_id" integer,
	"departure_time" timestamp NOT NULL,
	"arrival_time" timestamp NOT NULL,
	"transit_duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"transaction_id" varchar(100),
	"payment_method" varchar(50),
	"amount" numeric(12, 2) NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending',
	"paid_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"reason" text NOT NULL,
	"refund_amount" numeric(12, 2) NOT NULL,
	"status" "refund_status" DEFAULT 'pending',
	"processed_by" integer,
	"requested_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seats" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_schedule_id" integer,
	"airplane_id" integer,
	"seat_number" varchar(5) NOT NULL,
	"seat_class" "seat_class" NOT NULL,
	"is_available" boolean DEFAULT true,
	CONSTRAINT "seats_flight_schedule_id_seat_number_unique" UNIQUE("flight_schedule_id","seat_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"password" varchar(255),
	"google_id" varchar(255),
	"phone" varchar(20),
	"role" "role" DEFAULT 'customer' NOT NULL,
	"is_active" boolean DEFAULT true,
	"email_verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airplanes" ADD CONSTRAINT "airplanes_airline_id_airlines_id_fk" FOREIGN KEY ("airline_id") REFERENCES "public"."airlines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_passengers" ADD CONSTRAINT "booking_passengers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_passengers" ADD CONSTRAINT "booking_passengers_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_passengers" ADD CONSTRAINT "booking_passengers_baggage_option_id_baggage_options_id_fk" FOREIGN KEY ("baggage_option_id") REFERENCES "public"."baggage_options"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_flight_schedule_id_flight_schedules_id_fk" FOREIGN KEY ("flight_schedule_id") REFERENCES "public"."flight_schedules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_booking_passenger_id_booking_passengers_id_fk" FOREIGN KEY ("booking_passenger_id") REFERENCES "public"."booking_passengers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_schedules" ADD CONSTRAINT "flight_schedules_airline_id_airlines_id_fk" FOREIGN KEY ("airline_id") REFERENCES "public"."airlines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_schedules" ADD CONSTRAINT "flight_schedules_airplane_id_airplanes_id_fk" FOREIGN KEY ("airplane_id") REFERENCES "public"."airplanes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_schedules" ADD CONSTRAINT "flight_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_segments" ADD CONSTRAINT "flight_segments_flight_schedule_id_flight_schedules_id_fk" FOREIGN KEY ("flight_schedule_id") REFERENCES "public"."flight_schedules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_segments" ADD CONSTRAINT "flight_segments_origin_airport_id_airports_id_fk" FOREIGN KEY ("origin_airport_id") REFERENCES "public"."airports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_segments" ADD CONSTRAINT "flight_segments_destination_airport_id_airports_id_fk" FOREIGN KEY ("destination_airport_id") REFERENCES "public"."airports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seats" ADD CONSTRAINT "seats_flight_schedule_id_flight_schedules_id_fk" FOREIGN KEY ("flight_schedule_id") REFERENCES "public"."flight_schedules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seats" ADD CONSTRAINT "seats_airplane_id_airplanes_id_fk" FOREIGN KEY ("airplane_id") REFERENCES "public"."airplanes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evt_user_created_idx" ON "email_verification_tokens" USING btree ("user_id","created_at");