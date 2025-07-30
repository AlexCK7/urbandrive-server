// routes/driverRoutes.ts
import express, { Request, Response } from 'express';
import pool from '../models/db';
const router = express.Router();

// Driver accepts a ride
router.patch('/accept/:rideId', async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const { driverId } = req.body;

  try {
    const result = await pool.query(
      'UPDATE rides SET driver_id = $1, status = $2 WHERE id = $3 RETURNING *',
      [driverId, 'accepted', rideId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept ride' });
  }
});

// Driver updates ride status
router.patch('/status/:rideId', async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE rides SET status = $1 WHERE id = $2 RETURNING *',
      [status, rideId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ride status' });
  }
});

export default router;
