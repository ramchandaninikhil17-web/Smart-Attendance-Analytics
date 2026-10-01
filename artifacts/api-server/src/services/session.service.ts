/**
 * Session service — manages lecture session lifecycle.
 * Enforces the state machine: SCHEDULED → ACTIVE → ENDED/CANCELLED
 */
import { db } from "@workspace/db";
import {
  classSessionsTable, teachersTable, classesTable, subjectsTable,
  teacherAssignmentsTable, attendanceTable, enrollmentsTable, studentsTable,
  riskEventsTable
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { SESSION_TRANSITIONS, type Role } from "../lib/constants";
import { clearSessionQR } from "./qr.service";
import { clearSessionSecurityCode } from "./security-code.service";
import { sendSessionEnded } from "./realtime.service";
import { processExpiredRechecks } from "./recheck.service";
import { logger } from "../lib/logger";

export interface CreateSessionInput {
  teacherId?: string;
  classId: string;
  subjectId?: string;
  isAdmin?: boolean;
}

/**
 * Create a new lecture session and set it to ACTIVE.
 * Validates teacher assignment before allowing creation.
 */
export async function createSession(input: CreateSessionInput) {
  let effectiveTeacherId = input.teacherId;

  if (input.isAdmin) {
    if (!effectiveTeacherId) {
      const [assignment] = await db
        .select({ teacherId: teacherAssignmentsTable.teacherId })
        .from(teacherAssignmentsTable)
        .where(eq(teacherAssignmentsTable.classId, input.classId))
        .limit(1);

      if (assignment) {
        effectiveTeacherId = assignment.teacherId;
      } else {
        const [teacher] = await db
          .select({ id: teachersTable.id })
          .from(teachersTable)
          .limit(1);
        effectiveTeacherId = teacher?.id ?? uuidv4();
      }
    }
  } else {
    if (!effectiveTeacherId) {
      throw new Error("TEACHER_ID_REQUIRED");
    }
    // Verify teacher is assigned to this class
    const assignmentConditions = [
      eq(teacherAssignmentsTable.teacherId, effectiveTeacherId),
      eq(teacherAssignmentsTable.classId, input.classId),
      eq(teacherAssignmentsTable.status, "active"),
    ];

    const [assignment] = await db
      .select({ id: teacherAssignmentsTable.id })
      .from(teacherAssignmentsTable)
      .where(and(...assignmentConditions))
      .limit(1);

    if (!assignment) {
      throw new Error("NOT_ASSIGNED");
    }
  }

  const id = uuidv4();
  const code = String(Math.floor(100000 + Math.random() * 900000)).replace(/(\d{3})(\d{3})/, "$1 $2");

  await db.insert(classSessionsTable).values({
    id,
    teacherId: effectiveTeacherId!,
    classId: input.classId,
    subjectId: input.subjectId ?? null,
    status: "ACTIVE",
    code,
    startTime: new Date(),
  });

  return { id, code, status: "ACTIVE" as const };
}

/**
 * Transition a session to a new status.
 * Enforces the state machine.
 * When ending a session: seals attendance, marks unverified students as absent, revokes codes.
 */
export async function transitionSession(sessionId: string, newStatus: string, teacherId?: string) {
  const [session] = await db
    .select()
    .from(classSessionsTable)
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  // Ownership check — only the session's teacher or admin can change it
  if (teacherId && session.teacherId !== teacherId) {
    throw new Error("NOT_SESSION_OWNER");
  }

  // State machine enforcement
  const allowedTransitions = SESSION_TRANSITIONS[session.status] ?? [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error("INVALID_TRANSITION");
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === "ENDED" || newStatus === "CANCELLED") {
    updates.endTime = new Date();
  }

  await db
    .update(classSessionsTable)
    .set(updates)
    .where(eq(classSessionsTable.id, sessionId));

  // If ending session, seal attendance:
  if (newStatus === "ENDED") {
    try {
      // 1. Mark unverified enrolled students as absent
      const enrolled = await db
        .select({ studentId: enrollmentsTable.studentId })
        .from(enrollmentsTable)
        .where(and(
          eq(enrollmentsTable.classId, session.classId),
          eq(enrollmentsTable.status, "active")
        ));

      // Also get students assigned directly to class
      const directStudents = await db
        .select({ studentId: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.classId, session.classId));

      const allStudentIds = Array.from(new Set([
        ...enrolled.map(e => e.studentId),
        ...directStudents.map(s => s.studentId),
      ]));

      if (allStudentIds.length > 0) {
        const existingAttendance = await db
          .select({ studentId: attendanceTable.studentId })
          .from(attendanceTable)
          .where(eq(attendanceTable.sessionId, sessionId));

        const attendedSet = new Set(existingAttendance.map(a => a.studentId));
        const absentStudentIds = allStudentIds.filter(sid => !attendedSet.has(sid));

        for (const absentStudentId of absentStudentIds) {
          await db.insert(attendanceTable).values({
            id: uuidv4(),
            sessionId,
            studentId: absentStudentId,
            classId: session.classId,
            subjectId: session.subjectId ?? null,
            status: "Absent",
            verified: false,
            verificationMethod: "Auto Absent (Session Ended)",
            markedAt: new Date(),
          });
        }
      }

      // 2. Revoke active QR & security codes
      clearSessionQR(sessionId);
      clearSessionSecurityCode(sessionId);

      // 3. Process any expired or pending rechecks
      await processExpiredRechecks(sessionId);

      // 4. Send SSE session ended event
      sendSessionEnded(sessionId);
    } catch (sealError) {
      logger.error({ sealError, sessionId }, "Error sealing session attendance");
    }
  }

  return { id: sessionId, status: newStatus };
}

/**
 * Get live statistics for a session.
 */
export async function getSessionLiveStats(sessionId: string) {
  const [session] = await db
    .select()
    .from(classSessionsTable)
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  if (!session) return null;

  const attendance = await db
    .select({
      id: attendanceTable.id,
      status: attendanceTable.status,
      verified: attendanceTable.verified,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.sessionId, sessionId));

  // Count enrolled students
  const enrolled = await db
    .select({ studentId: enrollmentsTable.studentId })
    .from(enrollmentsTable)
    .where(and(
      eq(enrollmentsTable.classId, session.classId),
      eq(enrollmentsTable.status, "active")
    ));

  const totalEnrolled = enrolled.length;
  const present = attendance.filter(a => a.status === "Present").length;
  const late = attendance.filter(a => a.status === "Late").length;
  const absent = attendance.filter(a => a.status === "Absent").length;
  const excused = attendance.filter(a => a.status === "Excused").length;
  const rate = totalEnrolled > 0 ? Math.round(((present + late) / totalEnrolled) * 1000) / 10 : 0;

  // Count risk events for this session
  const riskEvents = await db
    .select({ id: riskEventsTable.id })
    .from(riskEventsTable)
    .where(eq(riskEventsTable.sessionId, sessionId));

  return {
    sessionId,
    status: session.status,
    totalEnrolled,
    present,
    late,
    absent,
    excused,
    rate,
    riskEventCount: riskEvents.length,
    recordedCount: attendance.length,
  };
}

/**
 * Get all sessions (admin view).
 */
export async function getAllSessions() {
  return db
    .select({
      id: classSessionsTable.id,
      teacherId: classSessionsTable.teacherId,
      classId: classSessionsTable.classId,
      subjectId: classSessionsTable.subjectId,
      status: classSessionsTable.status,
      code: classSessionsTable.code,
      startTime: classSessionsTable.startTime,
      endTime: classSessionsTable.endTime,
      className: classesTable.name,
      classSection: classesTable.section,
      classRoom: classesTable.room,
    })
    .from(classSessionsTable)
    .leftJoin(classesTable, eq(classSessionsTable.classId, classesTable.id))
    .orderBy(desc(classSessionsTable.createdAt));
}

/**
 * Get sessions for a specific teacher (only their own).
 */
export async function getSessionsForTeacher(teacherId: string) {
  return db
    .select({
      id: classSessionsTable.id,
      teacherId: classSessionsTable.teacherId,
      classId: classSessionsTable.classId,
      subjectId: classSessionsTable.subjectId,
      status: classSessionsTable.status,
      code: classSessionsTable.code,
      startTime: classSessionsTable.startTime,
      endTime: classSessionsTable.endTime,
      className: classesTable.name,
      classSection: classesTable.section,
      classRoom: classesTable.room,
    })
    .from(classSessionsTable)
    .leftJoin(classesTable, eq(classSessionsTable.classId, classesTable.id))
    .where(eq(classSessionsTable.teacherId, teacherId))
    .orderBy(desc(classSessionsTable.createdAt));
}

/**
 * Get a single session by ID.
 */
export async function getSessionById(sessionId: string) {
  const [session] = await db
    .select({
      id: classSessionsTable.id,
      teacherId: classSessionsTable.teacherId,
      classId: classSessionsTable.classId,
      subjectId: classSessionsTable.subjectId,
      status: classSessionsTable.status,
      code: classSessionsTable.code,
      startTime: classSessionsTable.startTime,
      endTime: classSessionsTable.endTime,
      className: classesTable.name,
      classSection: classesTable.section,
      classRoom: classesTable.room,
    })
    .from(classSessionsTable)
    .leftJoin(classesTable, eq(classSessionsTable.classId, classesTable.id))
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  return session ?? null;
}

/**
 * Get active session for a specific class (student use).
 */
export async function getActiveSessionForClass(classId: string) {
  const [session] = await db
    .select({
      id: classSessionsTable.id,
      classId: classSessionsTable.classId,
      status: classSessionsTable.status,
      code: classSessionsTable.code,
      startTime: classSessionsTable.startTime,
    })
    .from(classSessionsTable)
    .where(and(
      eq(classSessionsTable.classId, classId),
      eq(classSessionsTable.status, "ACTIVE")
    ))
    .limit(1);

  return session ?? null;
}

/**
 * Verify session is ACTIVE (for attendance operations).
 */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const [session] = await db
    .select({ status: classSessionsTable.status })
    .from(classSessionsTable)
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  return session?.status === "ACTIVE";
}

/**
 * Verify teacher owns a specific session.
 */
export async function isSessionOwnedByTeacher(sessionId: string, teacherId: string): Promise<boolean> {
  const [session] = await db
    .select({ teacherId: classSessionsTable.teacherId })
    .from(classSessionsTable)
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  return session?.teacherId === teacherId;
}
