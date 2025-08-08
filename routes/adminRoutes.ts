import express, { Request, Response } from 'express';
import pool from '../models/db';

const router = express.Router();

// Middleware to check admin
router.use(async (req: Request, res: Response, next) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) return res.status(401).json({ error: 'Email header missing' });

  try {
    const result = await pool.query('SELECT role FROM users WHERE email = $1', [email]);
    if (result.rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: not an admin' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
});

// List all drivers
router.get('/drivers', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE role = $1', ['driver']);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// Promote a user to admin
router.put('/promote/:email', async (req: Request, res: Response) => {
  const { email } = req.params;
  try {
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
    res.json({ message: `${email} promoted to admin` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

// Delete non-admin users
router.delete('/clear-users', async (_req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM users WHERE role != 'admin'");
    res.json({ message: 'Non-admin users deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete users' });
  }
});

// Delete all rides
router.delete('/clear-rides', async (_req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM rides');
    res.json({ message: 'All rides deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rides' });
  }
});

router.get('/drivers', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE role=$1', ['driver']);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

export default router;
