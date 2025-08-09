# 🚀 UrbanDrive Server (Express + Postgres + TypeScript)

Backend API for UrbanDrive. Provides users, rides, role‑based access (user/driver/admin), and admin assignment flows.

---

## 🧰 Prerequisites
- Node 18+
- PostgreSQL (Neon or local)
- Bash (for helper scripts)

---

## 🛠 Setup

```bash
npm install
```

Create `.env`:

```ini
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
PORT=3001
BASE_URL=http://localhost:3001
```

---

## ▶️ Run (single Ctrl‑C shutdown)

```bash
npm run start:dev
```
- Starts the API via `nodemon` (TypeScript).
- Tries **localtunnel** first; if not found, falls back to **ngrok**.
- Prints ngrok dashboard: `http://127.0.0.1:4040`
- One `Ctrl‑C` stops API **and** tunnel.

---

## 🧪 Smoke Tests

Validate core flows locally and over ngrok:

```bash
npm run smoke:local
npm run smoke:ngrok
```

These verify:
- Health
- Create user (idempotent)
- Book ride
- Admin list rides
- Assign driver
- Share ride
- Driver views rides
- Complete ride
- Confirm completion

---

## 📁 Structure (key files)

```
index.ts                   # Express app boot
routes/
  publicRoutes.ts          # /health and misc
  userRoutes.ts            # /api/users
  rideRoutes.ts            # /api/rides (book/share/assign/complete)
  adminRoutes.ts           # /admin/*
  driverRoutes.ts          # /api/drivers
  systemRoutes.ts          # internal helpers (e.g., ngrok info)
models/
  db.ts                    # pg Pool
scripts/
  start-dev.sh             # starts API + tunnel; single Ctrl-C cleanup
  smoke.sh                 # end-to-end curl smoke tests
```

---

## 🔐 Auth & Roles
- Header `x-user-email` identifies the caller (demo‑friendly).
- Admin‑only endpoints guard by role.
- Consider JWT/OAuth for production.

---

## 🧭 Helpful commands

Local health:
```bash
curl -sf http://localhost:3001/health && echo OK
```

Current ngrok BASE:
```bash
curl -s http://127.0.0.1:4040/api/tunnels | sed -n 's/.*"public_url":"\([^"]*\)".*/\1/p' | head -n1
```

---

## ✅ Status
Server is **stable** for Milestone‑1 and demo‑ready.