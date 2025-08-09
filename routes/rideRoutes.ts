import express, { Request, Response } from "express";
import pool from "../models/db";

const router = express.Router();

// Book a new ride
router.post("/", async (req: Request, res: Response) => {
  const email = req.headers["x-user-email"] as string;
  const { origin, destination, sharedWithEmail } = req.body;
  if (!email || !origin || !destination) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const userRes = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    const userId = userRes.rows[0]?.id;
    if (!userId) return res.status(404).json({ error: "User not found" });

    const result = await pool.query(
      "INSERT INTO rides (user_id, origin, destination, shared_with_email) VALUES ($1,$2,$3,$4) RETURNING *",
      [userId, origin, destination, sharedWithEmail || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Ride creation failed:", err);
    res.status(500).json({ error: "Ride creation failed" });
  }
});

// Get all rides (admin only)
router.get("/", async (req: Request, res: Response) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) return res.status(400).json({ error: "Missing email header" });

  const userResult = await pool.query("SELECT role FROM users WHERE email=$1", [email]);
  if (userResult.rows[0]?.role !== "admin") {
    return res.status(403).json({ error: "Only admins can view all rides" });
  }

  try {
    const result = await pool.query("SELECT * FROM rides ORDER BY requested_at DESC");
    res.json({ rides: result.rows });
  } catch (err) {
    console.error("Error fetching rides:", err);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// Get rides for a specific user
router.get("/user", async (req: Request, res: Response) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) return res.status(400).json({ error: "Missing email header" });

  try {
    const userResult = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const userId = userResult.rows[0].id;
    const rideResult = await pool.query("SELECT * FROM rides WHERE user_id=$1 ORDER BY requested_at DESC", [userId]);
    res.json({ rides: rideResult.rows });
  } catch (err) {
    console.error("Error fetching user rides:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get rides for a driver (assigned)
router.get("/driver", async (req: Request, res: Response) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) return res.status(400).json({ error: "Missing email header" });

  try {
    const driverResult = await pool.query("SELECT id FROM users WHERE email=$1 AND role='driver'", [email]);
    if (driverResult.rows.length === 0) return res.status(403).json({ error: "Driver not found" });

    const driverId = driverResult.rows[0].id;
    const ridesResult = await pool.query("SELECT * FROM rides WHERE driver_id=$1 ORDER BY requested_at DESC", [driverId]);
    res.json({ rides: ridesResult.rows });
  } catch (err) {
    console.error("Error fetching driver rides:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Assign driver to ride (admin)
router.patch("/:id/assign", async (req: Request, res: Response) => {
  const adminEmail = req.headers["x-user-email"] as string;
  const { id } = req.params;
  const { driverEmail } = req.body;
  if (!adminEmail || !driverEmail) return res.status(400).json({ error: "Missing fields" });

  try {
    const adminCheck = await pool.query("SELECT role FROM users WHERE email=$1", [adminEmail]);
    if (adminCheck.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Only admins can assign rides" });
    }

    const driverCheck = await pool.query("SELECT id FROM users WHERE email=$1 AND role='driver'", [driverEmail]);
    const driverId = driverCheck.rows[0]?.id;
    if (!driverId) return res.status(404).json({ error: "Driver not found" });

    await pool.query("UPDATE rides SET driver_id=$1, status='assigned' WHERE id=$2", [driverId, id]);
    res.json({ message: "Driver assigned" });
  } catch (err) {
    console.error("Error assigning ride:", err);
    res.status(500).json({ error: "Failed to assign driver" });
  }
});

// Share ride with friend (only the owner can share)
router.patch("/:id/share", async (req: Request, res: Response) => {
  const riderEmail = req.headers["x-user-email"] as string;
  const { id } = req.params;
  const { friendEmail } = req.body;
  if (!riderEmail || !friendEmail) return res.status(400).json({ error: "Missing fields" });

  try {
    const riderCheck = await pool.query(
      "SELECT users.id, users.email FROM rides JOIN users ON rides.user_id=users.id WHERE rides.id=$1",
      [id]
    );
    if (!riderCheck.rows[0] || riderCheck.rows[0].email !== riderEmail) {
      return res.status(403).json({ error: "You cannot share a ride you do not own" });
    }
    await pool.query("UPDATE rides SET shared_with_email=$1 WHERE id=$2", [friendEmail, id]);
    res.json({ message: "Ride shared successfully" });
  } catch (err) {
    console.error("Error sharing ride:", err);
    res.status(500).json({ error: "Failed to share ride" });
  }
});

// Mark as completed (driver or admin)
router.patch("/:id/complete", async (req: Request, res: Response) => {
  const email = req.headers["x-user-email"] as string;
  const { id } = req.params;
  if (!email) return res.status(400).json({ error: "Missing email header" });

  try {
    const who = await pool.query("SELECT id, role FROM users WHERE email=$1", [email]);
    const role = who.rows[0]?.role as "driver" | "admin" | undefined;
    if (!(role === "driver" || role === "admin")) {
      return res.status(403).json({ error: "Only drivers or admins can complete rides" });
    }
    const result = await pool.query("UPDATE rides SET status='completed' WHERE id=$1 RETURNING *", [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Ride not found" });
    res.json({ message: "Ride marked completed", ride: result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to complete ride" });
  }
});

export default router;
