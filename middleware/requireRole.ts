// middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";

export function requireRole(allowed: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = req.authUser;
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    if (!allowed.includes(u.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
