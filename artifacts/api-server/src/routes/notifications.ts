/**
 * Notification routes — user-scoped notifications.
 * Each user only sees their own notifications.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { sendSuccess, sendInternalError } from "../lib/responses";
import { getParam } from "../lib/params";
import * as notificationService from "../services/notification.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * GET /notifications
 * Get current user's notifications only.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const notifications = await notificationService.getNotificationsForUser(req.user!.id);
    sendSuccess(res, notifications);
  } catch (error) {
    logger.error({ error }, "Get notifications error");
    sendInternalError(res);
  }
});

/**
 * PUT /notifications/:id/read
 * Mark a notification as read — ownership enforced in service.
 */
router.put("/:id/read", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    await notificationService.markNotificationRead(id, req.user!.id);
    sendSuccess(res, null, "Notification marked as read.");
  } catch (error) {
    logger.error({ error }, "Mark notification read error");
    sendInternalError(res);
  }
});

/**
 * PUT /notifications/read-all
 * Mark all own notifications as read.
 */
router.put("/read-all", async (req: Request, res: Response) => {
  try {
    await notificationService.markAllNotificationsRead(req.user!.id);
    sendSuccess(res, null, "All notifications marked as read.");
  } catch (error) {
    logger.error({ error }, "Mark all notifications read error");
    sendInternalError(res);
  }
});

export default router;
