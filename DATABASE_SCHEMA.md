# Database Schema - SkyBook

Database: PostgreSQL
ORM: Drizzle ORM

## Tables

### users
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| name | varchar(100) | not null |
| email | varchar(100) | unique, not null |
| password | varchar(255) | nullable |
| google_id | varchar(255) | unique, nullable |
| phone | varchar(20) | nullable |
| role | enum('admin','staff','customer') | not null, default 'customer' |
| is_active | boolean | default true |
| email_verified_at | timestamp | nullable (null = belum terverifikasi) |
| created_at | timestamp | default now() |

### email_verification_tokens
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| user_id | int | FK -> users.id, on delete cascade |
| token_hash | varchar(64) | unique, not null (SHA-256 dari token) |
| expires_at | timestamp | not null |
| used_at | timestamp | nullable |
| created_at | timestamp | default now() |

Index: (user_id, created_at) untuk membatasi kirim ulang.

### airports
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| code | varchar(3) | unique, not null |
| name | varchar(100) | not null |
| city | varchar(100) | not null |
| country | varchar(100) | not null |

### airlines
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| name | varchar(100) | not null |
| code | varchar(10) | unique |
| logo | varchar(255) | nullable |

### airplanes
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| airline_id | int | FK -> airlines.id |
| registration_number | varchar(20) | unique |
| model | varchar(100) | |
| total_seat_economy | int | not null |
| total_seat_business | int | default 0 |

### flight_schedules
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| flight_number | varchar(20) | not null |
| airline_id | int | FK -> airlines.id |
| airplane_id | int | FK -> airplanes.id |
| flight_type | enum('direct','transit') | not null |
| price_economy | decimal(12,2) | not null |
| price_business | decimal(12,2) | nullable |
| status | enum('scheduled','delayed','cancelled') | default 'scheduled' |
| created_by | int | FK -> users.id |
| created_at | timestamp | default now() |

### flight_segments
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| flight_schedule_id | int | FK -> flight_schedules.id |
| segment_order | int | not null |
| origin_airport_id | int | FK -> airports.id |
| destination_airport_id | int | FK -> airports.id |
| departure_time | timestamp | not null |
| arrival_time | timestamp | not null |
| transit_duration_minutes | int | nullable |

### seats
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| flight_schedule_id | int | FK -> flight_schedules.id |
| airplane_id | int | FK -> airplanes.id |
| seat_number | varchar(5) | not null |
| seat_class | enum('economy','business') | not null |
| is_available | boolean | default true |

UNIQUE constraint: (flight_schedule_id, seat_number)

### baggage_options
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| name | varchar(50) | not null |
| weight_kg | int | not null |
| price | decimal(12,2) | not null |

### bookings
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| booking_code | varchar(10) | unique, not null |
| user_id | int | FK -> users.id |
| flight_schedule_id | int | FK -> flight_schedules.id |
| booking_date | timestamp | default now() |
| total_price | decimal(12,2) | not null |
| status | enum('pending','paid','cancelled','refunded') | default 'pending' |
| created_at | timestamp | default now() |

### booking_passengers
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| booking_id | int | FK -> bookings.id |
| seat_id | int | FK -> seats.id, nullable |
| baggage_option_id | int | FK -> baggage_options.id, nullable |
| full_name | varchar(100) | not null |
| id_number | varchar(50) | not null |
| birth_date | date | not null |
| gender | enum('male','female') | not null |
| seat_class | enum('economy','business') | not null |

### payments
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| booking_id | int | FK -> bookings.id |
| transaction_id | varchar(100) | nullable |
| payment_method | varchar(50) | nullable |
| amount | decimal(12,2) | not null |
| payment_status | enum('pending','success','failed') | default 'pending' |
| paid_at | timestamp | nullable |

### check_ins
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| booking_passenger_id | int | FK -> booking_passengers.id |
| boarding_pass_code | varchar(50) | unique |
| checked_in_at | timestamp | default now() |
| status | enum('checked_in','boarded','no_show') | default 'checked_in' |

### refunds
| Column | Type | Constraint |
|---|---|---|
| id | serial | PK |
| booking_id | int | FK -> bookings.id |
| reason | text | not null |
| refund_amount | decimal(12,2) | not null |
| status | enum('pending','approved','rejected','refunded') | default 'pending' |
| processed_by | int | FK -> users.id, nullable |
| requested_at | timestamp | default now() |
| processed_at | timestamp | nullable |

## Relations Summary
- users 1---N bookings
- users 1---N email_verification_tokens
- users 1---N refunds (as processor)
- airlines 1---N airplanes
- airlines 1---N flight_schedules
- airplanes 1---N flight_schedules
- airplanes 1---N seats
- flight_schedules 1---N flight_segments
- flight_schedules 1---N seats
- flight_schedules 1---N bookings
- bookings 1---N booking_passengers
- bookings 1---1 payments
- bookings 1---0..1 refunds
- booking_passengers 1---0..1 seats (assigned)
- booking_passengers 1---0..1 check_ins
- booking_passengers N---1 baggage_options

## Important Notes for Implementation
1. Seat locking: gunakan DB transaction dengan `SELECT ... FOR UPDATE` saat proses booking
   untuk mencegah race condition / double booking.
2. booking_code harus di-generate random unique (contoh: nanoid 6-8 karakter uppercase).
3. boarding_pass_code harus berbeda dari booking_code (generate terpisah saat check-in).
4. Auth: user bisa punya `password` saja, `google_id` saja, atau keduanya (setelah ditautkan).
   Akun Google-only memiliki password null. Saat login password pada akun tanpa password, kembalikan `USE_GOOGLE_SIGNIN`.
5. Verifikasi email: generate token acak (32 byte, base64url), simpan hanya hash-nya. Saat verifikasi, tandai `used_at`
   dan isi `users.email_verified_at`. Token baru membatalkan token lama yang belum dipakai milik user yang sama.
6. Akun Google: `email_verified_at` diisi saat pembuatan jika klaim `email_verified` dari Google bernilai true.
7. Akun staff buatan admin: isi `email_verified_at` saat pembuatan.
8. seat_id di booking_passengers nullable karena bisa diisi saat booking ATAU saat check-in.
