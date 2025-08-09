// middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";
import pool from "../models/db";

export type AuthUser = { id: number; email: string; role: "user" | "driver" | "admin" };

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser;
  }
}

export function requireRole(roles: Array<AuthUser["role"]>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = req.headers["x-user-email"] as string | undefined;
    if (!email) return res.status(401).json({ error: "Missing x-user-email" });

    try {
      const { rows } = await pool.query(
        "SELECT id, email, role FROM users WHERE email=$1 LIMIT 1",
        [email]
      );
      const user = rows[0] as AuthUser | undefined;
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!roles.includes(user.role)) return res.status(403).json({ error: "Forbidden" });

      req.authUser = user;
      next();
    } catch (err) {
      console.error("Auth check failed:", err);
      res.status(500).json({ error: "Auth check failed" });
    }
  };
}
