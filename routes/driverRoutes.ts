// routes/driverRoutes.ts
import express, { Request, Response } from "express";
import pool from "../models/db";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

/**
 * Driver accepts a ride assigned to them (or admin can accept on behalf).
 * If driver: they can only accept a ride already assigned to them (status='assigned').
 * If admin: can force accept for any assigned ride.
 */
router.patch("/accept/:rideId", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const actor = req.authUser!;

  try {
    // If driver, ensure this ride is assigned to them
    if (actor.role === "driver") {
      const { rows } = await pool.query("SELECT driver_id, status FROM rides WHERE id=$1", [rideId]);
      const ride = rows[0];
      if (!ride) return res.status(404).json({ error: "Ride not found" });
      if (ride.driver_id !== actor.id) return res.status(403).json({ error: "Not assigned to you" });
      if (ride.status !== "assigned") return res.status(400).json({ error: "Ride not in 'assigned' state" });
    }

    const result = await pool.query(
      "UPDATE rides SET status='accepted' WHERE id=$1 RETURNING *",
      [rideId]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to accept ride" });
  }
});

/**
 * Driver updates ride status (limited set) for rides assigned to them.
 * Admin can update any ride.
 */
router.patch("/status/:rideId", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const { status } = req.body as { status?: string };
  const actor = req.authUser!;

  const ALLOWED: Record<string, true> = {
    accepted: true,
    enroute: true,
    arrived: true,
    completed: true,
    canceled: true,
  };

  if (!status || !ALLOWED[status]) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    if (actor.role === "driver") {
      const { rows } = await pool.query("SELECT driver_id FROM rides WHERE id=$1", [rideId]);
      const ride = rows[0];
      if (!ride) return res.status(404).json({ error: "Ride not found" });
      if (ride.driver_id !== actor.id) return res.status(403).json({ error: "Not assigned to you" });
    }

    const result = await pool.query(
      "UPDATE rides SET status=$1 WHERE id=$2 RETURNING *",
      [status, rideId]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update ride status" });
  }
});

export default router;
