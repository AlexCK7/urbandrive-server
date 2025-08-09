// index.ts (finalized)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./models/db";
import userRoutes from "./routes/userRoutes";
import rideRoutes from "./routes/rideRoutes";
import adminRoutes from "./routes/adminRoutes";
import publicRoutes from "./routes/publicRoutes";
import driverRoutes from "./routes/driverRoutes";
import { systemRoutes } from "./routes/systemRoutes";

dotenv.config();

const app = express();

// CORS setup (open for front‑end dev; refine as needed)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));

app.use(express.json());

// API routes
app.use("/api/users", userRoutes);
app.use("/api/rides", rideRoutes);
app.use("/admin", adminRoutes);
app.use("/", publicRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/", systemRoutes);

// Bind to 0.0.0.0 so external tunnels can reach the server
const PORT: number = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";
const server = app.listen(PORT, HOST, () => {
  const url = process.env.BASE_URL ?? `http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`;
  console.log(`✅ UrbanDrive backend is running at ${url}`);
});

// Seed required admin users
(async () => {
  const adminEmails = ["taiga@urbdrive.com", "alex@example.com", "admin@urbdrive.com"];
  for (const email of adminEmails) {
    try {
      const existing = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
      if (existing.rowCount === 0) {
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
  server.close(() => {
    console.log("🔒 HTTP server closed.");
  });
  await pool.end();
  console.log("✅ PostgreSQL pool closed.");
  process.exit(0);
});
