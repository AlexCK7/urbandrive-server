// routes/rideRoutes.ts
import express, { Request, Response } from "express";
import pool from "../models/db";
import { requireRole } from "../middleware/requireRole";

declare global {
  namespace Express {
    interface Request {
      authUser?: { id: number; email: string; role: "user" | "driver" | "admin" };
    }
  }
}

const router = express.Router();

/**
 * POST /api/rides
 * Create a ride (any logged-in user)
 * Body: { origin, destination, sharedWithEmail? }
 */
router.post("/", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  const { origin, destination, sharedWithEmail } = req.body || {};
  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing required fields: origin, destination" });
  }

  try {
    const userId = req.authUser!.id;
    const { rows } = await pool.query(
      "INSERT INTO rides (user_id, origin, destination, shared_with_email) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, origin, destination, sharedWithEmail ? String(sharedWithEmail).toLowerCase() : null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Ride creation failed:", err);
    return res.status(500).json({ error: "Ride creation failed" });
  }
});

/**
 * GET /api/rides
 * Admin: list all rides
 */
router.get("/", requireRole(["admin"]), async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query("SELECT * FROM rides ORDER BY requested_at DESC");
    return res.json({ rides: rows });
  } catch (err) {
    console.error("Error fetching rides:", err);
    return res.status(500).json({ error: "Failed to fetch rides" });
  }
});

/**
 * GET /api/rides/user
 * Current user’s rides
 */
router.get("/user", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.id;
    const { rows } = await pool.query(
      "SELECT * FROM rides WHERE user_id = $1 ORDER BY requested_at DESC",
      [userId]
    );
    return res.json({ rides: rows });
  } catch (err) {
    console.error("Error fetching user rides:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/rides/driver
 * Driver/admin: rides assigned to the current driver
 */
router.get("/driver", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  try {
    const driverId = req.authUser!.id;
    const { rows } = await pool.query(
      "SELECT * FROM rides WHERE driver_id = $1 ORDER BY requested_at DESC",
      [driverId]
    );
    return res.json({ rides: rows });
  } catch (err) {
    console.error("Error fetching driver rides:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /api/rides/:id/assign
 * Admin: assign a driver to a ride
 * Body: { driverEmail }
 */
router.patch("/:id/assign", requireRole(["admin"]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { driverEmail } = req.body || {};
  if (!driverEmail) return res.status(400).json({ error: "Missing driverEmail" });

  try {
    const normalized = String(driverEmail).toLowerCase();
    const findDriver = await pool.query(
      "SELECT id FROM users WHERE email=$1 AND role='driver'",
      [normalized]
    );
    const driverId = findDriver.rows[0]?.id;
    if (!driverId) return res.status(404).json({ error: "Driver not found" });

    await pool.query("UPDATE rides SET driver_id=$1, status='assigned' WHERE id=$2", [driverId, id]);
    return res.json({ message: "Driver assigned" });
  } catch (err) {
    console.error("Error assigning ride:", err);
    return res.status(500).json({ error: "Failed to assign driver" });
  }
});

/**
 * PATCH /api/rides/:id/share
 * Owner OR admin can share a ride with a friend
 * Body: { friendEmail }
 */
router.patch("/:id/share", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { friendEmail } = req.body || {};
  if (!friendEmail) return res.status(400).json({ error: "Missing friendEmail" });

  try {
    const { rows } = await pool.query("SELECT user_id FROM rides WHERE id=$1", [id]);
    const ownerId = rows[0]?.user_id;
    if (!ownerId) return res.status(404).json({ error: "Ride not found" });

    const isOwner = ownerId === req.authUser!.id;
    const isAdmin = req.authUser!.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You cannot share a ride you do not own" });
    }

    await pool.query("UPDATE rides SET shared_with_email=$1 WHERE id=$2", [
      String(friendEmail).toLowerCase(),
      id,
    ]);
    return res.json({ message: "Ride shared successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error while sharing ride" });
  }
});

/**
 * PATCH /api/rides/:id/complete
 * Driver assigned to the ride OR admin can complete it
 */
router.patch("/:id/complete", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (req.authUser!.role === "driver") {
      const { rows } = await pool.query("SELECT driver_id FROM rides WHERE id=$1", [id]);
      const assigned = rows[0]?.driver_id;
      if (!assigned) return res.status(404).json({ error: "Ride not found" });
      if (assigned !== req.authUser!.id) {
        return res.status(403).json({ error: "Not assigned to this ride" });
      }
    }

    const updated = await pool.query("UPDATE rides SET status='completed' WHERE id=$1 RETURNING *", [id]);
    if (!updated.rows[0]) return res.status(404).json({ error: "Ride not found" });
    return res.json({ message: "Ride marked completed", ride: updated.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to complete ride" });
  }
});

export default router;
