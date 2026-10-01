/**
 * Admin routes — full institutional management.
 * Every route requires ADMIN role.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { ROLES } from "../lib/constants";
import { sendSuccess, sendBadRequest, sendNotFound, sendConflict, sendInternalError } from "../lib/responses";
import { getParam } from "../lib/params";
import * as authService from "../services/auth.service";
import * as studentService from "../services/student.service";
import * as teacherService from "../services/teacher.service";
import * as classService from "../services/class.service";
import * as subjectService from "../services/subject.service";
import * as enrollmentService from "../services/enrollment.service";
import * as sessionService from "../services/session.service";
import * as attendanceService from "../services/attendance.service";
import * as riskService from "../services/risk.service";
import * as correctionService from "../services/correction.service";
import { getAuditLogs, createAuditLog } from "../services/audit.service";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { studentsTable, teachersTable, classesTable, subjectsTable, enrollmentsTable, classSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ALL admin routes require ADMIN role
router.use(authenticate, authorize(ROLES.ADMIN));

// ===== USER MANAGEMENT =====

router.post("/users", async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, department, institute } = req.body;
    if (!email || !password || !name || !role) {
      sendBadRequest(res, "email, password, name, and role are required.");
      return;
    }

    const result = await authService.registerUser({ email, password, name, role, department, institute });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Created ${role} user: ${name} (${email})`,
      targetType: "user",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "User created successfully.", 201);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "EMAIL_EXISTS") {
      sendConflict(res, "A user with this email already exists.");
      return;
    }
    logger.error({ error }, "Admin create user error");
    sendInternalError(res);
  }
});

router.put("/users/:userId/deactivate", async (req: Request, res: Response) => {
  try {
    const userId = getParam(req, "userId");
    await authService.deactivateUser(userId);

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Deactivated user ${userId}`,
      targetType: "user",
      targetId: userId,
      severity: "Warning",
      req,
    });

    sendSuccess(res, null, "User deactivated.");
  } catch (error) {
    logger.error({ error }, "Admin deactivate user error");
    sendInternalError(res);
  }
});

router.put("/users/:userId/activate", async (req: Request, res: Response) => {
  try {
    const userId = getParam(req, "userId");
    await authService.activateUser(userId);

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Activated user ${userId}`,
      targetType: "user",
      targetId: userId,
      severity: "Info",
      req,
    });

    sendSuccess(res, null, "User activated.");
  } catch (error) {
    logger.error({ error }, "Admin activate user error");
    sendInternalError(res);
  }
});

// ===== STUDENT MANAGEMENT =====

router.get("/students", async (_req: Request, res: Response) => {
  try {
    const students = await studentService.getAllStudents();
    sendSuccess(res, students);
  } catch (error) {
    logger.error({ error }, "Admin get students error");
    sendInternalError(res);
  }
});

router.post("/students", async (req: Request, res: Response) => {
  try {
    const { name, email, password, studentId, classId, institute, department } = req.body;
    if (!name || !email || !password || !studentId) {
      sendBadRequest(res, "name, email, password, and studentId are required.");
      return;
    }

    const result = await studentService.createStudent({
      name, email, password, studentId, classId, institute, department,
    });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Created student: ${name} (${studentId})`,
      targetType: "student",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Student created.", 201);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.includes("unique") || err.message?.includes("duplicate")) {
      sendConflict(res, "Student with this email or ID already exists.");
      return;
    }
    logger.error({ error }, "Admin create student error");
    sendInternalError(res);
  }
});

router.get("/students/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const student = await studentService.getStudentById(id);
    if (!student) {
      sendNotFound(res, "Student not found.");
      return;
    }
    sendSuccess(res, student);
  } catch (error) {
    logger.error({ error }, "Admin get student error");
    sendInternalError(res);
  }
});

router.put("/students/:id", async (req: Request, res: Response) => {
  try {
    const { classId, status, attendancePercent } = req.body;
    const id = getParam(req, "id");
    const result = await studentService.updateStudent(id, { classId, status, attendancePercent });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Updated student ${id}`,
      targetType: "student",
      targetId: id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Student updated.");
  } catch (error) {
    logger.error({ error }, "Admin update student error");
    sendInternalError(res);
  }
});

router.delete("/students/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    await db.delete(studentsTable).where(eq(studentsTable.id, id));
    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Deleted student ${id}`,
      targetType: "student",
      targetId: id,
      severity: "Warning",
      req,
    });
    sendSuccess(res, null, "Student deleted.");
  } catch (error) {
    logger.error({ error }, "Admin delete student error");
    sendInternalError(res);
  }
});

// ===== TEACHER MANAGEMENT =====

router.get("/teachers", async (_req: Request, res: Response) => {
  try {
    const teachers = await teacherService.getAllTeachers();
    sendSuccess(res, teachers);
  } catch (error) {
    logger.error({ error }, "Admin get teachers error");
    sendInternalError(res);
  }
});

router.post("/teachers", async (req: Request, res: Response) => {
  try {
    const { name, email, password, department, institute } = req.body;
    if (!name || !email || !password || !department || !institute) {
      sendBadRequest(res, "name, email, password, department, and institute are required.");
      return;
    }

    const result = await teacherService.createTeacher({ name, email, password, department, institute });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Created teacher: ${name} (${email})`,
      targetType: "teacher",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Teacher created.", 201);
  } catch (error) {
    logger.error({ error }, "Admin create teacher error");
    sendInternalError(res);
  }
});

router.delete("/teachers/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    await db.delete(teachersTable).where(eq(teachersTable.id, id));
    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Deleted teacher ${id}`,
      targetType: "teacher",
      targetId: id,
      severity: "Warning",
      req,
    });
    sendSuccess(res, null, "Teacher deleted.");
  } catch (error) {
    logger.error({ error }, "Admin delete teacher error");
    sendInternalError(res);
  }
});

// ===== TEACHER ASSIGNMENT MANAGEMENT =====

router.post("/teacher-assignments", async (req: Request, res: Response) => {
  try {
    const { teacherId, classId, subjectId } = req.body;
    if (!teacherId || !classId) {
      sendBadRequest(res, "teacherId and classId are required.");
      return;
    }

    const result = await teacherService.createTeacherAssignment(teacherId, classId, subjectId);

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Assigned teacher ${teacherId} to class ${classId}`,
      targetType: "teacher_assignment",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Teacher assigned.", 201);
  } catch (error) {
    logger.error({ error }, "Admin create teacher assignment error");
    sendInternalError(res);
  }
});

// ===== CLASS MANAGEMENT =====

router.get("/classes", async (_req: Request, res: Response) => {
  try {
    const classes = await classService.getAllClasses();
    sendSuccess(res, classes);
  } catch (error) {
    logger.error({ error }, "Admin get classes error");
    sendInternalError(res);
  }
});

router.post("/classes", async (req: Request, res: Response) => {
  try {
    const { name, section, semester, room, institute } = req.body;
    if (!name || !section || !semester || !institute) {
      sendBadRequest(res, "name, section, semester, and institute are required.");
      return;
    }

    const result = await classService.createClass({ name, section, semester, room, institute });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Created class: ${name} ${section}`,
      targetType: "class",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Class created.", 201);
  } catch (error) {
    logger.error({ error }, "Admin create class error");
    sendInternalError(res);
  }
});

router.put("/classes/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const result = await classService.updateClass(id, req.body);

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Updated class ${id}`,
      targetType: "class",
      targetId: id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Class updated.");
  } catch (error) {
    logger.error({ error }, "Admin update class error");
    sendInternalError(res);
  }
});

router.delete("/classes/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    await db.delete(classesTable).where(eq(classesTable.id, id));
    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Deleted class ${id}`,
      targetType: "class",
      targetId: id,
      severity: "Warning",
      req,
    });
    sendSuccess(res, null, "Class deleted.");
  } catch (error) {
    logger.error({ error }, "Admin delete class error");
    sendInternalError(res);
  }
});

// ===== SUBJECT MANAGEMENT =====

router.get("/subjects", async (_req: Request, res: Response) => {
  try {
    const subjects = await subjectService.getAllSubjects();
    sendSuccess(res, subjects);
  } catch (error) {
    logger.error({ error }, "Admin get subjects error");
    sendInternalError(res);
  }
});

router.post("/subjects", async (req: Request, res: Response) => {
  try {
    const { name, code, credits, threshold } = req.body;
    if (!name || !code) {
      sendBadRequest(res, "name and code are required.");
      return;
    }

    const result = await subjectService.createSubject({ name, code, credits, threshold });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Created subject: ${name} (${code})`,
      targetType: "subject",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Subject created.", 201);
  } catch (error) {
    logger.error({ error }, "Admin create subject error");
    sendInternalError(res);
  }
});

router.delete("/subjects/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    await db.delete(subjectsTable).where(eq(subjectsTable.id, id));
    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Deleted subject ${id}`,
      targetType: "subject",
      targetId: id,
      severity: "Warning",
      req,
    });
    sendSuccess(res, null, "Subject deleted.");
  } catch (error) {
    logger.error({ error }, "Admin delete subject error");
    sendInternalError(res);
  }
});

// ===== ENROLLMENT MANAGEMENT =====

router.get("/enrollments", async (_req: Request, res: Response) => {
  try {
    const enrollments = await enrollmentService.getAllEnrollments();
    sendSuccess(res, enrollments);
  } catch (error) {
    logger.error({ error }, "Admin get enrollments error");
    sendInternalError(res);
  }
});

router.post("/enrollments", async (req: Request, res: Response) => {
  try {
    const { studentId, classId, subjectId } = req.body;
    if (!studentId || !classId) {
      sendBadRequest(res, "studentId and classId are required.");
      return;
    }

    const result = await enrollmentService.createEnrollment({ studentId, classId, subjectId });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Enrolled student ${studentId} in class ${classId}`,
      targetType: "enrollment",
      targetId: result.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, result, "Enrollment created.", 201);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "DUPLICATE_ENROLLMENT") {
      sendConflict(res, "Student is already enrolled in this class.");
      return;
    }
    logger.error({ error }, "Admin create enrollment error");
    sendInternalError(res);
  }
});

// ===== SESSION MANAGEMENT =====

router.get("/sessions", async (_req: Request, res: Response) => {
  try {
    const sessions = await sessionService.getAllSessions();
    sendSuccess(res, sessions);
  } catch (error) {
    logger.error({ error }, "Admin get sessions error");
    sendInternalError(res);
  }
});

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { classId, subjectId, teacherId } = req.body;
    if (!classId) {
      sendBadRequest(res, "classId is required.");
      return;
    }
    const result = await sessionService.createSession({
      classId,
      subjectId,
      teacherId,
      isAdmin: true,
    });
    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Admin started lecture session for class ${classId}`,
      targetType: "session",
      targetId: result.id,
      severity: "Info",
      req,
    });
    sendSuccess(res, result, "Session started.", 201);
  } catch (error) {
    logger.error({ error }, "Admin create session error");
    sendInternalError(res);
  }
});

router.put("/sessions/:id/end", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const result = await sessionService.transitionSession(id, "ENDED");
    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Admin ended session ${id}`,
      targetType: "session",
      targetId: id,
      severity: "Info",
      req,
    });
    sendSuccess(res, result, "Session ended.");
  } catch (error) {
    logger.error({ error }, "Admin end session error");
    sendInternalError(res);
  }
});

router.post("/sessions/:id/attendance", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const { studentId, status } = req.body;
    if (!studentId || !status) {
      sendBadRequest(res, "studentId and status are required.");
      return;
    }
    const session = await sessionService.getSessionById(id);
    if (!session) {
      sendNotFound(res, "Session not found.");
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
      action: `Admin manually marked attendance for student ${studentId} in session ${id} as ${status}`,
      targetType: "attendance",
      targetId: result.id,
      severity: "Info",
      req,
    });
    sendSuccess(res, result, "Attendance marked.");
  } catch (error) {
    logger.error({ error }, "Admin mark attendance error");
    sendInternalError(res);
  }
});

// ===== ATTENDANCE =====

router.get("/attendance", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const offset = Number(req.query.offset) || 0;
    const records = await attendanceService.getAllAttendance(limit, offset);
    sendSuccess(res, records);
  } catch (error) {
    logger.error({ error }, "Admin get attendance error");
    sendInternalError(res);
  }
});

// ===== AUDIT LOGS =====

router.get("/audit", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const logs = await getAuditLogs(limit, offset);
    sendSuccess(res, logs);
  } catch (error) {
    logger.error({ error }, "Admin get audit logs error");
    sendInternalError(res);
  }
});

// ===== SECURITY EVENTS =====

router.get("/security/events", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const offset = Number(req.query.offset) || 0;
    const events = await riskService.getAllRiskEvents(limit, offset);
    sendSuccess(res, events);
  } catch (error) {
    logger.error({ error }, "Admin get security events error");
    sendInternalError(res);
  }
});

router.put("/security/events/:id/review", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const { status, reasonNote } = req.body;

    if (!status || !["Reviewed", "Dismissed"].includes(status)) {
      sendBadRequest(res, "Valid status ('Reviewed' or 'Dismissed') is required.");
      return;
    }

    await riskService.updateRiskEventStatus(id, status);

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Reviewed security event ${id}: ${status} ${reasonNote ? `(${reasonNote})` : ""}`,
      targetType: "security_event",
      targetId: id,
      severity: "Info",
      req,
    });

    sendSuccess(res, null, `Security event marked as ${status}.`);
  } catch (error) {
    logger.error({ error }, "Admin review security event error");
    sendInternalError(res);
  }
});

// ===== ATTENDANCE CORRECTIONS =====

router.post("/attendance/:id/correct", async (req: Request, res: Response) => {
  try {
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
    logger.error({ error }, "Admin correct attendance error");
    sendInternalError(res);
  }
});

router.get("/corrections", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const corrections = await correctionService.getAllCorrections(limit, offset);
    sendSuccess(res, corrections);
  } catch (error) {
    logger.error({ error }, "Admin get corrections error");
    sendInternalError(res);
  }
});

export default router;
