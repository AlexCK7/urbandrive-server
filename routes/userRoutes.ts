import express, { Request, Response } from "express";
import pool from "../models/db";

const router = express.Router();

/**
 * Create user (idempotent)
 * - 201 when created
 * - 200 when user already exists (returns existing)
 * - 400 on bad input
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body as {
      name?: string;
      email?: string;
      role?: "user" | "driver" | "admin";
    };

    if (!name || !email) {
      return res.status(400).json({ error: "Missing name or email" });
    }

    // Default role
    const safeRole: "user" | "driver" | "admin" = (role as any) ?? "user";

    // If exists, return existing as success (idempotent)
    const exists = await pool.query("SELECT id, name, email, role FROM users WHERE email=$1", [email]);
    if (exists.rowCount && exists.rows[0]) {
      return res.status(200).json({ ...exists.rows[0], existed: true });
    }

    // Create user
    const created = await pool.query(
      `INSERT INTO users (name, email, role)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role`,
      [name, email, safeRole]
    );

    return res.status(201).json(created.rows[0]);
  } catch (err: any) {
    // If unique constraint somehow races, treat it as success
    if (err?.code === "23505") {
      const email = (req.body && req.body.email) || "";
      const row = await pool.query("SELECT id, name, email, role FROM users WHERE email=$1", [email]);
      return res.status(200).json({ ...row.rows[0], existed: true });
    }
    console.error("Create user failed:", err);
    return res.status(500).json({ error: "Failed to create user" });
  }
});

/**
 * Basic lookup (useful for debugging)
 * GET /api/users?email=foo@bar.com
 */
router.get("/", async (req: Request, res: Response) => {
  const email = (req.query.email as string) || "";
  if (!email) return res.status(400).json({ error: "Missing email query param" });

  const row = await pool.query("SELECT id, name, email, role FROM users WHERE email=$1", [email]);
  if (!row.rowCount) return res.status(404).json({ error: "Not found" });
  return res.json(row.rows[0]);
});

export default router;
