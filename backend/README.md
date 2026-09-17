# KasiBook Backend

A real Express + SQLite API for KasiBook, replacing the `localStorage`-only
demo in the current frontend. Tested and working end to end (register,
login, browse, book, cancel).

## Setup

```bash
npm install
cp .env.example .env
npm run seed      # loads the same 6 demo businesses as the old data.js, all with password "kasi123"
npm start         # runs on http://localhost:4000
```

For development with auto-restart on file changes: `npm run dev`.

The database is a single file (`kasibook.db`) created automatically —
no separate database server to install. Delete that file and re-run
`npm run seed` to start fresh.

This uses Node's **built-in** `node:sqlite` module (requires Node 22.5+),
so there's nothing to compile — no Visual Studio Build Tools or
node-gyp needed on Windows. You'll see a one-line
`ExperimentalWarning: SQLite is an experimental feature` printed on
startup — that's expected and harmless, not an error.

## Auth

Every protected route expects `Authorization: Bearer <token>`. You get a
token back from `/register` or `/login`. There are two separate token
types — a customer token won't work on business-only routes and vice versa.

## Endpoints

**Customers**
- `POST /api/customers/register` — `{ name, phone, password }`
- `POST /api/customers/login` — `{ phone, password }`
- `GET /api/customers/me/bookings` — auth required

**Businesses**
- `POST /api/businesses/register` — `{ name, category, owner, location, password }`
- `POST /api/businesses/login` — `{ business_id, password }`
- `GET /api/businesses` — optional `?category=`
- `GET /api/businesses/:id`
- `PATCH /api/businesses/:id` — auth required, self only — `{ name, tagline, location }`
- `POST /api/businesses/:id/photo` — auth required, self only — multipart field `photo`
- `DELETE /api/businesses/:id/photo` — auth required, self only
- `GET /api/businesses/me/bookings` — auth required — optional `?status=pending|confirmed|cancelled|declined`
- `GET /api/businesses/me/customers` — auth required

**Services**
- `POST /api/businesses/:id/services` — auth required, self only — `{ name, price, duration }` + optional multipart `photo`
- `DELETE /api/services/:id` — auth required, owner only
- `PATCH /api/services/:id/photo` — auth required, owner only — multipart field `photo`
- `DELETE /api/services/:id/photo` — auth required, owner only

**Bookings**
- `POST /api/bookings` — customer auth — `{ business_id, service_id, date, time }`
- `PATCH /api/bookings/:id/cancel` — customer auth, own booking only
- `PATCH /api/bookings/:id/accept` — business auth, own booking only
- `PATCH /api/bookings/:id/decline` — business auth, own booking only

## What's already handled server-side (don't trust the client for these)

- Passwords are hashed with bcrypt — never stored or returned in plaintext.
- Duplicate phone numbers / business names are rejected at registration.
- Double-booking a slot (same business + date + time) is rejected with a 409, even if the frontend's own client-side check somehow gets bypassed.
- Ownership checks: a business can only edit its own services/profile/bookings; a customer can only cancel their own bookings.
- Payment is still mocked (matches the current frontend) — no real card is charged, but `paid`/`payment_ref` are set by the server, not trusted from the client.

## Wiring up the existing frontend

`customer.js`, `merchant.js` and `data.js` currently read/write
`localStorage` directly. To point them at this API instead:

1. Replace `kbLoad()`/`kbSave()` calls with `fetch()` calls to the
   endpoints above, storing the returned JWT in `sessionStorage`
   instead of a customer/business id.
2. Every place that currently does `kbState.bookings.push(...)` or
   similar direct mutation becomes a `fetch(..., { method: "POST" })`
   followed by re-fetching (or using the endpoint's response) to
   update the UI.
3. Photo inputs: instead of `kbFileToDataUrl()` producing a base64
   string to store inline, `POST`/`PATCH` the file as
   `multipart/form-data` to the photo endpoints above and use the
   returned URL (e.g. `/uploads/xyz.jpg`) — you'll need to prefix it
   with the backend's origin (e.g. `http://localhost:4000/uploads/xyz.jpg`)
   since it's served from a different port than the static frontend.
4. Set `CORS_ORIGIN` in `.env` to wherever you're serving the frontend
   from (e.g. `http://127.0.0.1:5500` if using VS Code's Live Server).

## Production notes (skip these for a demo/marked submission)

- Move from SQLite to PostgreSQL for real concurrent traffic — the
  schema in `src/db.js` uses standard SQL and translates directly.
- Move uploaded files to S3-compatible storage instead of local disk.
- Set a strong, unique `JWT_SECRET` in production and never commit `.env`.
