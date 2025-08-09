import { Router } from "express";

export const systemRoutes = Router();

systemRoutes.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    baseUrl: process.env.BASE_URL || "http://localhost:3001",
    version: "1.0.0",
    time: new Date().toISOString(),
  });
});
