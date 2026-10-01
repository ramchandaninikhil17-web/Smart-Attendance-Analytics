import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import teacherRouter from "./teacher";
import studentRouter from "./student";
import verifyRouter from "./verify";
import analyticsRouter from "./analytics";
import reportsRouter from "./reports";
import settingsRouter from "./settings";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);

// Authentication
router.use("/auth", authRouter);

// Role-based API namespaces
router.use("/admin", adminRouter);
router.use("/teacher", teacherRouter);
router.use("/student", studentRouter);

// Verification pipeline (Student attendance submission + WebAuthn)
router.use("/verify", verifyRouter);

// Authoritative Analytics
router.use("/analytics", analyticsRouter);

// Authoritative Reports & CSV Exports
router.use("/reports", reportsRouter);

// Shared authenticated resources
router.use("/settings", settingsRouter);
router.use("/notifications", notificationsRouter);

export default router;
