import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../models/db";

const JWT_SECRET = process.env.JWT_SECRET || "insecure-dev-change-me";
const isProd = process.env.NODE_ENV === "production";

type Role = "user" | "driver" | "admin";
interface DecodedToken {
  id: number;
  email: string;
  role: Role;
  name?: string;
}

export const authOptional = async (req: Request, _res: Response, next: NextFunction) => {
  const auth = req.headers.authorization ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);

  if (match) {
    try {
      const decoded = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"] }) as DecodedToken;
      if (decoded?.email && decoded?.id) {
        req.authUser = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
        };
        return next();
      }
    } catch {
      // ignore; fall back if allowed
    }
  }

  // Dev-only header fallback for local tools
  if (!isProd) {
    const devEmail = String(req.headers["x-user-email"] || "").trim().toLowerCase();
    if (devEmail) {
      const { rows } = await pool.query(
        "SELECT id, email, role, name FROM users WHERE email=$1",
        [devEmail]
      );
      if (rows[0]) {
        req.authUser = {
          id: rows[0].id,
          email: rows[0].email,
          role: rows[0].role,
          name: rows[0].name ?? undefined,
        };
      }
    }
  }

  next();
};

export default authOptional;
