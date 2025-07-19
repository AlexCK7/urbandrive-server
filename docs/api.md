# 📘 UrbanDrive API Documentation

Welcome to the official UrbanDrive API. This RESTful API powers all backend functionality for users, rides, and admin control.

---

## 🟢 Base URL

```
http://localhost:3001
```

---

## 📂 Public Routes

### `GET /`
Returns a welcome message to confirm server is running.

**Response**
```json
{ "message": "Welcome to the UrbanDrive API. Server is running." }
```

---

## 👤 User Routes

### `POST /api/users`
Create a new user.

**Headers**
```
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

### `POST /api/rides`
Create a new ride request.

**Headers**
```
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

### `GET /api/rides`
Get all rides for the authenticated user.

**Headers**
```
x-user-email: alex@urbdrive.com
```

---

## 🛠 Admin Routes

> All admin routes require a user with role = "admin" and a valid `x-user-email` header.

---

### `GET /admin/users`
Returns list of all users.

**Headers**
```
x-user-email: alex@urbdrive.com
```

---

### `PUT /admin/promote/:email`
Promote a user to admin.

**Headers**
```
x-user-email: alex@urbdrive.com
```

**Example**
```
PUT /admin/promote/alex2@urbdrive.com
```

---

### `DELETE /admin/clear-users`
Deletes all users **except admins**.

**Headers**
```
x-user-email: alex@urbdrive.com
```

---

### `DELETE /admin/clear-rides`
Deletes all ride history for all users.

**Headers**
```
x-user-email: alex@urbdrive.com
```

---

## ⚠️ Error Handling

All unauthorized or failed actions will return:
```json
{ "error": "Access denied: not an admin" }
```
or
```json
{ "error": "Email header missing" }
```

---

## 📌 Notes

- All requests must include a valid `x-user-email` header to identify the user.
- Admin endpoints require the user's role to be `"admin"`.