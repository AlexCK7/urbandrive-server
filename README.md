# 🚀 UrbanDrive Backend

This is the backend API for the UrbanDrive platform — a modern ride-sharing application built with Express.js, PostgreSQL, and TypeScript. It provides endpoints for user creation, ride booking, and admin-level data control.

---

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js with ts-node
- **Framework**: Express.js
- **Database**: PostgreSQL (hosted on [Neon](https://neon.tech))
- **Environment Management**: dotenv
- **ORM**: `pg` with raw SQL

---

## 📁 Folder Structure

```
urbandrive-server/
├── index.ts              # Main server file
├── routes/
│   ├── publicRoutes.ts   # Base and health check routes
│   ├── userRoutes.ts     # User creation and handling
│   ├── rideRoutes.ts     # Ride booking and history
│   └── adminRoutes.ts    # Admin-only actions
├── db.ts                 # PostgreSQL connection setup
├── .env.example          # Sample environment variables
├── curl_tests.txt        # Example curl commands
├── api.md                # API documentation
├── backend-summary.md    # System logic overview
```

---

## 🔐 Authentication & Access Control

- All routes (except `/`) require the `x-user-email` header.
- Admin routes check if user’s role is `"admin"`.
- Role-based middleware for clean access enforcement.

---

## 🚀 Running the Server

```bash
npm install
npm run dev
```

Ensure your `.env` is properly set. Use `.env.example` as a guide.

---

## 🔄 Sample `.env` Configuration

```
DATABASE_URL=your_postgresql_connection_string
PORT=3001
```

---

## 📘 Documentation

- [API Docs](./api.md)
- [Backend Summary](./backend-summary.md)

---

## 📌 Developer Notes

- Use `curl_tests.txt` to test all routes
- Use `git` and `GitHub` to version backend and avoid pushing `.env` files
- Run `BFG` to remove sensitive files if pushed by accident

---

## ✅ To-Do / Future Features

- Token-based auth (JWT or Firebase)
- Input validation (Zod, Joi)
- Logging & error monitoring
- Deployment: Railway or Vercel serverless functions
- Automated tests (Jest + Supertest)

---

## 🧠 Author’s Note

This backend is designed for clarity, extensibility, and production-readiness. It reflects strong backend fundamentals, role handling, and practical dev skills.

Built with intent. Made to scale.

---

_Last updated: July 21, 2025_