# UrbanDrive — Phase 1

## What shipped
- Users/auth (JWT) with roles: `user`, `driver`, `admin`
- Rides core: create, admin-assign, share, list
- Driver lifecycle: `accepted → enroute → arrived → completed` (+ `cancelled`)
- Driver applications: apply → admin review/approve → role flips to `driver`
- Admin ops: list users, change role, approve/revoke drivers
- Hardening: helmet, rate limit, CORS, auth middleware
- Smoke scripts: `scripts/smoke-phase1.sh`, `scripts/smoke-driver-apps.sh`

## Quick start
```bash
npm i
npm run dev           # starts server on :3001
curl -s http://localhost:3001/health | jq
```

## Routes (high level)
- `POST /api/users/signup|login` → `{ user, token }`
- `GET /api/users/me` (auth)
- `POST /api/rides` (user)
- `PATCH /api/rides/:id/assign` (admin)
- `PATCH /api/driver/status/:id` (driver/admin) body `{status}`
- `POST /api/driver/:id/cancel` (driver/admin)
- `POST /api/driver-applications/apply` (user/driver)
- `GET /api/driver-applications/mine` (auth)
- `GET /admin/driver-applications?status=applied` (admin)
- `POST /admin/driver-applications/:id/approve|reject` (admin)
- `GET /admin/users` (admin)
- `PATCH /admin/users/:id/role` (admin)
- `POST /admin/drivers/approve|revoke` (admin)

## DB bootstrap for fresh env
If migrations haven’t run yet:
```sql
DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM ('pending','assigned','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'enroute';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'arrived';

DO $$ BEGIN
  CREATE TYPE driver_app_status AS ENUM ('applied','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS driver_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number TEXT,
  vehicle TEXT,
  notes TEXT,
  status driver_app_status NOT NULL DEFAULT 'applied',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_driver_apps_user   ON driver_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_apps_status ON driver_applications(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_apps_user_pending
  ON driver_applications(user_id) WHERE status='applied';
```

## Smoke test (ride flow)
```bash
BASE=http://localhost:3001
ADMIN_TOKEN=$(curl -s -X POST "$BASE/api/users/login" -H 'Content-Type: application/json' -d '{"email":"admina@example.com"}' | jq -r '.token')
USER_TOKEN=$(curl -s -X POST "$BASE/api/users/login"  -H 'Content-Type: application/json' -d '{"email":"alice@example.com"}'   | jq -r '.token')
DRIVER_TOKEN=$(curl -s -X POST "$BASE/api/users/login" -H 'Content-Type: application/json' -d '{"email":"driver1@example.com"}' | jq -r '.token')

RIDE_ID=$(curl -s -X POST "$BASE/api/rides" -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d '{"origin":"Airport","destination":"Downtown"}' | jq -r '.id')
curl -s -X PATCH "$BASE/api/rides/$RIDE_ID/assign" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"driverEmail":"driver1@example.com"}' | jq

for S in accepted enroute arrived completed; do
  echo "Setting status=$S"
  curl -s -X PATCH "$BASE/api/driver/status/$RIDE_ID"     -H "Authorization: Bearer $DRIVER_TOKEN"     -H 'Content-Type: application/json'     -d "{"status":"$S"}" | jq '{id,status}'
done
```

## Notes / Troubleshooting
- When piping to `jq`, use `curl -s` (don’t use `-i`, which includes headers).
- You recorded two migrations in `pgmigrations` already; see the real migration files in this repo for fresh envs.
