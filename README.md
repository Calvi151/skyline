# SkyBook - Wings Ticketing

Monorepo: `frontend` (React 18 + Vite + TS + Tailwind) dan `backend` (Hono.js + Drizzle ORM + PostgreSQL).

Dokumentasi ada di `docs/`.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```
