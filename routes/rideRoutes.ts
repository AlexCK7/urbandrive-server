import express, { Request, Response } from 'express';
import pool from '../models/db';

const router = express.Router();

/**
 * 🛺 Book a new ride (uses email header)
 */
router.post('/', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  const { origin, destination, pickup_location, dropoff_location } = req.body;

  const resolvedOrigin = origin || pickup_location;
  const resolvedDestination = destination || dropoff_location;

  if (!email || !resolvedOrigin || !resolvedDestination) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: {
        email_required: !email,
        origin_required: !resolvedOrigin,
        destination_required: !resolvedDestination
      }
    });
  }

  console.log("📩 Email header:", email);

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const user_id = userRes.rows[0]?.id;

    if (!user_id) {
      return res.status(404).json({ error: 'User not found for provided email' });
    }

    const result = await pool.query(
      'INSERT INTO rides (user_id, origin, destination) VALUES ($1, $2, $3) RETURNING *',
      [user_id, resolvedOrigin, resolvedDestination]
    );

    console.log("📦 Ride payload:", { resolvedOrigin, resolvedDestination });
    console.log("🔎 Resolved user_id:", user_id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Ride creation failed:', err);
    res.status(500).json({ error: 'Ride creation failed' });
  }
});

/**
 * 🚗 Admin-only: View all rides
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const email = req.headers['x-user-email'] as string;
    if (!email) return res.status(400).json({ error: 'Missing email header' });

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view all rides' });
    }

    const result = await pool.query('SELECT * FROM rides ORDER BY requested_at DESC');
    res.json({ rides: result.rows });
  } catch (error) {
    console.error('❌ Error fetching all rides:', error);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// GET /api/rides/user - Get rides for a specific user by email
router.get('/user', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  try {
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const userId = userResult.rows[0].id;
    const rideResult = await pool.query("SELECT * FROM rides WHERE user_id = $1", [userId]);

    return res.json({ rides: rideResult.rows });
  } catch (err) {
    console.error("❌ Error fetching user rides:", err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rides/driver - Get rides assigned to a driver
router.get('/driver', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  try {
    const driverResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (driverResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

    const driverId = driverResult.rows[0].id;
    const rideResult = await pool.query("SELECT * FROM rides WHERE driver_id = $1", [driverId]);

    return res.json({ rides: rideResult.rows });
  } catch (err) {
    console.error("❌ Error fetching driver rides:", err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
