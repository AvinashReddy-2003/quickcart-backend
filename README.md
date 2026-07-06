# QuickCart Backend

Shared backend for the QuickCart super-app (food → grocery → e-commerce).
NestJS + PostgreSQL + Redis + Prisma, in TypeScript.

> **Status: Phase 0 — Foundation ✅ complete.**
> A user can request an OTP, log in, and hit a protected endpoint. Role-based
> access control (customer / vendor / rider / admin) is enforced.

## Stack

| Concern        | Choice                          |
| -------------- | ------------------------------- |
| Framework      | NestJS 11                       |
| Database       | PostgreSQL 16 (Docker)          |
| ORM/migrations | Prisma 6                        |
| Cache / OTP    | Redis 7 (Docker)                |
| Auth           | OTP → JWT access + refresh, RBAC |

## Prerequisites

- Node 20+ and npm
- Docker Desktop (runs Postgres + Redis locally)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env        # values already match docker-compose

# 3. Start Postgres + Redis
npm run db:up

# 4. Generate the Prisma client, run migrations, seed an admin
npm run prisma:generate
npm run prisma:migrate      # applies migrations
npx prisma db seed          # creates admin +919999999999

# 5. Run the API (dev, watch mode)
npm run start:dev
# API on http://localhost:3000/api  (set PORT to override)
```

## Data model (Phase 0)

`users`, `restaurants`, `menu_items`, `orders`, `order_items` — see
[`prisma/schema.prisma`](prisma/schema.prisma). Lock this shape before building
on it; changes get costly later.

## API

Base path: `/api`

| Method | Route               | Auth         | Purpose                                      |
| ------ | ------------------- | ------------ | -------------------------------------------- |
| GET    | `/health`           | –            | Liveness check                               |
| POST   | `/auth/request-otp` | –            | Send OTP (returned as `devCode` in dev)      |
| POST   | `/auth/verify-otp`  | –            | Verify OTP → `{ accessToken, refreshToken }` |
| POST   | `/auth/refresh`     | –            | Exchange refresh token for new tokens        |
| GET    | `/users/me`         | Bearer       | Current user (the protected endpoint)        |
| GET    | `/users`            | Bearer ADMIN | List users (RBAC demo)                       |

### Quick manual test

```bash
# request OTP -> copy devCode from the response
curl -X POST localhost:3000/api/auth/request-otp -H "Content-Type: application/json" -d '{"phone":"+919876543210"}'

# verify -> copy accessToken
curl -X POST localhost:3000/api/auth/verify-otp -H "Content-Type: application/json" -d '{"phone":"+919876543210","code":"<devCode>"}'

# hit the protected endpoint
curl localhost:3000/api/users/me -H "Authorization: Bearer <accessToken>"
```

## Notes & next steps

- **OTP delivery is stubbed** in development — the code is returned in the API
  response instead of being sent by SMS. Wire a provider (MSG91/Twilio) before
  production (Phase 6).
- `ADMIN` cannot be self-assigned at signup; seed or promote admins directly.
- **Phase 1 (Browse & Discover)** is next: `GET /restaurants`,
  `GET /restaurants/:id/menu`, plus search & filters.
