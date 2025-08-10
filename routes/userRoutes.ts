// routes/userRoutes.ts
import express, { Request, Response } from "express";
import pool from "../models/db";

const router = express.Router();

/**
 * POST /api/users/signup
 * Minimal signup: creates (or upserts) a user with name, email, role.
 * Password is ignored (no password column in the DB). Safe for demo/dev.
 */
router.post("/signup", async (req: Request, res: Response) => {
  const { name, email, role } = req.body as {
    name?: string;
    email?: string;
    role?: "user" | "driver" | "admin";
  };

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const safeName = name && name.trim().length > 0 ? name.trim() : email.split("@")[0];
  const safeRole = (role as string) || "user";

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, users.name),
        role = COALESCE(EXCLUDED.role, users.role)
      RETURNING id, name, email, role
      `,
      [safeName, email, safeRole]
    );

    return res.status(201).json({ user: rows[0] });
  } catch (e) {
    console.error("Signup failed:", e);
    return res.status(500).json({ error: "Signup failed" });
  }
});

/**
 * POST /api/users/login
 * Minimal login: if email exists return it; otherwise create a basic user.
 * Password is ignored to match current schema.
 */
router.post("/login", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string; password?: string };

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const found = await pool.query(
      "SELECT id, name, email, role FROM users WHERE email=$1 LIMIT 1",
      [email]
    );

    if (found.rowCount && found.rows[0]) {
      return res.json({ user: found.rows[0] });
    }

    const { rows } = await pool.query(
      "INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING id, name, email, role",
      [email.split("@")[0], email, "user"]
    );

    return res.json({ user: rows[0] });
  } catch (e) {
    console.error("Login failed:", e);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/users/me
 * Helper for debugging from the app. Uses x-user-email.
 */
router.get("/me", async (req: Request, res: Response) => {
  const email = req.headers["x-user-email"] as string | undefined;
  if (!email) return res.status(401).json({ error: "x-user-email header required" });

  try {
    const r = await pool.query(
      "SELECT id, name, email, role FROM users WHERE email=$1 LIMIT 1",
      [email]
    );
    if (!r.rowCount) return res.status(404).json({ error: "User not found" });
    res.json({ user: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
