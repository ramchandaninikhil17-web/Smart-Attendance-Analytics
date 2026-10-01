/**
 * Attendance service — manages attendance records with strict validation.
 * Every record MUST reference a session, student, class.
 */
import { db } from "@workspace/db";
import {
  attendanceTable, classSessionsTable, studentsTable, enrollmentsTable,
  usersTable
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface MarkAttendanceInput {
  sessionId: string;
  studentId: string;
  classId: string;
  subjectId?: string;
  status: "Present" | "Late" | "Absent" | "Excused";
  verificationMethod?: string;
  riskScore?: number;
  markedBy: string;
}

/**
 * Mark attendance for a student in a session.
 * Validates session is ACTIVE and student is enrolled.
 */
export async function markAttendance(input: MarkAttendanceInput) {
  // Verify session is active
  const [session] = await db
    .select({ status: classSessionsTable.status, classId: classSessionsTable.classId })
    .from(classSessionsTable)
    .where(eq(classSessionsTable.id, input.sessionId))
    .limit(1);

  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");

  // Verify student is enrolled in the class
  const [enrollment] = await db
    .select({ id: enrollmentsTable.id })
    .from(enrollmentsTable)
    .where(and(
      eq(enrollmentsTable.studentId, input.studentId),
      eq(enrollmentsTable.classId, input.classId),
      eq(enrollmentsTable.status, "active")
    ))
    .limit(1);

  if (!enrollment) throw new Error("STUDENT_NOT_ENROLLED");

  // Check for duplicate attendance in same session
  const [existing] = await db
    .select({ id: attendanceTable.id })
    .from(attendanceTable)
    .where(and(
      eq(attendanceTable.sessionId, input.sessionId),
      eq(attendanceTable.studentId, input.studentId)
    ))
    .limit(1);

  if (existing) {
    // Update existing record
    await db
      .update(attendanceTable)
      .set({
        status: input.status,
        verified: input.status === "Present",
        verificationMethod: input.verificationMethod ?? "Manual Override",
        riskScore: input.riskScore ?? 0,
        markedBy: input.markedBy,
        updatedAt: new Date(),
      })
      .where(eq(attendanceTable.id, existing.id));

    return { id: existing.id, updated: true };
  }

  // Create new attendance record
  const id = uuidv4();
  await db.insert(attendanceTable).values({
    id,
    sessionId: input.sessionId,
    studentId: input.studentId,
    classId: input.classId,
    subjectId: input.subjectId ?? null,
    status: input.status,
    verified: input.status === "Present",
    verificationMethod: input.verificationMethod ?? "Manual Override",
    riskScore: input.riskScore ?? 0,
    markedBy: input.markedBy,
  });

  return { id, updated: false };
}

/**
 * Get attendance records for a session.
 */
export async function getAttendanceForSession(sessionId: string) {
  return db
    .select({
      id: attendanceTable.id,
      sessionId: attendanceTable.sessionId,
      studentId: attendanceTable.studentId,
      classId: attendanceTable.classId,
      status: attendanceTable.status,
      verified: attendanceTable.verified,
      verificationMethod: attendanceTable.verificationMethod,
      riskScore: attendanceTable.riskScore,
      markedAt: attendanceTable.markedAt,
      studentName: usersTable.name,
      studentRollNo: studentsTable.studentId,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(attendanceTable.sessionId, sessionId))
    .orderBy(desc(attendanceTable.markedAt));
}

/**
 * Get attendance history for a specific student (own records only).
 */
export async function getAttendanceForStudent(studentId: string) {
  return db
    .select({
      id: attendanceTable.id,
      sessionId: attendanceTable.sessionId,
      classId: attendanceTable.classId,
      subjectId: attendanceTable.subjectId,
      status: attendanceTable.status,
      verified: attendanceTable.verified,
      verificationMethod: attendanceTable.verificationMethod,
      riskScore: attendanceTable.riskScore,
      markedAt: attendanceTable.markedAt,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, studentId))
    .orderBy(desc(attendanceTable.markedAt));
}

/**
 * Get all attendance records (admin view).
 */
export async function getAllAttendance(limit = 200, offset = 0) {
  return db
    .select({
      id: attendanceTable.id,
      sessionId: attendanceTable.sessionId,
      studentId: attendanceTable.studentId,
      classId: attendanceTable.classId,
      subjectId: attendanceTable.subjectId,
      status: attendanceTable.status,
      verified: attendanceTable.verified,
      verificationMethod: attendanceTable.verificationMethod,
      riskScore: attendanceTable.riskScore,
      markedAt: attendanceTable.markedAt,
      studentName: usersTable.name,
      studentRollNo: studentsTable.studentId,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .orderBy(desc(attendanceTable.markedAt))
    .limit(limit)
    .offset(offset);
}
