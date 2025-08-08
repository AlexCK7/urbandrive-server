import express from 'express';
import { signupUser, loginUser, getAllUsers } from '../controllers/userController';
import pool from '../models/db';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';

const router = express.Router();

// POST /api/users/signup
router.post('/signup', signupUser);

// POST /api/users/login
router.post('/login', loginUser);

router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password, role = 'user' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['user', 'driver'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4)',
      [name, email, hashed, role]
    );
    res.status(201).json({ message: 'Signup successful' });
  } catch (err) {
    console.error('Signup failed:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/users/  — Admin-style creation
router.post('/', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  try {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, role || 'user']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Admin user creation failed:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /api/users/
router.get('/', getAllUsers);

router.get('/:id', async (req: Request, res: Response) => {
  const userId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user by ID failed:', err);
    res.status(500).json({ error: 'Error retrieving user' });
  }
});

export default router;
