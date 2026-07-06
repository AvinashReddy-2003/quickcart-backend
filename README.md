# QuickCart Backend

Shared backend for the QuickCart super-app (food → grocery → e-commerce).
NestJS + PostgreSQL + Redis + Prisma, in TypeScript.

> **Status: Phase 0 ✅ · 1 Browse ✅ · 2 Cart & Checkout ✅ · 3 Live Tracking ✅**
> Full customer path works end to end on one **multi-vertical** engine — **FOOD**
> (Zomato-style), **GROCERY**, **SHOP** (Amazon-style): log in (OTP → JWT/RBAC) →
> browse & search → cart + coupons → checkout against a saved address → pay →
> **watch the order move on a live map** as a simulated rider drives it to the
> door → reorder. A test-paid order lands in the DB; delivery streams over
> WebSockets.

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
| GET/POST/PATCH/DELETE | `/cart`, `/cart/items[/:productId]` | Bearer | Cart with live server-side bill |
| GET/POST/DELETE | `/addresses[/:id]` | Bearer   | Saved delivery addresses           |
| POST   | `/checkout`         | Bearer       | Turn cart into an order + open payment |
| POST   | `/payments/verify`  | Bearer       | Confirm payment (idempotent)         |
| GET    | `/orders`, `/orders/:id` | Bearer  | Order history & detail               |
| GET    | `/orders/:id/tracking` | Bearer   | Delivery snapshot (status, rider, live location) |
| POST   | `/orders/:id/reorder` | Bearer    | Refill the cart from a past order    |

### Live delivery tracking (WebSocket)

Socket.IO namespace **`/tracking`**. After payment, a **simulated rider** is
assigned and drives from the store to the customer; the order advances
`PREPARING → OUT_FOR_DELIVERY → DELIVERED` automatically.

```js
const socket = io('http://localhost:3000/tracking', { transports: ['websocket'] });
socket.on('connect', () => socket.emit('subscribe', { token, orderId }));
socket.on('snapshot',       (s) => {}); // initial state on connect / reconnect
socket.on('rider:assigned', (r) => {});
socket.on('order:status',   (s) => {}); // { status }
socket.on('rider:location', (l) => {}); // { lat, lng, progress }
socket.on('order:delivered',(d) => {});
```

Subscribe is JWT-authed and scoped to the order's owner. `GET /orders/:id/tracking`
gives the same state over REST for the initial map render or after a dropped socket.

**Browse query params** — `/stores`: `vertical` (`FOOD`/`GROCERY`/`SHOP`),
`search`, `cuisine`, `isVeg`, `page`, `limit`. `/stores/:id/products`:
`search`, `category`, `isVeg`, `minPrice`, `maxPrice`.

Examples: `/stores?vertical=FOOD` (Zomato view), `/stores?vertical=SHOP`
(Amazon view). Cart bill preview with a coupon: `GET /cart?coupon=WELCOME50`.

**Checkout flow:** add to cart → `POST /addresses` → `POST /checkout`
`{ addressId, couponCode? }` (returns `paymentOrderId` + amount) →
`POST /payments/verify` `{ orderId, paymentId }` → order marked `PAID`.

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
- **Cart** is Redis-backed and single-store (like Zomato); adding items from a
  different store returns `409` until the cart is cleared.
- **Pricing** is fully server-side (client prices are never trusted). Delivery:
  ₹40 for FOOD/GROCERY; SHOP free over ₹500 else ₹49. Demo coupons:
  `WELCOME50` (₹50 off ≥₹199), `SAVE10` (10% off ≤₹100, ≥₹299).
- **Payments** run in **mock mode** unless `RAZORPAY_KEY_ID`/`_SECRET` are set —
  checkout and paid orders work end-to-end without live keys. `verify` is
  idempotent, so a repeated call can't double-charge.
- Serviceability is a placeholder (Hyderabad `5xxxxx` pincodes); wire real
  geo/serviceability later.
- **Delivery is simulated** (the "student-smart shortcut"): a fake rider is
  auto-assigned and interpolated from store → customer over ~35s. Swap in the
  real vendor/delivery apps in later phases without touching the customer flow.
- **Next:** the visible customer app (a Zomato/Amazon-style UI on these APIs),
  or Phase 4/5 backend (real vendor dashboard + admin console).
