/**
 * Analytics routes — authoritative attendance analytics.
 * Role-scoped: students see own, teachers see their classes, admins see all.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { ROLES } from "../lib/constants";
import { sendSuccess, sendNotFound, sendForbidden, sendBadRequest, sendInternalError } from "../lib/responses";
import { getParam } from "../lib/params";
import * as analyticsService from "../services/analytics.service";
import * as studentService from "../services/student.service";
import * as teacherService from "../services/teacher.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(authenticate);

/**
 * GET /analytics/student/:id
 * Student analytics (own only for STUDENT role, any for TEACHER/ADMIN with access).
 */
router.get("/student/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      // Student can only see own analytics
      const student = await studentService.getStudentByUserId(user.id);
      if (!student || student.id !== id) {
        sendForbidden(res, "You can only view your own analytics.");
        return;
      }
    } else if (user.role === ROLES.TEACHER) {
      // Teacher can only see analytics for students in their classes
      const teacher = await teacherService.getTeacherByUserId(user.id);
      if (!teacher) {
        sendNotFound(res, "Teacher profile not found.");
        return;
      }
      const authorized = await studentService.isTeacherAuthorizedForStudent(teacher.id, id);
      if (!authorized) {
        sendForbidden(res, "You are not authorized to view this student's analytics.");
        return;
      }
    }
    // ADMIN can see all

    const analytics = await analyticsService.getStudentAnalytics(id);
    sendSuccess(res, analytics);
  } catch (error) {
    logger.error({ error }, "Student analytics error");
    sendInternalError(res);
  }
});

/**
 * GET /analytics/my
 * Get own analytics (student shortcut).
 */
router.get("/my", authorize(ROLES.STUDENT), async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    const analytics = await analyticsService.getStudentAnalytics(student.id);
    sendSuccess(res, analytics);
  } catch (error) {
    logger.error({ error }, "My analytics error");
    sendInternalError(res);
  }
});

/**
 * GET /analytics/class/:id
 * Class analytics (teacher own class or admin).
 */
router.get("/class/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.TEACHER) {
      const teacher = await teacherService.getTeacherByUserId(user.id);
      if (!teacher) {
        sendNotFound(res, "Teacher profile not found.");
        return;
      }
      const assigned = await teacherService.isTeacherAssignedToClass(teacher.id, id);
      if (!assigned) {
        sendForbidden(res, "You are not assigned to this class.");
        return;
      }
    } else if (user.role === ROLES.STUDENT) {
      sendForbidden(res, "Students cannot view class analytics.");
      return;
    }

    const analytics = await analyticsService.getClassAnalytics(id);
    sendSuccess(res, analytics);
  } catch (error) {
    logger.error({ error }, "Class analytics error");
    sendInternalError(res);
  }
});

/**
 * GET /analytics/session/:id
 * Session analytics summary.
 */
router.get("/session/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const analytics = await analyticsService.getSessionAnalytics(id);
    sendSuccess(res, analytics);
  } catch (error) {
    logger.error({ error }, "Session analytics error");
    sendInternalError(res);
  }
});

/**
 * GET /analytics/recovery/:id
 * Recovery calculation for a student.
 */
router.get("/recovery/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      const student = await studentService.getStudentByUserId(user.id);
      if (!student || student.id !== id) {
        sendForbidden(res, "You can only view your own recovery plan.");
        return;
      }
    }

    const analytics = await analyticsService.getStudentAnalytics(id);
    const threshold = Number(req.query.threshold) || 75;

    const recovery = analyticsService.calculateRecovery(
      analytics.totalAttended,
      analytics.totalConducted,
      threshold
    );

    sendSuccess(res, recovery);
  } catch (error) {
    logger.error({ error }, "Recovery calculation error");
    sendInternalError(res);
  }
});

/**
 * GET /analytics/low-attendance
 * Low attendance alerts (teacher/admin only).
 */
router.get("/low-attendance", authorize(ROLES.ADMIN, ROLES.TEACHER), async (req: Request, res: Response) => {
  try {
    const threshold = Number(req.query.threshold) || 75;
    const classId = req.query.classId as string | undefined;

    const students = await analyticsService.getLowAttendanceStudents(threshold, classId);
    sendSuccess(res, students);
  } catch (error) {
    logger.error({ error }, "Low attendance error");
    sendInternalError(res);
  }
});

export default router;
