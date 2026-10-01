import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (_req, res) => {
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    const latencyMs = Date.now() - start;
    res.json({
      status: "ok",
      database: "connected",
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      message: error?.message || "Failed to reach database",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
