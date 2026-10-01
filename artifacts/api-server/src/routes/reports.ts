/**
 * Reports routes — authoritative backend report generation and CSV exports.
 * Scoped by role: students (own only), teachers (assigned scope), admin (all).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { ROLES } from "../lib/constants";
import { sendSuccess, sendBadRequest, sendNotFound, sendForbidden, sendInternalError } from "../lib/responses";
import { getParam } from "../lib/params";
import * as reportService from "../services/report.service";
import * as studentService from "../services/student.service";
import * as teacherService from "../services/teacher.service";
import * as sessionService from "../services/session.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(authenticate);

/**
 * GET /reports/student/:id
 * Student attendance report.
 */
router.get("/student/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      const student = await studentService.getStudentByUserId(user.id);
      if (!student || student.id !== id) {
        sendForbidden(res, "You can only view your own report.");
        return;
      }
    } else if (user.role === ROLES.TEACHER) {
      const teacher = await teacherService.getTeacherByUserId(user.id);
      if (!teacher) {
        sendNotFound(res, "Teacher profile not found.");
        return;
      }
      const authorized = await studentService.isTeacherAuthorizedForStudent(teacher.id, id);
      if (!authorized) {
        sendForbidden(res, "You are not authorized to view this student's report.");
        return;
      }
    }

    const report = await reportService.getStudentReport(id);
    sendSuccess(res, report);
  } catch (error) {
    logger.error({ error }, "Get student report error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/student/:id/csv
 * Student report CSV download.
 */
router.get("/student/:id/csv", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      const student = await studentService.getStudentByUserId(user.id);
      if (!student || student.id !== id) {
        sendForbidden(res, "You can only download your own report.");
        return;
      }
    } else if (user.role === ROLES.TEACHER) {
      const teacher = await teacherService.getTeacherByUserId(user.id);
      if (!teacher) {
        sendNotFound(res, "Teacher profile not found.");
        return;
      }
      const authorized = await studentService.isTeacherAuthorizedForStudent(teacher.id, id);
      if (!authorized) {
        sendForbidden(res, "You are not authorized to export this student's report.");
        return;
      }
    }

    const report = await reportService.getStudentReport(id);
    const headers = ["Subject", "Total Classes", "Attended", "Late", "Percentage"];
    const rows = report.analytics.subjectBreakdown.map((s) => ({
      Subject: s.subjectId,
      "Total Classes": s.total,
      Attended: s.present + s.late,
      Late: s.late,
      Percentage: `${s.percent}%`,
    }));

    const csv = reportService.toCSV(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="student-report-${id}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    logger.error({ error }, "Download student report CSV error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/class/:id
 * Class attendance report. Teachers (if assigned) or Admins.
 */
router.get("/class/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      sendForbidden(res, "Students cannot view class-wide reports.");
      return;
    }

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
    }

    const report = await reportService.getClassReport(id);
    sendSuccess(res, report);
  } catch (error) {
    logger.error({ error }, "Get class report error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/class/:id/csv
 * Class report CSV download.
 */
router.get("/class/:id/csv", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      sendForbidden(res, "Students cannot export class reports.");
      return;
    }

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
    }

    const report = await reportService.getClassReport(id);
    const headers = ["Student ID", "Name", "Roll No", "Present", "Late", "Absent", "Attendance Rate"];
    const rows = report.analytics.studentStats.map((st) => ({
      "Student ID": st.studentId,
      Name: st.studentName,
      "Roll No": st.rollNo,
      Present: st.present,
      Late: st.late,
      Absent: st.absent,
      "Attendance Rate": `${st.percent}%`,
    }));

    const csv = reportService.toCSV(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="class-report-${id}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    logger.error({ error }, "Download class report CSV error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/session/:id
 * Session report (Teachers for own sessions, Admins for any).
 */
router.get("/session/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      sendForbidden(res, "Students cannot access session reports.");
      return;
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await teacherService.getTeacherByUserId(user.id);
      if (!teacher) {
        sendNotFound(res, "Teacher profile not found.");
        return;
      }
      const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
      if (!owned) {
        sendForbidden(res, "You can only view reports for your own sessions.");
        return;
      }
    }

    const report = await reportService.getSessionReport(id);
    sendSuccess(res, report);
  } catch (error) {
    logger.error({ error }, "Get session report error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/session/:id/csv
 * Session report CSV download.
 */
router.get("/session/:id/csv", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const user = req.user!;

    if (user.role === ROLES.STUDENT) {
      sendForbidden(res, "Students cannot export session reports.");
      return;
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await teacherService.getTeacherByUserId(user.id);
      if (!teacher) {
        sendNotFound(res, "Teacher profile not found.");
        return;
      }
      const owned = await sessionService.isSessionOwnedByTeacher(id, teacher.id);
      if (!owned) {
        sendForbidden(res, "You can only export reports for your own sessions.");
        return;
      }
    }

    const report = await reportService.getSessionReport(id);
    const headers = ["Roll No", "Student Name", "Status", "Verified", "Method", "Risk Score", "Marked At"];
    const rows = report.attendance.map((rec) => ({
      "Roll No": rec.rollNo || "",
      "Student Name": rec.studentName || "",
      Status: rec.status,
      Verified: rec.verified ? "Yes" : "No",
      Method: rec.verificationMethod || "",
      "Risk Score": rec.riskScore ?? 0,
      "Marked At": rec.markedAt ? new Date(rec.markedAt).toISOString() : "",
    }));

    const csv = reportService.toCSV(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="session-report-${id}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    logger.error({ error }, "Download session report CSV error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/low-attendance
 * Low-attendance / at-risk student report. Teachers see assigned classes, Admins see all.
 */
router.get("/low-attendance", async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === ROLES.STUDENT) {
      sendForbidden(res, "Access denied.");
      return;
    }

    const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;
    const classId = req.query.classId ? String(req.query.classId) : undefined;

    const report = await reportService.getLowAttendanceReport(threshold, classId);
    sendSuccess(res, report);
  } catch (error) {
    logger.error({ error }, "Get low attendance report error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/low-attendance/csv
 * Low-attendance report CSV download.
 */
router.get("/low-attendance/csv", async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === ROLES.STUDENT) {
      sendForbidden(res, "Access denied.");
      return;
    }

    const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;
    const classId = req.query.classId ? String(req.query.classId) : undefined;

    const report = await reportService.getLowAttendanceReport(threshold, classId);
    const headers = ["Roll No", "Name", "Percentage", "Alert Level"];
    const rows = report.students.map((s) => ({
      "Roll No": s.studentRollNo || "",
      Name: s.studentName,
      Percentage: `${s.attendancePercent}%`,
      "Alert Level": s.alertLevel,
    }));

    const csv = reportService.toCSV(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="low-attendance-report.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    logger.error({ error }, "Download low attendance CSV error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/security
 * Security risk report. ADMIN ONLY.
 */
router.get("/security", authorize(ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const report = await reportService.getSecurityReport(limit);
    sendSuccess(res, report);
  } catch (error) {
    logger.error({ error }, "Get security report error");
    sendInternalError(res);
  }
});

/**
 * GET /reports/security/csv
 * Security report CSV download. ADMIN ONLY.
 */
router.get("/security/csv", authorize(ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const report = await reportService.getSecurityReport(limit);
    const headers = ["Event ID", "User ID", "Event", "Severity", "Status", "Reason", "Created At"];
    const rows = report.events.map((e) => ({
      "Event ID": e.id,
      "User ID": e.userId || "",
      Event: e.event,
      Severity: e.severity,
      Status: e.status,
      Reason: e.reason || "",
      "Created At": e.createdAt ? new Date(e.createdAt).toISOString() : "",
    }));

    const csv = reportService.toCSV(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="security-report.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    logger.error({ error }, "Download security report CSV error");
    sendInternalError(res);
  }
});

export default router;
