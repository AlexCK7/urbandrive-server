// routes/rideRoutes.ts
import express, { Request, Response } from "express";
import pool from "../models/db";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

// Book a new ride (any logged in user)
router.post("/", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  const email = req.authUser!.email;
  const { origin, destination, sharedWithEmail } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const userRes = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    const userId = userRes.rows[0]?.id;
    if (!userId) return res.status(404).json({ error: "User not found" });

    const result = await pool.query(
      "INSERT INTO rides (user_id, origin, destination, shared_with_email) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, origin, destination, sharedWithEmail || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Ride creation failed:", err);
    res.status(500).json({ error: "Ride creation failed" });
  }
});

// Get all rides (admin only)
router.get("/", requireRole(["admin"]), async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM rides ORDER BY requested_at DESC");
    res.json({ rides: result.rows });
  } catch (err) {
    console.error("Error fetching rides:", err);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// Get rides for current user
router.get("/user", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.id;
    const rideResult = await pool.query("SELECT * FROM rides WHERE user_id = $1 ORDER BY requested_at DESC", [userId]);
    res.json({ rides: rideResult.rows });
  } catch (err) {
    console.error("Error fetching user rides:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get rides assigned to the current driver (driver/admin)
router.get("/driver", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  try {
    const driverId = req.authUser!.id;
    const ridesResult = await pool.query("SELECT * FROM rides WHERE driver_id = $1 ORDER BY requested_at DESC", [driverId]);
    res.json({ rides: ridesResult.rows });
  } catch (err) {
    console.error("Error fetching driver rides:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Assign driver (admin only)
router.patch("/:id/assign", requireRole(["admin"]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { driverEmail } = req.body;
  if (!driverEmail) return res.status(400).json({ error: "Missing driverEmail" });

  try {
    const driverRes = await pool.query("SELECT id FROM users WHERE email=$1 AND role='driver'", [driverEmail]);
    const driverId = driverRes.rows[0]?.id;
    if (!driverId) return res.status(404).json({ error: "Driver not found" });

    await pool.query("UPDATE rides SET driver_id=$1, status='assigned' WHERE id=$2", [driverId, id]);
    res.json({ message: "Driver assigned" });
  } catch (err) {
    console.error("Error assigning ride:", err);
    res.status(500).json({ error: "Failed to assign driver" });
  }
});

// Share ride with friend (owner OR admin)
router.patch("/:id/share", requireRole(["user", "driver", "admin"]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { friendEmail } = req.body;
  if (!friendEmail) return res.status(400).json({ error: "Missing friendEmail" });

  try {
    // Only owner or admin can share
    const owner = await pool.query(
      "SELECT user_id FROM rides WHERE id=$1",
      [id]
    );
    const userId = owner.rows[0]?.user_id;
    const isOwner = userId === req.authUser!.id;
    const isAdmin = req.authUser!.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You cannot share a ride you do not own" });
    }

    await pool.query("UPDATE rides SET shared_with_email=$1 WHERE id=$2", [friendEmail, id]);
    res.json({ message: "Ride shared successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error while sharing ride" });
  }
});

// Mark as completed (driver must be assigned OR admin)
router.patch("/:id/complete", requireRole(["driver", "admin"]), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // If driver, ensure this ride is assigned to them
    if (req.authUser!.role === "driver") {
      const { rows } = await pool.query("SELECT driver_id FROM rides WHERE id=$1", [id]);
      if (!rows[0] || rows[0].driver_id !== req.authUser!.id) {
        return res.status(403).json({ error: "Not assigned to this ride" });
      }
    }

    const { rows } = await pool.query(
      "UPDATE rides SET status='completed' WHERE id=$1 RETURNING *",
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Ride not found" });
    res.json({ message: "Ride marked completed", ride: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to complete ride" });
  }
});

export default router;
