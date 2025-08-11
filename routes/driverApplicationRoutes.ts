// routes/driverApplicationRoutes.ts
import express from "express";
import type { Request, Response } from "express";
import pool from "../models/db";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

// Anyone logged in can submit one *pending* (status = 'applied') application.
router.post("/apply", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  const u = req.authUser!;
  const license = typeof req.body?.licenseNumber === "string" ? req.body.licenseNumber.trim() : null;
  const vehicle  = typeof req.body?.vehicle === "string" ? req.body.vehicle.trim() : null;
  const notes    = typeof req.body?.notes === "string" ? req.body.notes.trim() : null;

  try {
    // ensure they don't already have a pending one
    const pending = await pool.query(
      "SELECT id FROM driver_applications WHERE user_id=$1 AND status='applied' LIMIT 1",
      [u.id]
    );
    if (pending.rowCount) {
      return res.status(409).json({ error: "You already have a pending application" });
    }

    const { rows } = await pool.query(
      `INSERT INTO driver_applications (user_id, license_number, vehicle, notes, status)
       VALUES ($1,$2,$3,$4,'applied')
       RETURNING *`,
      [u.id, license, vehicle, notes]
    );
    return res.status(201).json({ application: rows[0] });
  } catch (e) {
    console.error("Apply failed:", e);
    return res.status(500).json({ error: "Failed to submit application" });
  }
});

// Current user can see their latest application(s)
router.get("/mine", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  const u = req.authUser!;
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.email
       FROM driver_applications a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id=$1
       ORDER BY submitted_at DESC
       LIMIT 5`,
      [u.id]
    );
    return res.json({ applications: rows });
  } catch (e) {
    console.error("Mine failed:", e);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
});

export default router;
