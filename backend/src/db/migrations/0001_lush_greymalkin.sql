CREATE TYPE "public"."notification_kind" AS ENUM('delay', 'cancel');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."refund_kind" AS ENUM('customer', 'flight_cancelled');--> statement-breakpoint
CREATE TYPE "public"."schedule_source" AS ENUM('manual', 'api');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flight_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"flight_schedule_id" integer NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"email_status" "notification_status" NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	CONSTRAINT "flight_notifications_booking_id_kind_delay_minutes_unique" UNIQUE("booking_id","kind","delay_minutes")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" varchar(200) NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "provider_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(30) NOT NULL,
	"period" varchar(7) NOT NULL,
	"units_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_usage_provider_period_unique" UNIQUE("provider","period")
);
--> statement-breakpoint
ALTER TABLE "airports" ADD COLUMN "timezone" varchar(50);--> statement-breakpoint
ALTER TABLE "flight_schedules" ADD COLUMN "source" "schedule_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "flight_schedules" ADD COLUMN "external_ref" varchar(100);--> statement-breakpoint
ALTER TABLE "flight_schedules" ADD COLUMN "delay_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flight_schedules" ADD COLUMN "status_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "kind" "refund_kind" DEFAULT 'customer' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_notifications" ADD CONSTRAINT "flight_notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_notifications" ADD CONSTRAINT "flight_notifications_flight_schedule_id_flight_schedules_id_fk" FOREIGN KEY ("flight_schedule_id") REFERENCES "public"."flight_schedules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_cache_expires_at_idx" ON "provider_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_flight_sched_source_ext_ref" ON "flight_schedules" USING btree ("source","external_ref") WHERE "flight_schedules"."external_ref" IS NOT NULL;