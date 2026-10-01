/**
 * Student routes — extremely restricted, only own data.
 * Every route enforces STUDENT role + data ownership.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { ROLES } from "../lib/constants";
import { sendSuccess, sendNotFound, sendForbidden, sendInternalError } from "../lib/responses";
import { getParam } from "../lib/params";
import * as studentService from "../services/student.service";
import * as attendanceService from "../services/attendance.service";
import * as enrollmentService from "../services/enrollment.service";
import * as notificationService from "../services/notification.service";
import * as sessionService from "../services/session.service";
import * as recheckService from "../services/recheck.service";
import { sendBadRequest } from "../lib/responses";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ALL student routes require STUDENT role
router.use(authenticate, authorize(ROLES.STUDENT));

/**
 * GET /student/profile
 * Get the student's own profile.
 */
router.get("/profile", async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    sendSuccess(res, student);
  } catch (error) {
    logger.error({ error }, "Student get profile error");
    sendInternalError(res);
  }
});

/**
 * GET /student/attendance
 * Get the student's own attendance history only.
 */
router.get("/attendance", async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    const records = await attendanceService.getAttendanceForStudent(student.id);
    sendSuccess(res, records);
  } catch (error) {
    logger.error({ error }, "Student get attendance error");
    sendInternalError(res);
  }
});

/**
 * GET /student/enrollments
 * Get the student's own enrolled classes.
 */
router.get("/enrollments", async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    const enrollments = await enrollmentService.getEnrollmentsForStudent(student.id);
    sendSuccess(res, enrollments);
  } catch (error) {
    logger.error({ error }, "Student get enrollments error");
    sendInternalError(res);
  }
});

/**
 * GET /student/notifications
 * Get the student's own notifications only.
 */
router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const notifications = await notificationService.getNotificationsForUser(req.user!.id);
    sendSuccess(res, notifications);
  } catch (error) {
    logger.error({ error }, "Student get notifications error");
    sendInternalError(res);
  }
});

/**
 * PUT /student/notifications/:id/read
 * Mark a notification as read — ownership enforced.
 */
router.put("/notifications/:id/read", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    await notificationService.markNotificationRead(id, req.user!.id);
    sendSuccess(res, null, "Notification marked as read.");
  } catch (error) {
    logger.error({ error }, "Student mark notification read error");
    sendInternalError(res);
  }
});

/**
 * PUT /student/notifications/read-all
 * Mark all own notifications as read.
 */
router.put("/notifications/read-all", async (req: Request, res: Response) => {
  try {
    await notificationService.markAllNotificationsRead(req.user!.id);
    sendSuccess(res, null, "All notifications marked as read.");
  } catch (error) {
    logger.error({ error }, "Student mark all notifications read error");
    sendInternalError(res);
  }
});

/**
 * GET /student/active-session
 * Find active lecture session for the student's class.
 */
router.get("/active-session", async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student || !student.classId) {
      sendSuccess(res, null, "No active class found.");
      return;
    }

    const session = await sessionService.getActiveSessionForClass(student.classId);
    if (!session) {
      sendSuccess(res, null, "No active session.");
      return;
    }

    sendSuccess(res, {
      id: session.id,
      classId: session.classId,
      status: session.status,
      startTime: session.startTime,
    });
  } catch (error) {
    logger.error({ error }, "Student get active session error");
    sendInternalError(res);
  }
});

/**
 * GET /student/rechecks
 * Get pending re-checks for the student.
 */
router.get("/rechecks", async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    const rechecks = await recheckService.getPendingRechecksForStudent(student.id);
    sendSuccess(res, rechecks);
  } catch (error) {
    logger.error({ error }, "Student get rechecks error");
    sendInternalError(res);
  }
});

/**
 * POST /student/rechecks/:id/complete
 * Complete a spot re-check.
 */
router.post("/rechecks/:id/complete", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    const result = await recheckService.completeRecheck(id, student.id);
    if (result.success) {
      sendSuccess(res, null, "Re-check completed successfully.");
    } else {
      sendBadRequest(res, result.error ?? "Failed to complete re-check.");
    }
  } catch (error) {
    logger.error({ error }, "Student complete recheck error");
    sendInternalError(res);
  }
});

export default router;
