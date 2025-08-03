
# 📘 UrbanDrive API Documentation

Welcome to the official UrbanDrive RESTful API, powering user management, ride bookings, and admin controls for the UrbanDrive platform.

---

## 📦 Version: 1.0.0  
📅 Last Updated: 2025-08-02

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

We recommend:

- [Postman](https://www.postman.com/)
- `curl` — see `curl_tests.txt`
- Insomnia or REST clients

---

## 🌐 CORS & Headers

Cross-origin requests from the UrbanDrive frontend are supported.

**Required Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
```

---

## 📂 Public Routes

### GET /
Health check.

**Response**
```json
{ "message": "Welcome to the UrbanDrive API. Server is running." }
```

---

## 👤 User Routes

### POST /api/users
Create a user.

**Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
```

**Body**
```json
{
  "name": "Taiga",
  "email": "taiga@urbdrive.com"
}
```

**Response**
```json
{ "message": "User created successfully" }
```

---

## 🚘 Ride Routes

### POST /api/rides
Request a ride.

**Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
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
Get rides for current user.

**Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
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

> Only available for users with `"role": "admin"`

### GET /admin/users
Get all users.

**Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
```

---

### PUT /admin/promote/:email
Make a user an admin.

**Example Route**
```http
PUT /admin/promote/jane@urbdrive.com
```

**Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
```

---

### DELETE /admin/clear-users
Remove all non-admin users.

**Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
```

---

### DELETE /admin/clear-rides
Remove all ride history.

**Headers**
```http
Content-Type: application/json
x-user-email: taiga@urbdrive.com
```

---

## ❌ Error Handling

Common responses:
```json
{ "error": "Email header missing" }
{ "error": "Access denied: not an admin" }
{ "error": "Missing required fields" }
```

---

## 🧠 Built With

- Express.js + TypeScript
- PostgreSQL (via Neon)
- Role-based access middleware
- Environment config via `.env`
- Curl testing: `curl_tests.txt`