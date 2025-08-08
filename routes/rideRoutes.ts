import express, { Request, Response } from 'express';
import pool from '../models/db';

const router = express.Router();

// Book a new ride
router.post('/', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  const { origin, destination, sharedWithEmail } = req.body;

  if (!email || !origin || !destination) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(
      'INSERT INTO rides (user_id, origin, destination, shared_with_email) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, origin, destination, sharedWithEmail || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ride creation failed:', err);
    res.status(500).json({ error: 'Ride creation failed' });
  }
});

// Get all rides (admin only)
router.get('/', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = userResult.rows[0];
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can view all rides' });
  }

  try {
    const result = await pool.query('SELECT * FROM rides ORDER BY requested_at DESC');
    res.json({ rides: result.rows });
  } catch (err) {
    console.error('Error fetching rides:', err);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// Get rides for a specific user
router.get('/user', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const userId = userResult.rows[0].id;
    const rideResult = await pool.query('SELECT * FROM rides WHERE user_id = $1', [userId]);
    res.json({ rides: rideResult.rows });
  } catch (err) {
    console.error('Error fetching user rides:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get rides for a driver (assigned)
router.get('/driver', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(400).json({ error: 'Missing email header' });

  try {
    const driverResult = await pool.query('SELECT id FROM users WHERE email = $1 AND role = $2', [email, 'driver']);
    if (driverResult.rows.length === 0) return res.status(403).json({ error: 'Driver not found' });

    const driverId = driverResult.rows[0].id;
    const ridesResult = await pool.query('SELECT * FROM rides WHERE driver_id = $1', [driverId]);
    res.json({ rides: ridesResult.rows });
  } catch (err) {
    console.error('Error fetching driver rides:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign driver to ride (admin)
router.patch('/:id/assign', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  const { id } = req.params;
  const { driverEmail } = req.body;

  if (!email || !driverEmail) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const adminResult = await pool.query('SELECT role FROM users WHERE email = $1', [email]);
  if (adminResult.rows[0]?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can assign rides' });
  }

  try {
    const driverRes = await pool.query('SELECT id FROM users WHERE email = $1 AND role = $2', [driverEmail, 'driver']);
    const driverId = driverRes.rows[0]?.id;
    if (!driverId) return res.status(404).json({ error: 'Driver not found' });

    await pool.query('UPDATE rides SET driver_id = $1, status = $2 WHERE id = $3', [driverId, 'assigned', id]);
    res.json({ message: 'Driver assigned' });
  } catch (err) {
    console.error('Error assigning ride:', err);
    res.status(500).json({ error: 'Failed to assign driver' });
  }
});

// Share ride with friend
router.patch('/:id/share', async (req: Request, res: Response) => {
  const email = req.headers['x-user-email'] as string;
  const { id } = req.params;
  const { friendEmail } = req.body;

  if (!email || !friendEmail) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await pool.query('UPDATE rides SET shared_with_email = $1 WHERE id = $2 AND user_id = $3', [
      friendEmail,
      id,
      userResult.rows[0].id,
    ]);
    res.json({ message: 'Ride shared successfully' });
  } catch (err) {
    console.error('Error sharing ride:', err);
    res.status(500).json({ error: 'Failed to share ride' });
  }
});


router.patch('/:rideId/assign', async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const adminEmail = req.headers['x-user-email'] as string;
  const { driverEmail } = req.body;

  try {
    // Verify admin
    const adminCheck = await pool.query('SELECT role FROM users WHERE email=$1', [adminEmail]);
    if (!adminCheck.rows[0] || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can assign rides' });
    }

    // Verify driver exists and has driver role
    const driverCheck = await pool.query('SELECT id, role FROM users WHERE email=$1', [driverEmail]);
    if (!driverCheck.rows[0] || driverCheck.rows[0].role !== 'driver') {
      return res.status(404).json({ error: 'Driver not found or not a driver' });
    }

    // Assign ride
    await pool.query(
      'UPDATE rides SET driver_id=$1, status=$2 WHERE id=$3 RETURNING *',
      [driverCheck.rows[0].id, 'assigned', rideId]
    );
    return res.json({ message: 'Ride assigned successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error while assigning ride' });
  }
});

router.patch('/:rideId/share', async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const riderEmail = req.headers['x-user-email'] as string;
  const { friendEmail } = req.body;

  try {
    // Check ownership of ride
    const riderCheck = await pool.query(
      'SELECT users.email FROM rides JOIN users ON rides.user_id = users.id WHERE rides.id=$1',
      [rideId]
    );
    if (!riderCheck.rows[0] || riderCheck.rows[0].email !== riderEmail) {
      return res.status(403).json({ error: 'You cannot share a ride you do not own' });
    }

    // Update ride with friend’s email
    await pool.query('UPDATE rides SET shared_with_email=$1 WHERE id=$2', [friendEmail, rideId]);
    return res.json({ message: 'Ride shared successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error while sharing ride' });
  }
});

export default router;
