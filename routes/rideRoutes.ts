// routes/rideRoutes.ts
import express, { Request, Response } from 'express';
import pool from '../models/db';

const router = express.Router();

// Book a new ride
router.post('/', async (req: Request, res: Response) => {
  const { user_id, origin, destination } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO rides (user_id, origin, destination) VALUES ($1, $2, $3) RETURNING *',
      [user_id, origin, destination]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Ride creation failed:', err); // <-- Add this
    res.status(500).json({ error: 'Ride creation failed' });
  }
});

// Get all rides (optionally filtered by status)
router.get('/', async (req: Request, res: Response) => {
  const { status } = req.query;

  try {
    let query = 'SELECT * FROM rides';
    let params: any[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// Assign driver to ride
router.post('/:rideId/assign', async (req: Request, res: Response) => {
  const rideId = req.params.rideId;
  const { driver_id } = req.body;

  try {
    // 1. Confirm the driver exists and has correct role
    const driverCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [driver_id, 'driver']
    );

    if (driverCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid driver ID or role' });
    }

    // 2. Assign the driver
    const result = await pool.query(
      `UPDATE rides 
       SET driver_id = $1, status = 'assigned' 
       WHERE id = $2 
       RETURNING *`,
      [driver_id, rideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    const error = err as Error;
    console.error('Driver assignment error:', error);
    res.status(500).json({ error: 'Failed to assign driver', details: error.message });
  }
});

export default router;
