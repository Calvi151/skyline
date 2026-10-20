# Project Structure - SkyBook v2.0

Monorepo dengan 2 folder utama: frontend dan backend.

skybook/
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn components
│   │   │   ├── common/                  # Navbar, Footer, Sidebar, Loader
│   │   │   ├── booking/
│   │   │   │   ├── FlightCard.tsx
│   │   │   │   ├── FilterSidebar.tsx
│   │   │   │   ├── SeatMap.tsx
│   │   │   │   ├── PriceBreakdown.tsx   # transparent price breakdown
│   │   │   │   └── PassengerForm.tsx
│   │   │   ├── maps/
│   │   │   │   └── RouteMap.tsx         # Google Maps component
│   │   │   └── admin/
│   │   │       ├── PriceSettingForm.tsx
│   │   │       ├── BaggageTable.tsx
│   │   │       ├── UserTable.tsx
│   │   │       └── RefundTable.tsx
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Register.tsx
│   │   │   ├── customer/
│   │   │   │   ├── Home.tsx             # search form
│   │   │   │   ├── SearchResults.tsx    # real data dari Amadeus
│   │   │   │   ├── FlightDetail.tsx     # + Google Maps route
│   │   │   │   ├── SeatSelection.tsx
│   │   │   │   ├── Checkout.tsx         # price breakdown
│   │   │   │   ├── PaymentCallback.tsx
│   │   │   │   ├── MyBookings.tsx
│   │   │   │   ├── BookingDetail.tsx
│   │   │   │   ├── CheckIn.tsx
│   │   │   │   └── RefundRequest.tsx
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── PriceSettings.tsx    # markup configuration
│   │   │   │   ├── BaggageOptions.tsx
│   │   │   │   ├── Users.tsx
│   │   │   │   └── Refunds.tsx
│   │   │   └── staff/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Manifest.tsx
│   │   │       └── ScanBoarding.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useFlightSearch.ts       # consume Amadeus proxy endpoint
│   │   │   └── useGoogleMaps.ts
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   └── bookingDraftStore.ts     # simpan state booking sementara
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── googleMaps.ts            # loader Google Maps script
│   │   │   └── utils.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── routes/
│   │   │   ├── AppRouter.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── RoleRoute.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example                     # VITE_GOOGLE_MAPS_API_KEY, dll
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── index.ts
│   │   │   ├── seed/
│   │   │   │   ├── airlines.seed.ts     # import dari OpenFlights dataset
│   │   │   │   ├── aircraft.seed.ts     # kapasitas kursi per tipe pesawat
│   │   │   │   └── airports.seed.ts     # bandara populer Indonesia (awal)
│   │   │   └── migrations/
│   │   ├── routes/
│   │   │   ├── auth.route.ts
│   │   │   ├── airports.route.ts        # proxy + cache Amadeus
│   │   │   ├── flights.route.ts         # search, confirm-price
│   │   │   ├── maps.route.ts            # route info untuk Google Maps
│   │   │   ├── bookings.route.ts
│   │   │   ├── checkin.route.ts
│   │   │   ├── refunds.route.ts
│   │   │   ├── payment.route.ts
│   │   │   ├── admin/
│   │   │   │   ├── price-settings.route.ts
│   │   │   │   ├── baggage.route.ts
│   │   │   │   ├── users.route.ts
│   │   │   │   ├── refunds.route.ts
│   │   │   │   └── dashboard.route.ts
│   │   │   └── staff/
│   │   │       └── manifest.route.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── role.middleware.ts
│   │   ├── services/
│   │   │   ├── amadeus.service.ts       # OAuth token, search, price confirm
│   │   │   ├── airline-reference.service.ts
│   │   │   ├── seatmap.service.ts       # generate simulasi seat map
│   │   │   ├── midtrans.service.ts
│   │   │   ├── pdf.service.ts
│   │   │   ├── qrcode.service.ts
│   │   │   ├── pricing.service.ts       # hitung markup + tax
│   │   │   └── booking.service.ts
│   │   ├── utils/
│   │   │   ├── generateCode.ts
│   │   │   ├── validators.ts
│   │   │   └── cache.ts                 # simple in-memory/DB cache helper
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── index.ts
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
│   ├── PAGE_PROMPTS.md
│   └── TASKS.md
│
└── README.md

## Environment Variables Overview

### backend/.env
DATABASE_URL=
JWT_SECRET=
AMADEUS_API_KEY=
AMADEUS_API_SECRET=
AMADEUS_BASE_URL=https://test.api.amadeus.com
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

### frontend/.env
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=

## Konvensi Penamaan
- File component React: PascalCase (FlightCard.tsx)
- File route backend: kebab-case + .route.ts
- File service backend: kebab-case + .service.ts
- Database table: snake_case, plural (flight_snapshots)
- API endpoint: kebab-case, plural (/api/admin/baggage-options)