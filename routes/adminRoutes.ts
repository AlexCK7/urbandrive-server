// routes/adminRoutes.ts
import express from 'express';
import pool from '../models/db';

const router = express.Router();

// Middleware to check if requester is admin
router.use(async (req, res, next) => {
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

// ✅ GET all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ✅ Promote a user to admin
router.put('/promote/:email', async (req, res) => {
  const { email } = req.params;
  try {
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
    res.json({ message: `${email} promoted to admin` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

// ✅ DELETE all non-admin users
router.delete('/clear-users', async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE role != 'admin'");
    res.json({ message: 'Non-admin users deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete users' });
  }
});

// ✅ DELETE all rides
router.delete('/clear-rides', async (req, res) => {
  try {
    await pool.query('DELETE FROM rides');
    res.json({ message: 'All rides deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rides' });
  }
});

export default router;
