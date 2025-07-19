import express from 'express';
import pool from '../models/db';
const router = express.Router();

// Create user
router.post('/', async (req, res) => {
  const { name, email, role } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING *',
      [name, email, role || 'user']
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ message: 'User already exists' });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get all users
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user by ID
router.get('/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving user' });
  }
});

export default router;
