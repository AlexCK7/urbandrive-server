
# 📘 UrbanDrive API Documentation

Welcome to the official UrbanDrive RESTful API, powering user management, ride bookings, and admin controls for the UrbanDrive platform.

---

## 🟢 Base URL

http://localhost:3001

---

## 📌 General Notes

- All routes (except `/`) require a valid `x-user-email` header.
- Admin routes require the user to be promoted to `"admin"`.
- This project uses environment variables for database config — see `.env.example`.

---

## 🧪 Testing Tools

We recommend using tools like:

- [Postman](https://www.postman.com/)
- `curl` (see `curl_tests.txt` for examples)
- Insomnia or similar REST clients

---

## 🌐 CORS & Headers

Cross-origin requests from the UrbanDrive frontend are supported.

### Required Header
```http
x-user-email: alex@urbdrive.com
```

---

## 📂 Public Routes

### GET /
Health check — returns welcome message.

```json
{ "message": "Welcome to the UrbanDrive API. Server is running." }
```

---

## 👤 User Routes

### POST /api/users
Create a new user.

**Headers**
```http
Content-Type: application/json
```

**Body**
```json
{
  "name": "Alexander",
  "email": "alex@urbdrive.com"
}
```

**Response**
```json
{ "message": "User created successfully" }
```

---

## 🚘 Ride Routes

### POST /api/rides
Create a new ride request.

**Headers**
```http
Content-Type: application/json
x-user-email: alex@urbdrive.com
```

**Body**
```json
{
  "pickup_location": "Downtown",
  "dropoff_location": "Airport"
}
```

**Response**
```json
{ "message": "Ride created successfully" }
```

---

### GET /api/rides
Fetch all ride requests made by the user.

**Headers**
```http
x-user-email: alex@urbdrive.com
```

**Response**
```json
[
  {
    "id": 1,
    "pickup_location": "Downtown",
    "dropoff_location": "Airport",
    "status": "pending",
    "requested_at": "2025-07-20T18:00:00.000Z"
  }
]
```

---

## 🛠 Admin Routes

> 🛑 Only accessible if the user has role = "admin"

### GET /admin/users
Return a list of all users.

**Headers**
```http
x-user-email: alex@urbdrive.com
```

---

### PUT /admin/promote/:email
Promote a user to admin status.

**Example**
```http
PUT /admin/promote/jane@urbdrive.com
```

**Headers**
```http
x-user-email: alex@urbdrive.com
```

---

### DELETE /admin/clear-users
Delete all users except those with role = "admin".

**Headers**
```http
x-user-email: alex@urbdrive.com
```

---

### DELETE /admin/clear-rides
Clear all ride history across all users.

**Headers**
```http
x-user-email: alex@urbdrive.com
```

---

## ❌ Error Handling

Common errors:

```json
{ "error": "Email header missing" }

{ "error": "Access denied: not an admin" }

{ "error": "Missing required fields" }
```

---

## 🧠 Built With

- Express.js + TypeScript
- PostgreSQL via Neon
- `.env` file for sensitive credentials (see `.env.example`)
- Role-based middleware
- Curl test suite: `curl_tests.txt`

---

_Last updated: 2025-07-20_