/**
 * Teacher routes — scoped to teacher's own classes/subjects/sessions.
 * Every route enforces ownership + TEACHER role.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { ROLES } from "../lib/constants";
import { sendSuccess, sendBadRequest, sendForbidden, sendNotFound, sendInternalError } from "../lib/responses";
import { getParam } from "../lib/params";
import * as teacherService from "../services/teacher.service";
import * as studentService from "../services/student.service";
import * as classService from "../services/class.service";
import * as sessionService from "../services/session.service";
import * as attendanceService from "../services/attendance.service";
import * as qrService from "../services/qr.service";
import * as securityCodeService from "../services/security-code.service";
import * as realtimeService from "../services/realtime.service";
import * as recheckService from "../services/recheck.service";
import * as correctionService from "../services/correction.service";
import { createAuditLog } from "../services/audit.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ALL teacher routes require TEACHER role
router.use(authenticate, authorize(ROLES.TEACHER));

/**
 * GET /teacher/profile
 * Get the teacher's own profile + assignments.
 */
router.get("/profile", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const assignments = await teacherService.getTeacherAssignments(teacher.id);

    sendSuccess(res, { ...teacher, assignments });
  } catch (error) {
    logger.error({ error }, "Teacher get profile error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/classes
 * Get only the teacher's assigned classes.
 */
router.get("/classes", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const classes = await classService.getClassesForTeacher(teacher.id);
    sendSuccess(res, classes);
  } catch (error) {
    logger.error({ error }, "Teacher get classes error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/students
 * Get students enrolled in teacher's assigned classes only.
 */
router.get("/students", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const students = await studentService.getStudentsForTeacher(teacher.id);
    sendSuccess(res, students);
  } catch (error) {
    logger.error({ error }, "Teacher get students error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/students/:id
 * Get a specific student — ONLY if in teacher's scope.
 */
router.get("/students/:id", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }
    const id = getParam(req, "id");

    // Ownership check
    const authorized = await studentService.isTeacherAuthorizedForStudent(teacher.id, id);
    if (!authorized) {
      sendForbidden(res, "You are not authorized to view this student.");
      return;
    }

    const student = await studentService.getStudentById(id);
    if (!student) {
      sendNotFound(res, "Student not found.");
      return;
    }

    sendSuccess(res, student);
  } catch (error) {
    logger.error({ error }, "Teacher get student error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions
 * Get only the teacher's own sessions.
 */
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const sessions = await sessionService.getSessionsForTeacher(teacher.id);
    sendSuccess(res, sessions);
  } catch (error) {
    logger.error({ error }, "Teacher get sessions error");
    sendInternalError(res);
  }
});

/**
 * POST /teacher/sessions
 * Start a new lecture session — only for assigned class.
 */
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const { classId, subjectId } = req.body;
    if (!classId) {
      sendBadRequest(res, "classId is required.");
      return;
    }

    // Ownership check — teacher must be assigned to this class
    const assigned = await teacherService.isTeacherAssignedToClass(teacher.id, classId);
    if (!assigned) {
      sendForbidden(res, "You are not assigned to this class.");
      return;
    }

    const result = await sessionService.createSession({
      teacherId: teacher.id,
      classId,
      subjectId,
    });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Started lecture session for class ${classId}`,
      targetType: "session",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Session started.", 201);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "NOT_ASSIGNED") {
      sendForbidden(res, "You are not assigned to teach this class.");
      return;
    }
    logger.error({ error }, "Teacher create session error");
    sendInternalError(res);
  }
});

/**
 * PUT /teacher/sessions/:id/end
 * End a session — only if owned by this teacher.
 */
router.put("/sessions/:id/end", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }
    const id = getParam(req, "id");

    // Ownership check
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only end your own sessions.");
      return;
    }

    const result = await sessionService.transitionSession(id, "ENDED", teacher.id);

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Ended session ${id}`,
      targetType: "session",
      targetId: id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Session ended.");
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "INVALID_TRANSITION") {
      sendBadRequest(res, "Session cannot be ended in its current state.");
      return;
    }
    if (err.message === "SESSION_NOT_FOUND") {
      sendNotFound(res, "Session not found.");
      return;
    }
    logger.error({ error }, "Teacher end session error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions/:id/attendance
 * Get attendance for a session — only if owned by this teacher.
 */
router.get("/sessions/:id/attendance", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only view attendance for your own sessions.");
      return;
    }

    const records = await attendanceService.getAttendanceForSession(id);
    sendSuccess(res, records);
  } catch (error) {
    logger.error({ error }, "Teacher get session attendance error");
    sendInternalError(res);
  }
});

/**
 * POST /teacher/sessions/:id/attendance
 * Mark attendance for a student in teacher's session.
 */
router.post("/sessions/:id/attendance", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only mark attendance for your own sessions.");
      return;
    }

    const session = await sessionService.getSessionById(id);
    if (!session) {
      sendNotFound(res, "Session not found.");
      return;
    }

    const { studentId, status } = req.body;
    if (!studentId || !status) {
      sendBadRequest(res, "studentId and status are required.");
      return;
    }

    // Verify student is in teacher's scope
    const authorized = await studentService.isTeacherAuthorizedForStudent(teacher.id, studentId);
    if (!authorized) {
      sendForbidden(res, "This student is not in your teaching scope.");
      return;
    }

    const result = await attendanceService.markAttendance({
      sessionId: id,
      studentId,
      classId: session.classId,
      subjectId: session.subjectId ?? undefined,
      status,
      verificationMethod: "Manual Override",
      markedBy: req.user!.id,
    });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Marked attendance for student ${studentId} as ${status} in session ${id}`,
      targetType: "attendance",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Attendance marked.");
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "SESSION_NOT_ACTIVE") {
      sendBadRequest(res, "Session is not active. Cannot mark attendance.");
      return;
    }
    if (err.message === "STUDENT_NOT_ENROLLED") {
      sendBadRequest(res, "Student is not enrolled in this class.");
      return;
    }
    logger.error({ error }, "Teacher mark attendance error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions/:id
 * Get details of a single session owned by teacher.
 */
router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only view your own sessions.");
      return;
    }

    const session = await sessionService.getSessionById(id);
    if (!session) {
      sendNotFound(res, "Session not found.");
      return;
    }

    sendSuccess(res, session);
  } catch (error) {
    logger.error({ error }, "Teacher get session details error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions/:id/qr
 * Generate or get the current active rotating QR token for teacher projection.
 * Server rotates token every 15s.
 */
router.get("/sessions/:id/qr", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only access QR codes for your own sessions.");
      return;
    }

    const active = await sessionService.isSessionActive(id);
    if (!active) {
      sendBadRequest(res, "Session is not active. Cannot generate QR code.");
      return;
    }

    const qrData = await qrService.getOrCreateSessionQR(id);

    sendSuccess(res, {
      sessionId: id,
      token: qrData.token,
      expiresAt: qrData.expiresAt.toISOString(),
      generatedAt: qrData.generatedAt.toISOString(),
      rotationIntervalMs: qrService.getQRRotationInterval(),
    });
  } catch (error) {
    logger.error({ error }, "Teacher get QR error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions/:id/security-code
 * Get the current rotating 6-char security code for the active session.
 */
router.get("/sessions/:id/security-code", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only access security codes for your own sessions.");
      return;
    }

    const active = await sessionService.isSessionActive(id);
    if (!active) {
      sendBadRequest(res, "Session is not active. Cannot generate security code.");
      return;
    }

    const codeData = securityCodeService.getCurrentSecurityCode(id);

    sendSuccess(res, {
      sessionId: id,
      code: codeData.code,
      expiresAt: codeData.expiresAt.toISOString(),
      generatedAt: codeData.generatedAt.toISOString(),
      rotationIntervalMs: 15000,
    });
  } catch (error) {
    logger.error({ error }, "Teacher get security code error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions/:id/live
 * SSE stream for teacher live session attendance updates.
 */
router.get("/sessions/:id/live", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only subscribe to your own sessions.");
      return;
    }

    realtimeService.addSSEClient(id, req.user!.id, res);
  } catch (error) {
    logger.error({ error }, "Teacher SSE live stream error");
    sendInternalError(res);
  }
});

/**
 * POST /teacher/sessions/:id/recheck
 * Trigger a random spot re-check for verified students in an active session.
 */
router.post("/sessions/:id/recheck", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only trigger re-checks for your own sessions.");
      return;
    }

    const session = await sessionService.getSessionById(id);
    if (!session || session.status !== "ACTIVE") {
      sendBadRequest(res, "Session must be ACTIVE to trigger a spot re-check.");
      return;
    }

    const prompt = req.body.prompt || "Spot verification requested by teacher";
    const result = await recheckService.initiateRecheck(id, session.classId, prompt);

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Triggered spot re-check for session ${id} (${result.studentIds.length} students)`,
      targetType: "recheck",
      targetId: id,
      severity: "Info",
      req,
    });

    sendSuccess(res, {
      sessionId: id,
      totalRequested: result.studentIds.length,
      expiresInSeconds: 120,
    }, "Spot re-check initiated.");
  } catch (error) {
    logger.error({ error }, "Teacher trigger recheck error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions/:id/rechecks
 * Get all re-checks for a session.
 */
router.get("/sessions/:id/rechecks", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only view re-checks for your own sessions.");
      return;
    }

    const rechecks = await recheckService.getRechecksForSession(id);
    sendSuccess(res, rechecks);
  } catch (error) {
    logger.error({ error }, "Teacher get rechecks error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/sessions/:id/stats
 * Get live stats for a session.
 */
router.get("/sessions/:id/stats", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
    if (!owned) {
      sendForbidden(res, "You can only view stats for your own sessions.");
      return;
    }

    const stats = await sessionService.getSessionLiveStats(id);
    if (!stats) {
      sendNotFound(res, "Session not found.");
      return;
    }

    sendSuccess(res, stats);
  } catch (error) {
    logger.error({ error }, "Teacher get session stats error");
    sendInternalError(res);
  }
});

/**
 * POST /teacher/attendance/:id/correct
 * Teacher manual correction of an attendance record.
 */
router.post("/attendance/:id/correct", async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user!.id);
    if (!teacher) {
      sendNotFound(res, "Teacher profile not found.");
      return;
    }

    const id = getParam(req, "id");
    const { newStatus, reason } = req.body;

    if (!newStatus || !reason) {
      sendBadRequest(res, "newStatus and reason are required.");
      return;
    }

    const result = await correctionService.correctAttendance({
      attendanceId: id,
      newStatus,
      reason,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
    });

    if (!result.success) {
      sendBadRequest(res, result.error ?? "Failed to correct attendance.");
      return;
    }

    sendSuccess(res, { correctionId: result.correctionId }, "Attendance corrected successfully.");
  } catch (error) {
    logger.error({ error }, "Teacher correct attendance error");
    sendInternalError(res);
  }
});

/**
 * GET /teacher/corrections
 * View correction history for teacher.
 */
router.get("/corrections", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const corrections = await correctionService.getAllCorrections(limit, offset);
    sendSuccess(res, corrections);
  } catch (error) {
    logger.error({ error }, "Teacher get corrections error");
    sendInternalError(res);
  }
});

export default router;
