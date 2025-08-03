# 🧠 UrbanDrive Backend Summary

This file outlines the structure, logic, and future improvements for the UrbanDrive backend system.

---

## ✅ Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js with ts-node
- **Framework**: Express.js
- **Database**: PostgreSQL (via Neon)
- **ORM**: Raw SQL with pg
- **Environment**: `.env` with dotenv

---

## 📂 Folder Structure

```
urbandrive-server/
├── index.ts              # Main server file
├── routes/
│   ├── publicRoutes.ts   # Public and base routes
│   ├── userRoutes.ts     # User registration and data
│   ├── rideRoutes.ts     # Ride booking and retrieval
│   └── adminRoutes.ts    # Admin control actions
├── db.ts                 # PostgreSQL pool connection
├── .env                  # Environment variables
```

---

## 🔐 Role-based Access

- Every route checks the `x-user-email` header.
- Admin routes enforce `role = 'admin'`.
- Promotion and data clearing restricted to admins only.

---

## 🚦 Available Routes

| **Method** | **Endpoint**                       | **Role Required** | **Description**                        |
|--------|--------------------------------|----------------|------------------------------------|
| GET    | `/`                            | Public         | Health check                       |
| POST   | `/api/users`                   | Public         | Create new user                    |
| POST   | `/api/rides`                   | User           | Book ride                          |
| GET    | `/api/rides`                   | User           | Fetch ride history                 |
| GET    | `/admin/users`                 | Admin          | List all users                     |
| PUT    | `/admin/promote/:email`        | Admin          | Promote user to admin              |
| DELETE | `/admin/clear-users`           | Admin          | Delete all non-admin users         |
| DELETE | `/admin/clear-rides`           | Admin          | Delete all ride records            |

---

## 🧪 Dev & Testing

- Run server: `./start-dev`
- Test endpoints: use `curl_tests.txt`
- Logs confirm `.env` is loading properly

---

## 🌱 Future Ideas

- Token-based auth (JWT or Firebase Auth)
- Enhanced validation with Zod or Joi
- Rate limiting + logging
- Deployment with Railway or Vercel serverless
- Frontend: Expo Router + SecureStore + fetch() (React Native, in progress)

---

## 👁️ Vision

UrbanDrive is designed to be clean, scalable, and showcase my backend skills at a high level — from startup-level polish to production-grade architecture.

Built with intent. Made to impress.