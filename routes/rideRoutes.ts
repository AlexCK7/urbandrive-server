import express from 'express';
import pool from '../models/db';
const router = express.Router();

// Book a new ride
router.post('/', async (req, res) => {
  const { user_id, pickup_location, dropoff_location } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO rides (user_id, pickup_location, dropoff_location) VALUES ($1, $2, $3) RETURNING *',
      [user_id, pickup_location, dropoff_location]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ride creation failed' });
  }
});

// Get all rides
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rides');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

export default router;
