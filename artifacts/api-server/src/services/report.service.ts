/**
 * Report Service — generates reports from authoritative backend data.
 *
 * All reports use backend-calculated data, never frontend state.
 * Supports CSV export generation.
 */
import { db } from "@workspace/db";
import {
  attendanceTable, classSessionsTable, studentsTable, usersTable,
  classesTable, subjectsTable, enrollmentsTable, riskEventsTable,
  auditLogsTable
} from "@workspace/db/schema";
import { eq, and, desc, ne, inArray, between } from "drizzle-orm";
import { getStudentAnalytics, getClassAnalytics, getLowAttendanceStudents } from "./analytics.service";

/**
 * Generate student attendance report data.
 */
export async function getStudentReport(studentId: string) {
  const analytics = await getStudentAnalytics(studentId);

  // Get student info
  const [student] = await db
    .select({
      studentId: studentsTable.studentId,
      name: usersTable.name,
      email: usersTable.email,
      classId: studentsTable.classId,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.id, studentId))
    .limit(1);

  return {
    student,
    analytics,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate class attendance report data.
 */
export async function getClassReport(classId: string) {
  const analytics = await getClassAnalytics(classId);

  const [classInfo] = await db
    .select()
    .from(classesTable)
    .where(eq(classesTable.id, classId))
    .limit(1);

  return {
    class: classInfo,
    analytics,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate low attendance report data.
 */
export async function getLowAttendanceReport(threshold?: number, classId?: string) {
  const students = await getLowAttendanceStudents(threshold, classId);

  return {
    threshold: threshold ?? 75,
    classId,
    students,
    totalAtRisk: students.length,
    criticalCount: students.filter((s) => s.alertLevel === "Critical").length,
    warningCount: students.filter((s) => s.alertLevel === "Warning").length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate session report data.
 */
export async function getSessionReport(sessionId: string) {
  const [session] = await db
    .select({
      id: classSessionsTable.id,
      classId: classSessionsTable.classId,
      teacherId: classSessionsTable.teacherId,
      status: classSessionsTable.status,
      startTime: classSessionsTable.startTime,
      endTime: classSessionsTable.endTime,
      className: classesTable.name,
      classSection: classesTable.section,
    })
    .from(classSessionsTable)
    .leftJoin(classesTable, eq(classSessionsTable.classId, classesTable.id))
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  const attendanceRecords = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      status: attendanceTable.status,
      verified: attendanceTable.verified,
      verificationMethod: attendanceTable.verificationMethod,
      riskScore: attendanceTable.riskScore,
      markedAt: attendanceTable.markedAt,
      studentName: usersTable.name,
      rollNo: studentsTable.studentId,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(attendanceTable.sessionId, sessionId));

  return {
    session,
    attendance: attendanceRecords,
    summary: {
      total: attendanceRecords.length,
      present: attendanceRecords.filter((r) => r.status === "Present").length,
      late: attendanceRecords.filter((r) => r.status === "Late").length,
      absent: attendanceRecords.filter((r) => r.status === "Absent").length,
      excused: attendanceRecords.filter((r) => r.status === "Excused").length,
      verified: attendanceRecords.filter((r) => r.verified).length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate security report data.
 */
export async function getSecurityReport(limit: number = 200) {
  const events = await db
    .select()
    .from(riskEventsTable)
    .orderBy(desc(riskEventsTable.createdAt))
    .limit(limit);

  const highSeverity = events.filter((e) => e.severity === "High");
  const mediumSeverity = events.filter((e) => e.severity === "Medium");
  const lowSeverity = events.filter((e) => e.severity === "Low");
  const needsReview = events.filter((e) => e.status === "Needs review");

  return {
    events,
    summary: {
      total: events.length,
      highSeverity: highSeverity.length,
      mediumSeverity: mediumSeverity.length,
      lowSeverity: lowSeverity.length,
      needsReview: needsReview.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Convert report data to CSV format.
 */
export function toCSV(
  headers: string[],
  rows: Record<string, unknown>[]
): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma/newline/quote
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}
