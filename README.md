# QuickCart Backend

Shared backend for the QuickCart super-app (food → grocery → e-commerce).
NestJS + PostgreSQL + Redis + Prisma, in TypeScript.

> **Status: Phase 0 (Foundation) ✅ · Phase 1 (Browse & Discover) ✅**
> Users log in via OTP → JWT with role-based access control, and browse a
> single **multi-vertical** catalog: **FOOD** (Zomato-style restaurants),
> **GROCERY** (quick-commerce), and **SHOP** (Amazon-style e-commerce) — all
> served by one flexible `Store` + `Product` model.

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

## Data model

`users`, `stores`, `products`, `orders`, `order_items` — see
[`prisma/schema.prisma`](prisma/schema.prisma).

A **`Store`** is any merchant, tagged with a `vertical` (`FOOD` / `GROCERY` /
`SHOP`); a **`Product`** is any sellable item under a store. Food-only hints
(`cuisine`, `isVeg`) are optional and ignored for non-food verticals. One model
covers every vertical, so cart/checkout/orders are built once.

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
| GET    | `/stores`           | –            | Browse stores (vertical, search, filter, paginate) |
| GET    | `/stores/:id`       | –            | Store detail                                 |
| GET    | `/stores/:id/products` | –         | Products (filter by category, veg, price, search) |

**Browse query params** — `/stores`: `vertical` (`FOOD`/`GROCERY`/`SHOP`),
`search`, `cuisine`, `isVeg`, `page`, `limit`. `/stores/:id/products`:
`search`, `category`, `isVeg`, `minPrice`, `maxPrice`.

Examples: `/stores?vertical=FOOD` (Zomato view), `/stores?vertical=SHOP`
(Amazon view), `/stores?search=pizza`.

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
- **Search** currently uses case-insensitive `contains` matching. Upgrade to
  Postgres full-text search (tsvector) when the catalog grows.
- Seeding is idempotent: an admin plus 5 sample stores — 3 FOOD, 1 GROCERY,
  1 SHOP — each with products.
- **Phase 2 (Cart, Checkout & Payment)** is next: cart, addresses, transparent
  bill, and Razorpay (test mode) order creation.
