// routes/driverRoutes.ts
import express, { Request, Response } from "express";
import pool from "../models/db";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

// Keep in sync with DB enum ride_status (we use UK spelling 'cancelled')
const ALLOWED = new Set<"accepted" | "enroute" | "arrived" | "completed" | "cancelled">([
  "accepted",
  "enroute",
  "arrived",
  "completed",
  "cancelled",
]);

// Optional transition policy (driver-only)
const allowedTransitions: Record<string, Set<string>> = {
  // we mainly care about assigned -> accepted -> enroute -> arrived -> completed
  assigned: new Set(["accepted", "cancelled"]),
  accepted: new Set(["enroute", "cancelled"]),
  enroute: new Set(["arrived", "cancelled"]),
  arrived: new Set(["completed", "cancelled"]),
  completed: new Set([]),
  cancelled: new Set([]),
};

/**
 * Driver cancels an assigned/in-progress ride; admin may cancel any ride.
 */
router.post("/:rideId/cancel", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const actor = req.authUser!;

  try {
    const { rows } = await pool.query(
      "SELECT id, driver_id, status FROM rides WHERE id=$1",
      [rideId]
    );
    const ride = rows[0];
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    if (actor.role === "driver") {
      if (ride.driver_id !== actor.id) return res.status(403).json({ error: "Not assigned to you" });
      if (ride.status === "completed") return res.status(400).json({ error: "Ride already completed" });
    }

    const upd = await pool.query(
      "UPDATE rides SET status='cancelled'::ride_status WHERE id=$1 RETURNING id, status",
      [rideId]
    );
    return res.json({ message: "Ride cancelled", ride: upd.rows[0] });
  } catch (e) {
    console.error("Cancel failed:", e);
    return res.status(500).json({ error: "Failed to cancel ride" });
  }
});

/**
 * Driver (or admin) updates status. Admin can jump states; driver follows allowedTransitions.
 */
router.patch("/status/:rideId", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const status = String(req.body?.status ?? "").trim().toLowerCase();
  const actor = req.authUser!;

  if (!ALLOWED.has(status as any)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, driver_id, status FROM rides WHERE id=$1",
      [rideId]
    );
    const ride = rows[0];
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    if (actor.role === "driver") {
      if (ride.driver_id !== actor.id) return res.status(403).json({ error: "Not assigned to you" });
      const allowedNext = allowedTransitions[ride.status] ?? new Set<string>();
      if (!allowedNext.has(status)) {
        return res.status(400).json({ error: `Cannot change status from '${ride.status}' to '${status}'` });
      }
    }

    const upd = await pool.query(
      "UPDATE rides SET status=$1::ride_status WHERE id=$2 RETURNING id, user_id, driver_id, origin, destination, status, requested_at, shared_with_email",
      [status, rideId]
    );
    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("Update status failed:", err);
    return res.status(500).json({ error: "Failed to update ride status" });
  }
});

export default router;
