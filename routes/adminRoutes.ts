// routes/adminRoutes.ts
import express from "express";
import type { Request, Response } from "express";
import pool from "../models/db";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();
router.use(requireRole(["admin"]));

type AuthRole = "user" | "driver" | "admin";
const ROLES: AuthRole[] = ["user", "driver", "admin"];
const validRole = (r: unknown): r is AuthRole => typeof r === "string" && ROLES.includes(r as AuthRole);

function normEmail(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : "";
}

/** GET /admin/users */
router.get("/users", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, email, role FROM users ORDER BY id ASC");
    return res.json({ users: rows });
  } catch (e) {
    console.error("List users failed:", e);
    return res.status(500).json({ error: "Failed to list users" });
  }
});

/** PATCH /admin/users/:id/role { role } */
router.patch("/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const targetRole = req.body?.role;

  if (!validRole(targetRole)) {
    return res.status(400).json({ error: `role must be one of: ${ROLES.join(", ")}` });
  }

  try {
    const userRes = await pool.query("SELECT id, role FROM users WHERE id=$1", [id]);
    const target = userRes.rows[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    // Safeguard: don’t remove last admin
    if (target.role === "admin" && targetRole !== "admin") {
      const r = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin'");
      if ((r.rows[0]?.count ?? 0) <= 1) {
        return res.status(400).json({ error: "Cannot remove the last admin" });
      }
    }

    await pool.query("UPDATE users SET role=$1 WHERE id=$2", [targetRole, id]);
    return res.json({ message: "Role updated", id: Number(id), role: targetRole });
  } catch (e) {
    console.error("Update role failed:", e);
    return res.status(500).json({ error: "Failed to update role" });
  }
});

/** POST /admin/drivers/approve { email } */
router.post("/drivers/approve", async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "email is required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, role)
       VALUES ($1, $2, 'driver')
       ON CONFLICT (email) DO UPDATE SET role='driver'
       RETURNING id, name, email, role`,
      [email.split("@")[0], email]
    );
    return res.json({ message: "Driver approved", user: rows[0] });
  } catch (e) {
    console.error("Approve driver failed:", e);
    return res.status(500).json({ error: "Failed to approve driver" });
  }
});

/** POST /admin/drivers/revoke { email } */
router.post("/drivers/revoke", async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "email is required" });

  try {
    const u = await pool.query("SELECT id, role FROM users WHERE email=$1", [email]);
    const row = u.rows[0];
    if (!row) return res.status(404).json({ error: "User not found" });
    if (row.role === "admin") {
      return res.status(400).json({ error: "Refusing to revoke admin via this endpoint" });
    }

    const { rows } = await pool.query(
      "UPDATE users SET role='user' WHERE email=$1 RETURNING id, name, email, role",
      [email]
    );
    return res.json({ message: "Driver revoked", user: rows[0] });
  } catch (e) {
    console.error("Revoke driver failed:", e);
    return res.status(500).json({ error: "Failed to revoke driver" });
  }
});

/** GET /admin/driver-apps?status=applied|approved|rejected */
router.get("/driver-apps", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.email, u.name
         FROM driver_applications a
         JOIN users u ON u.id = a.user_id
        ${status ? "WHERE a.status = $1" : ""}
        ORDER BY a.submitted_at DESC`,
      status ? [status] : []
    );
    return res.json({ applications: rows });
  } catch (e) {
    console.error("List apps failed:", e);
    return res.status(500).json({ error: "Failed to list applications" });
  }
});

/** PATCH /admin/driver-apps/:id/decision { action: "approve"|"reject", notes? } */
router.patch("/driver-apps/:id/decision", async (req, res) => {
  const { id } = req.params;
  const action = req.body?.action as "approve" | "reject" | undefined;
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;

  if (!action || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
  }

  try {
    const appRes = await pool.query(
      `SELECT a.*, u.email, u.role
         FROM driver_applications a
         JOIN users u ON u.id = a.user_id
        WHERE a.id=$1`,
      [id]
    );
    const app = appRes.rows[0];
    if (!app) return res.status(404).json({ error: "Application not found" });
    if (app.status !== "applied") {
      return res.status(400).json({ error: "Application has already been reviewed" });
    }

    const reviewerId = req.authUser!.id;

    if (action === "approve") {
      await pool.query("UPDATE users SET role='driver' WHERE id=$1", [app.user_id]);
      const upd = await pool.query(
        `UPDATE driver_applications
            SET status='approved',
                reviewed_at=now(),
                reviewed_by=$1,
                review_notes=$2
          WHERE id=$3
        RETURNING *`,
        [reviewerId, notes ?? null, id]
      );
      return res.json({ message: "Approved", application: upd.rows[0] });
    }

    // reject
    const upd = await pool.query(
      `UPDATE driver_applications
          SET status='rejected',
              reviewed_at=now(),
              reviewed_by=$1,
              review_notes=$2
        WHERE id=$3
      RETURNING *`,
      [reviewerId, notes ?? null, id]
    );
    return res.json({ message: "Rejected", application: upd.rows[0] });
  } catch (e) {
    console.error("Review app failed:", e);
    return res.status(500).json({ error: "Failed to review application" });
  }
});

// ===== Driver applications (admin) =====

// List applications, optional filter ?status=applied|approved|rejected
router.get("/driver-applications", async (req: Request, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  try {
    let q = `SELECT a.*, u.email
             FROM driver_applications a
             JOIN users u ON u.id = a.user_id`;
    const params: any[] = [];
    if (status) {
      q += ` WHERE a.status=$1`;
      params.push(status);
    }
    q += ` ORDER BY a.submitted_at DESC`;
    const { rows } = await pool.query(q, params);
    return res.json({ applications: rows });
  } catch (e) {
    console.error("List applications failed:", e);
    return res.status(500).json({ error: "Failed to list applications" });
  }
});

// Approve
router.post("/driver-applications/:id/approve", async (req: Request, res: Response) => {
  const reviewer = req.authUser!;
  const { id } = req.params;
  const notes = typeof req.body?.reviewNotes === "string" ? req.body.reviewNotes.trim() : null;

  try {
    // lock row
    const appRes = await pool.query("SELECT * FROM driver_applications WHERE id=$1 FOR UPDATE", [id]);
    const app = appRes.rows[0];
    if (!app) return res.status(404).json({ error: "Application not found" });
    if (app.status !== "applied") return res.status(400).json({ error: "Application not pending" });

    // approve + stamp
    const upd = await pool.query(
      `UPDATE driver_applications
         SET status='approved',
             reviewed_at=now(),
             reviewed_by=$2,
             review_notes=COALESCE($3, review_notes)
       WHERE id=$1
       RETURNING *`,
      [id, reviewer.id, notes]
    );

    // make the user a driver
    await pool.query(`UPDATE users SET role='driver' WHERE id=$1`, [app.user_id]);

    return res.json({ message: "Application approved", application: upd.rows[0] });
  } catch (e) {
    console.error("Approve failed:", e);
    return res.status(500).json({ error: "Failed to approve application" });
  }
});

// Reject
router.post("/driver-applications/:id/reject", async (req: Request, res: Response) => {
  const reviewer = req.authUser!;
  const { id } = req.params;
  const notes = typeof req.body?.reviewNotes === "string" ? req.body.reviewNotes.trim() : null;

  try {
    const appRes = await pool.query("SELECT * FROM driver_applications WHERE id=$1 FOR UPDATE", [id]);
    const app = appRes.rows[0];
    if (!app) return res.status(404).json({ error: "Application not found" });
    if (app.status !== "applied") return res.status(400).json({ error: "Application not pending" });

    const upd = await pool.query(
      `UPDATE driver_applications
         SET status='rejected',
             reviewed_at=now(),
             reviewed_by=$2,
             review_notes=COALESCE($3, review_notes)
       WHERE id=$1
       RETURNING *`,
      [id, reviewer.id, notes]
    );

    return res.json({ message: "Application rejected", application: upd.rows[0] });
  } catch (e) {
    console.error("Reject failed:", e);
    return res.status(500).json({ error: "Failed to reject application" });
  }
});

export default router;
