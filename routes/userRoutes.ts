// routes/userRoutes.ts
import express from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import pool from "../models/db";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "insecure-dev-change-me";

type AuthRole = "user" | "driver" | "admin";

function nonEmptyString(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function normalizeEmail(v: unknown): string {
  const s = nonEmptyString(v).toLowerCase();
  return s;
}

function signToken(user: { id: number; email: string; role: AuthRole; name?: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name ?? undefined },
    JWT_SECRET,
    { expiresIn: "7d", algorithm: "HS256" }
  );
}

/**
 * POST /api/users/signup
 * Idempotent upsert for a basic user.
 * - Creates user with role "user" if new
 * - Updates name if provided (but does NOT change role)
 * Returns: { user, token }
 */
router.post("/signup", async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "email is required" });

  const incomingName = nonEmptyString(req.body?.name);
  const safeName = incomingName || email.split("@")[0];

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, role)
      VALUES ($1, $2, 'user')
      ON CONFLICT (email)
      DO UPDATE SET
        -- keep existing name unless it's null/empty; otherwise accept provided
        name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name)
      RETURNING id, name, email, role
      `,
      [safeName, email]
    );

    const user = rows[0];
    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (e: any) {
    // Friendly message for common cases
    if (e?.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error("Signup failed:", e);
    return res.status(500).json({ error: "Signup failed" });
  }
});

/**
 * POST /api/users/login
 * - If user exists, returns it with token
 * - If not, auto-creates as "user"
 */
router.post("/login", async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "email is required" });

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, role)
      VALUES ($1, $2, 'user')
      ON CONFLICT (email)
      DO UPDATE SET
        -- if DB name is null/empty, set it from first login attempt
        name = COALESCE(users.name, EXCLUDED.name)
      RETURNING id, name, email, role
      `,
      [email.split("@")[0], email]
    );

    const user = rows[0];
    const token = signToken(user);
    return res.json({ user, token });
  } catch (e) {
    console.error("Login failed:", e);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/users/me
 * Requires authOptional (applied in index.ts)
 */
router.get("/me", async (req: Request, res: Response) => {
  const u = req.authUser;
  if (!u?.email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const r = await pool.query(
      "SELECT id, name, email, role FROM users WHERE email=$1 LIMIT 1",
      [u.email]
    );
    if (!r.rowCount) return res.status(404).json({ error: "User not found" });
    return res.json({ user: r.rows[0] });
  } catch (e) {
    console.error("Me failed:", e);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
