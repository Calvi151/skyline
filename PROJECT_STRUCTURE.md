# Project Structure - SkyBook

Monorepo dengan 2 folder utama: `frontend` dan `backend`.

```
skybook/
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn components (di-style ulang sesuai DESIGN_SYSTEM.md)
│   │   │   ├── common/                # AirportCode, RouteLine, TicketPanel, StatusChip,
│   │   │   │                          # PriceText, TimeText, DurationText, EmptyState, ErrorState,
│   │   │   │                          # ThemeToggle, FloatingPass
│   │   │   ├── layout/                # PublicLayout, CustomerLayout, AuthLayout, AdminLayout, StaffLayout, Footer
│   │   │   ├── landing/               # RouteMap, SearchPanel, PopularRoutes, HowItWorks, SeatShowcase, KeyRules, FaqSection
│   │   │   ├── auth/                  # GoogleSignInButton, EmailVerificationBanner, BrandPanel, PasswordChecklist
│   │   │   ├── booking/               # SeatMap, FlightRow, FilterBar, PassengerForm
│   │   │   └── admin/                 # DataTablePage (generik), forms, tables
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx              # email+password dan Google
│   │   │   │   ├── Register.tsx
│   │   │   │   ├── CheckEmail.tsx         # setelah daftar: cek email + kirim ulang
│   │   │   │   └── VerifyEmail.tsx        # halaman tujuan tautan verifikasi
│   │   │   ├── customer/
│   │   │   │   ├── Landing.tsx            # landing page publik + search hero
│   │   │   │   ├── SearchResults.tsx
│   │   │   │   ├── BookingDetail.tsx      # detail flight + data penumpang + seat map + bagasi
│   │   │   │   ├── Checkout.tsx
│   │   │   │   ├── PaymentResult.tsx
│   │   │   │   ├── MyBookings.tsx
│   │   │   │   ├── BookingTicket.tsx      # e-ticket + ajukan refund
│   │   │   │   └── CheckIn.tsx            # check-in + boarding pass
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Airports.tsx
│   │   │   │   ├── Airlines.tsx
│   │   │   │   ├── Airplanes.tsx
│   │   │   │   ├── BaggageOptions.tsx
│   │   │   │   ├── Flights.tsx
│   │   │   │   ├── FlightForm.tsx
│   │   │   │   ├── Users.tsx
│   │   │   │   └── Refunds.tsx
│   │   │   └── staff/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Manifest.tsx
│   │   │       └── ScanBoarding.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useFlightSearch.ts
│   │   │   └── useCountdown.ts        # batas bayar 1 jam, hitung mundur check-in
│   │   ├── store/
│   │   │   ├── authStore.ts           # Zustand store
│   │   │   ├── themeStore.ts          # tema light | dark | system
│   │   │   └── bookingStore.ts        # state alur booking multi-step
│   │   ├── lib/
│   │   │   ├── api.ts                 # axios/fetch instance
│   │   │   └── utils.ts
│   │   ├── content/
│   │   │   └── faq.ts                 # konten FAQ statis
│   │   ├── types/
│   │   │   └── index.ts               # shared TypeScript types
│   │   ├── routes/
│   │   │   ├── AppRouter.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── RoleRoute.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts              # Drizzle schema definitions
│   │   │   ├── index.ts               # DB connection
│   │   │   └── migrations/
│   │   ├── routes/
│   │   │   ├── auth.route.ts
│   │   │   ├── admin/
│   │   │   │   ├── airports.route.ts
│   │   │   │   ├── airlines.route.ts
│   │   │   │   ├── airplanes.route.ts
│   │   │   │   ├── baggage-options.route.ts
│   │   │   │   ├── flights.route.ts
│   │   │   │   ├── users.route.ts
│   │   │   │   ├── dashboard.route.ts
│   │   │   │   └── refunds.route.ts
│   │   │   ├── public.route.ts        # /api/airports, /api/baggage-options, /api/routes/popular
│   │   │   ├── customer/
│   │   │   │   ├── flights.route.ts
│   │   │   │   ├── bookings.route.ts
│   │   │   │   ├── checkin.route.ts
│   │   │   │   └── refunds.route.ts
│   │   │   ├── staff/
│   │   │   │   ├── flights.route.ts   # daftar penerbangan hari ini
│   │   │   │   └── manifest.route.ts  # manifest + verify boarding + update status
│   │   │   └── payment.route.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts     # JWT verify
│   │   │   └── role.middleware.ts     # RBAC check
│   │   ├── services/
│   │   │   ├── midtrans.service.ts
│   │   │   ├── google.service.ts      # verifikasi ID token Google
│   │   │   ├── email.service.ts       # Nodemailer + template email verifikasi
│   │   │   ├── verification.service.ts # buat/validasi token verifikasi, rate limit kirim ulang
│   │   │   ├── pdf.service.ts         # generate e-ticket/boarding pass
│   │   │   ├── qrcode.service.ts
│   │   │   ├── booking.service.ts     # business logic + transaction
│   │   │   ├── checkin.service.ts     # validasi H-24 jam, ganti kursi
│   │   │   └── refund.service.ts      # validasi H-6 jam, hitung refund
│   │   ├── jobs/
│   │   │   └── expire-bookings.ts     # cron: auto-cancel booking pending > 1 jam
│   │   ├── utils/
│   │   │   ├── generateCode.ts        # booking_code, boarding_pass_code
│   │   │   └── validators.ts          # zod schemas
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── index.ts                   # Hono app entry point
│   ├── drizzle.config.ts
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── PRD.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_SPEC.md
│   ├── PROJECT_STRUCTURE.md
│   ├── DESIGN_SYSTEM.md
│   ├── TASKS.md
│   ├── STITCH_PROMPT.md       # hanya untuk membuat desain di Stitch, tidak wajib dibaca agent
│   └── PAGE_PROMPTS.md
│
└── README.md
```

## Konvensi Penamaan
- File component React: PascalCase (`FlightRow.tsx`)
- File route backend: kebab-case + `.route.ts`
- Database table: snake_case, plural (`flight_schedules`)
- API endpoint: kebab-case, plural (`/api/admin/baggage-options`)
