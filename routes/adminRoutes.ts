// routes/adminRoutes.ts
import express, { Request, Response } from "express";
import pool from "../models/db";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

// All admin routes require admin
router.use(requireRole(["admin"]));

// GET /admin/drivers — list drivers
router.get("/drivers", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'driver' ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// PUT /admin/promote/:email — promote a user to admin
router.put("/promote/:email", async (req: Request, res: Response) => {
  const { email } = req.params;
  try {
    const { rowCount } = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1",
      [email]
    );
    if (rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: `${email} promoted to admin` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to promote user" });
  }
});

// DELETE /admin/clear-users — delete non-admin users
router.delete("/clear-users", async (_req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM users WHERE role != 'admin'");
    res.json({ message: "Non-admin users deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete users" });
  }
});

// DELETE /admin/clear-rides — delete all rides
router.delete("/clear-rides", async (_req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM rides");
    res.json({ message: "All rides deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete rides" });
  }
});

// (Optional) GET /admin/stats — quick dashboard counters
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [{ rows: r1 }, { rows: r2 }, { rows: r3 }] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total_users FROM users"),
      pool.query("SELECT COUNT(*)::int AS total_rides FROM rides"),
      pool.query("SELECT COUNT(*)::int AS completed FROM rides WHERE status='completed'"),
    ]);
    res.json({ ...r1[0], ...r2[0], ...r3[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;
