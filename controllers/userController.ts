// controllers/userController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../models/db';

// SIGNUP
export const signupUser = async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  try {
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, role || 'user']
    );
    console.log(`✅ Signup successful for: ${email}`);
    res.status(201).json({ message: 'Signup successful', user: result.rows[0] });
  } catch (err) {
    console.error('❌ Signup error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

// LOGIN
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Login failed' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Login failed' });

    console.log(`✅ Login successful for: ${email}`);
    res.status(200).json({ message: 'Login successful', user });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
