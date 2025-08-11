// index.ts
import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./models/db";

import userRoutes from "./routes/userRoutes";
import rideRoutes from "./routes/rideRoutes";
import adminRoutes from "./routes/adminRoutes";
import publicRoutes from "./routes/publicRoutes";
import driverRoutes from "./routes/driverRoutes";
import { systemRoutes } from "./routes/systemRoutes";
import driverApplicationRoutes from "./routes/driverApplicationRoutes";

import authOptional from "./middleware/auth"; // 👈 change to default import

import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();

// security & platform basics first
app.set("trust proxy", 1);
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// CORS + logging + body
app.use(cors({ origin: "*", methods: ["GET","POST","PUT","PATCH","DELETE"], credentials: true }));
app.use(morgan("dev"));
app.use(express.json());

// auth (populates req.authUser if token present)
app.use(authOptional);

// routes
app.use("/api/users", userRoutes);
app.use("/api/rides", rideRoutes);
app.use("/admin", adminRoutes);
app.use("/api/driver", driverRoutes);              // 👈 keep this one
app.use("/api/driver-applications", driverApplicationRoutes);
app.use("/", publicRoutes);
app.use("/", systemRoutes);

// Bind to 0.0.0.0 for tunnels
const PORT: number = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";
const server = app.listen(PORT, HOST, () => {
  const url = process.env.BASE_URL ?? `http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`;
  console.log(`✅ UrbanDrive backend is running at ${url}`);
});

// Seed required admins (idempotent)
(async () => {
  const adminEmails = ["taiga@urbdrive.com", "alex@example.com", "admin@urbdrive.com"];
  for (const email of adminEmails) {
    try {
      const existing = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
      if (!existing || (existing.rowCount ?? 0) === 0) {
        await pool.query("INSERT INTO users (name, email, role) VALUES ($1, $2, $3)", [
          email.split("@")[0], email, "admin",
        ]);
        console.log(`✅ Admin user created: ${email}`);
      } else {
        console.log(`⚠️ Admin user already exists: ${email}`);
      }
    } catch (err) {
      console.error(`❌ Error processing admin ${email}:`, err);
    }
  }
})();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 SIGINT received: closing server and database pool…");
  server.close(() => console.log("🔒 HTTP server closed."));
  await pool.end();
  console.log("✅ PostgreSQL pool closed.");
  process.exit(0);
});
