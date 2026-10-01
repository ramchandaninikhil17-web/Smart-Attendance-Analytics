/**
 * Analytics Engine — THE authoritative backend attendance analytics service.
 *
 * All attendance percentages, trends, and statistics are calculated here.
 * Frontend should NEVER calculate these independently.
 *
 * Formula: eligible present / eligible conducted × 100
 */
import { db } from "@workspace/db";
import {
  attendanceTable, classSessionsTable, studentsTable, enrollmentsTable,
  usersTable, subjectsTable, classesTable
} from "@workspace/db/schema";
import { eq, and, sql, desc, count, inArray, ne } from "drizzle-orm";

/**
 * Get overall attendance statistics for a student.
 */
export async function getStudentAnalytics(studentId: string) {
  // Get all attendance records for this student
  const records = await db
    .select({
      id: attendanceTable.id,
      sessionId: attendanceTable.sessionId,
      classId: attendanceTable.classId,
      subjectId: attendanceTable.subjectId,
      status: attendanceTable.status,
      verified: attendanceTable.verified,
      markedAt: attendanceTable.markedAt,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, studentId));

  // Get enrolled classes
  const enrollments = await db
    .select({
      classId: enrollmentsTable.classId,
      className: classesTable.name,
    })
    .from(enrollmentsTable)
    .innerJoin(classesTable, eq(enrollmentsTable.classId, classesTable.id))
    .where(and(
      eq(enrollmentsTable.studentId, studentId),
      eq(enrollmentsTable.status, "active")
    ));

  const classIds = enrollments.map((e) => e.classId);

  // Count total conducted sessions for enrolled classes (exclude CANCELLED)
  let totalConducted = 0;
  if (classIds.length > 0) {
    const sessions = await db
      .select({ id: classSessionsTable.id })
      .from(classSessionsTable)
      .where(and(
        inArray(classSessionsTable.classId, classIds),
        ne(classSessionsTable.status, "CANCELLED")
      ));
    totalConducted = sessions.length;
  }

  const presentCount = records.filter((r) => r.status === "Present").length;
  const lateCount = records.filter((r) => r.status === "Late").length;
  const absentCount = records.filter((r) => r.status === "Absent").length;
  const excusedCount = records.filter((r) => r.status === "Excused").length;
  const totalAttended = presentCount + lateCount; // Late counts as attended
  const eligibleConducted = totalConducted - excusedCount; // Excused sessions don't count

  const overallPercent = eligibleConducted > 0
    ? Math.round((totalAttended / eligibleConducted) * 100)
    : 0;

  // Per-subject breakdown
  const subjectMap = new Map<string, { present: number; late: number; absent: number; excused: number; total: number }>();
  for (const record of records) {
    const key = record.subjectId ?? "unspecified";
    const entry = subjectMap.get(key) ?? { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    entry.total++;
    if (record.status === "Present") entry.present++;
    else if (record.status === "Late") entry.late++;
    else if (record.status === "Absent") entry.absent++;
    else if (record.status === "Excused") entry.excused++;
    subjectMap.set(key, entry);
  }

  const subjectBreakdown: Array<{
    subjectId: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    total: number;
    percent: number;
  }> = [];

  for (const [subjectId, data] of subjectMap) {
    const eligible = data.total - data.excused;
    const attended = data.present + data.late;
    subjectBreakdown.push({
      subjectId,
      ...data,
      percent: eligible > 0 ? Math.round((attended / eligible) * 100) : 0,
    });
  }

  // Attendance trend (last 30 records)
  const recentRecords = records
    .sort((a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime())
    .slice(0, 30);

  const trend = recentRecords.map((r) => ({
    date: r.markedAt,
    status: r.status,
    sessionId: r.sessionId,
  }));

  return {
    overallPercent,
    totalConducted,
    totalAttended,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    subjectBreakdown,
    trend,
    enrolledClasses: enrollments.map((e) => ({ classId: e.classId, className: e.className })),
  };
}

/**
 * Get class-level analytics.
 */
export async function getClassAnalytics(classId: string) {
  // Get all sessions for this class (excluding cancelled)
  const sessions = await db
    .select({
      id: classSessionsTable.id,
      status: classSessionsTable.status,
      startTime: classSessionsTable.startTime,
      endTime: classSessionsTable.endTime,
    })
    .from(classSessionsTable)
    .where(and(
      eq(classSessionsTable.classId, classId),
      ne(classSessionsTable.status, "CANCELLED")
    ));

  const totalSessions = sessions.length;

  // Get all students enrolled in this class
  const enrolledStudents = await db
    .select({
      studentId: enrollmentsTable.studentId,
      studentName: usersTable.name,
      rollNo: studentsTable.studentId,
    })
    .from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(and(
      eq(enrollmentsTable.classId, classId),
      eq(enrollmentsTable.status, "active")
    ));

  // Get all attendance records for this class
  const records = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      status: attendanceTable.status,
      sessionId: attendanceTable.sessionId,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.classId, classId));

  // Per-student stats
  const studentStats = enrolledStudents.map((s) => {
    const studentRecords = records.filter((r) => r.studentId === s.studentId);
    const present = studentRecords.filter((r) => r.status === "Present").length;
    const late = studentRecords.filter((r) => r.status === "Late").length;
    const absent = studentRecords.filter((r) => r.status === "Absent").length;
    const excused = studentRecords.filter((r) => r.status === "Excused").length;
    const attended = present + late;
    const eligible = totalSessions - excused;
    const percent = eligible > 0 ? Math.round((attended / eligible) * 100) : 0;

    return {
      studentId: s.studentId,
      studentName: s.studentName,
      rollNo: s.rollNo,
      present,
      late,
      absent,
      excused,
      percent,
      status: percent < 60 ? "Critical" as const : percent < 75 ? "Warning" as const : "Healthy" as const,
    };
  });

  // Aggregate class stats
  const totalPresent = records.filter((r) => r.status === "Present").length;
  const totalLate = records.filter((r) => r.status === "Late").length;
  const totalAbsent = records.filter((r) => r.status === "Absent").length;
  const totalExcused = records.filter((r) => r.status === "Excused").length;

  const averagePercent = studentStats.length > 0
    ? Math.round(studentStats.reduce((sum, s) => sum + s.percent, 0) / studentStats.length)
    : 0;

  const lowAttendanceStudents = studentStats.filter((s) => s.percent < 75);

  return {
    totalSessions,
    totalStudents: enrolledStudents.length,
    averagePercent,
    totalPresent,
    totalLate,
    totalAbsent,
    totalExcused,
    studentStats,
    lowAttendanceStudents,
  };
}

/**
 * Recovery Calculator — how many classes must a student attend to reach threshold.
 *
 * Formula: (target% × (conducted + x) / 100) ≤ (attended + x)
 * Solving: x = ceil((target × conducted - 100 × attended) / (100 - target))
 */
export function calculateRecovery(
  currentAttended: number,
  currentConducted: number,
  targetPercent: number = 75
): {
  currentPercent: number;
  targetPercent: number;
  additionalRequired: number;
  achievable: boolean;
  projections: Array<{ classesFromNow: number; projectedPercent: number }>;
} {
  const currentPercent = currentConducted > 0
    ? Math.round((currentAttended / currentConducted) * 100)
    : 0;

  if (currentPercent >= targetPercent) {
    return {
      currentPercent,
      targetPercent,
      additionalRequired: 0,
      achievable: true,
      projections: [],
    };
  }

  if (targetPercent >= 100) {
    return {
      currentPercent,
      targetPercent,
      additionalRequired: -1,
      achievable: false,
      projections: [],
    };
  }

  // x = ceil((target × conducted - 100 × attended) / (100 - target))
  const numerator = (targetPercent * currentConducted) - (100 * currentAttended);
  const denominator = 100 - targetPercent;
  const additionalRequired = Math.ceil(numerator / denominator);

  // Cap at a reasonable number
  const cappedRequired = Math.min(additionalRequired, 200);
  const achievable = additionalRequired <= 200 && additionalRequired > 0;

  // Generate projections
  const projections: Array<{ classesFromNow: number; projectedPercent: number }> = [];
  const stepsToShow = Math.min(cappedRequired + 3, 10);
  for (let i = 1; i <= stepsToShow; i++) {
    const projectedPercent = Math.round(
      ((currentAttended + i) / (currentConducted + i)) * 100
    );
    projections.push({ classesFromNow: i, projectedPercent });
  }

  return {
    currentPercent,
    targetPercent,
    additionalRequired: achievable ? cappedRequired : -1,
    achievable,
    projections,
  };
}

/**
 * Get low attendance alerts for threshold checking.
 */
export async function getLowAttendanceStudents(
  threshold: number = 75,
  classId?: string
) {
  // Get all students with their attendance
  let query = db
    .select({
      studentId: studentsTable.id,
      userId: studentsTable.userId,
      studentRollNo: studentsTable.studentId,
      attendancePercent: studentsTable.attendancePercent,
      studentName: usersTable.name,
      classId: studentsTable.classId,
      status: studentsTable.status,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id));

  const students = classId
    ? await query.where(eq(studentsTable.classId, classId))
    : await query;

  return students.map((s) => ({
    ...s,
    alertLevel: s.attendancePercent < 60 ? "Critical" as const
      : s.attendancePercent < threshold ? "Warning" as const
      : "Healthy" as const,
    needsRecovery: s.attendancePercent < threshold,
  })).filter((s) => s.alertLevel !== "Healthy");
}

/**
 * Get session-level analytics summary.
 */
export async function getSessionAnalytics(sessionId: string) {
  const records = await db
    .select({
      status: attendanceTable.status,
      verified: attendanceTable.verified,
      riskScore: attendanceTable.riskScore,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.sessionId, sessionId));

  return {
    totalRecords: records.length,
    presentCount: records.filter((r) => r.status === "Present").length,
    lateCount: records.filter((r) => r.status === "Late").length,
    absentCount: records.filter((r) => r.status === "Absent").length,
    excusedCount: records.filter((r) => r.status === "Excused").length,
    verifiedCount: records.filter((r) => r.verified).length,
    averageRiskScore: records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + (r.riskScore ?? 0), 0) / records.length)
      : 0,
    highRiskCount: records.filter((r) => (r.riskScore ?? 0) > 60).length,
  };
}
