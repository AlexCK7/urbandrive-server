import express, { Request, Response } from 'express';
import pool from '../models/db';

const router = express.Router();


/* Book a ride (supports sharedWithEmail) */
router.post('/', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  const { origin, destination, sharedWithEmail } = req.body;
  if (!email || !origin || !destination) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: { email_required: !email, origin_required: !origin, destination_required: !destination },
    });
  }

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userRes.rows[0]?.id;
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const insert = await pool.query(
      'INSERT INTO rides (user_id, origin, destination, shared_with_email) VALUES ($1,$2,$3,$4) RETURNING *',
      [userId, origin, destination, sharedWithEmail || null]
    );
    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error('Ride creation failed:', err);
    res.status(500).json({ error: 'Ride creation failed' });
  }
});

/* Get rides for a user (owner or shared) */
router.get('/user', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userRes.rows[0]?.id;
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const rides = await pool.query(
      'SELECT * FROM rides WHERE user_id = $1 OR shared_with_email = $2 ORDER BY requested_at DESC',
      [userId, email]
    );
    res.json({ rides: rides.rows });
  } catch (err) {
    console.error('Fetching user rides failed:', err);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

/* Admin: assign ride to driver */
router.patch('/:id/assign', async (req: Request, res: Response) => {
  const rideId = req.params.id;
  const email = req.headers['x-user-email'] as string;
  const { driverEmail } = req.body;
  if (!email || !driverEmail) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const adminRes = await pool.query('SELECT role FROM users WHERE email = $1', [email]);
    if (adminRes.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Only admins can assign rides' });

    const driverRes = await pool.query('SELECT id FROM users WHERE email = $1 AND role = $2', [driverEmail, 'driver']);
    const driverId = driverRes.rows[0]?.id;
    if (!driverId) return res.status(404).json({ error: 'Driver not found' });

    await pool.query('UPDATE rides SET driver_id = $1, status = $2 WHERE id = $3', [driverId, 'assigned', rideId]);
    res.json({ message: 'Ride assigned successfully' });
  } catch (err) {
    console.error('Assigning ride failed:', err);
    res.status(500).json({ error: 'Failed to assign ride' });
  }
});

/* Driver self-assign */
router.patch('/:id/self-assign', async (req: Request, res: Response) => {
  const rideId = req.params.id;
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  try {
    const driverRes = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    const driver = driverRes.rows[0];
    if (!driver || driver.role !== 'driver') return res.status(403).json({ error: 'Only drivers can assign themselves' });

    const rideRes = await pool.query('SELECT status, driver_id FROM rides WHERE id = $1', [rideId]);
    const ride = rideRes.rows[0];
    if (!ride || ride.driver_id) return res.status(400).json({ error: 'Ride already assigned' });

    await pool.query('UPDATE rides SET driver_id = $1, status = $2 WHERE id = $3', [driver.id, 'assigned', rideId]);
    res.json({ message: 'Ride assigned to driver' });
  } catch (err) {
    console.error('Self-assign failed:', err);
    res.status(500).json({ error: 'Failed to self-assign ride' });
  }
});

/* Driver completes ride */
router.patch('/:id/complete', async (req: Request, res: Response) => {
  const rideId = req.params.id;
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  try {
    const driverRes = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    const driver = driverRes.rows[0];
    if (!driver || driver.role !== 'driver') return res.status(403).json({ error: 'Only drivers can complete rides' });

    const rideRes = await pool.query('SELECT driver_id, status FROM rides WHERE id = $1', [rideId]);
    const ride = rideRes.rows[0];
    if (!ride || ride.driver_id !== driver.id) return res.status(403).json({ error: 'You are not assigned to this ride' });

    await pool.query('UPDATE rides SET status = $1 WHERE id = $2', ['completed', rideId]);
    res.json({ message: 'Ride completed' });
  } catch (err) {
    console.error('Completing ride failed:', err);
    res.status(500).json({ error: 'Failed to complete ride' });
  }
});

/* Share ride after creation (optional) */
router.patch('/:id/share', async (req: Request, res: Response) => {
  const rideId = req.params.id;
  const email = req.headers['x-user-email'] as string;
  const { sharedWithEmail } = req.body;
  if (!email || !sharedWithEmail) return res.status(400).json({ error: 'Missing fields' });

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userRes.rows[0]?.id;
    const rideRes = await pool.query('SELECT user_id FROM rides WHERE id = $1', [rideId]);
    if (!rideRes.rows.length || rideRes.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Only the ride creator can share this ride' });
    }
    await pool.query('UPDATE rides SET shared_with_email = $1 WHERE id = $2', [sharedWithEmail, rideId]);
    res.json({ message: 'Ride shared successfully' });
  } catch (err) {
    console.error('Sharing ride failed:', err);
    res.status(500).json({ error: 'Failed to share ride' });
  }
});

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
