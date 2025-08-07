import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './models/db';

import userRoutes from './routes/userRoutes';
import rideRoutes from './routes/rideRoutes'; // make sure rideRoutes uses `export default router;`
import adminRoutes from './routes/adminRoutes';
import publicRoutes from './routes/publicRoutes';
import driverRoutes from './routes/driverRoutes';

dotenv.config();

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/rides', rideRoutes);
app.use('/admin', adminRoutes);
app.use('/', publicRoutes);
app.use('/api/drivers', driverRoutes);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log("✅ BASE_URL should match:", process.env.BASE_URL);
  console.log(`✅ UrbanDrive backend is running on http://localhost:${PORT}`);
});

/**
 * 🛡️ Dynamically insert multiple admin emails if not present
 * This uses an async IIFE — an Immediately Invoked Function Expression
 */
(async () => {
  const adminEmails = ["taiga@urbdrive.com", "alex@example.com", "admin@urbdrive.com"];

  for (const email of adminEmails) {
    try {
      const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (existing.rows.length === 0) {
        await pool.query("INSERT INTO users (name, email, role) VALUES ($1, $2, $3)", [
          email.split("@")[0], email, "admin"
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

/**
 * 🔒 Clean shutdown logic for local dev
 */
process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received: Closing server and database pool...');
  server.close(() => {
    console.log('🔒 HTTP server closed.');
  });
  await pool.end();
  console.log('✅ PostgreSQL pool closed.');
  process.exit(0);
});
