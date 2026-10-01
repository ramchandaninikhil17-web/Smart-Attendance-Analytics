/**
 * Re-check Service — random mid-class spot verification.
 *
 * - Timing is unpredictable (server picks random window)
 * - Student receives a notification to re-verify
 * - Must complete within configured time window
 * - Missed/failed re-checks create risk events
 * - Does NOT automatically mark absent for network issues
 */
import { db } from "@workspace/db";
import { recheckRequestsTable, attendanceTable, studentsTable, enrollmentsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createRiskEvent } from "./risk.service";
import { createNotification } from "./notification.service";
import { logger } from "../lib/logger";

const RECHECK_WINDOW_SECONDS = 120; // 2 minutes to complete re-check
const MIN_RECHECK_DELAY_MS = 10 * 60 * 1000; // 10 minutes into session minimum
const MAX_RECHECK_DELAY_MS = 40 * 60 * 1000; // 40 minutes into session maximum

/**
 * Initiate a random re-check for students in an active session.
 * Called by the session engine at a random time during the lecture.
 */
export async function initiateRecheck(
  sessionId: string,
  classId: string,
  prompt: string = "Please verify your attendance"
): Promise<{ recheckIds: string[]; studentIds: string[] }> {
  // Get all students with verified attendance in this session
  const attendedStudents = await db
    .select({ studentId: attendanceTable.studentId })
    .from(attendanceTable)
    .where(and(
      eq(attendanceTable.sessionId, sessionId),
      eq(attendanceTable.status, "Present"),
      eq(attendanceTable.verified, true)
    ));

  const studentIds = attendedStudents.map((s) => s.studentId);
  if (studentIds.length === 0) return { recheckIds: [], studentIds: [] };

  const expiresAt = new Date(Date.now() + RECHECK_WINDOW_SECONDS * 1000);
  const recheckIds: string[] = [];

  for (const studentId of studentIds) {
    const recheckId = uuidv4();
    await db.insert(recheckRequestsTable).values({
      id: recheckId,
      sessionId,
      studentId,
      status: "requested",
      prompt,
      expiresAt,
    });
    recheckIds.push(recheckId);

    // Get the student's user ID for notification
    const [student] = await db
      .select({ userId: studentsTable.userId })
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId))
      .limit(1);

    if (student) {
      await createNotification({
        userId: student.userId,
        title: "Re-check Required",
        body: prompt,
        category: "Recheck",
      });
    }
  }

  logger.info({
    sessionId,
    studentCount: studentIds.length,
    expiresAt: expiresAt.toISOString(),
  }, "Re-check initiated");

  return { recheckIds, studentIds };
}

/**
 * Complete a re-check for a student.
 */
export async function completeRecheck(
  recheckId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const [recheck] = await db
    .select()
    .from(recheckRequestsTable)
    .where(and(
      eq(recheckRequestsTable.id, recheckId),
      eq(recheckRequestsTable.studentId, studentId)
    ))
    .limit(1);

  if (!recheck) {
    return { success: false, error: "Re-check request not found." };
  }

  if (recheck.status === "completed") {
    return { success: false, error: "Re-check already completed." };
  }

  if (recheck.status === "expired" || recheck.expiresAt.getTime() < Date.now()) {
    // Mark as expired if not already
    if (recheck.status !== "expired") {
      await db.update(recheckRequestsTable)
        .set({ status: "expired" })
        .where(eq(recheckRequestsTable.id, recheckId));
    }
    return { success: false, error: "Re-check window has expired." };
  }

  await db.update(recheckRequestsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(recheckRequestsTable.id, recheckId));

  return { success: true };
}

/**
 * Process expired re-checks — creates risk events for missed verifications.
 * Should be called periodically.
 */
export async function processExpiredRechecks(sessionId: string): Promise<number> {
  const now = new Date();
  const expired = await db
    .select()
    .from(recheckRequestsTable)
    .where(and(
      eq(recheckRequestsTable.sessionId, sessionId),
      eq(recheckRequestsTable.status, "requested")
    ));

  let processedCount = 0;

  for (const recheck of expired) {
    if (recheck.expiresAt.getTime() < now.getTime()) {
      await db.update(recheckRequestsTable)
        .set({ status: "missed" })
        .where(eq(recheckRequestsTable.id, recheck.id));

      // Get user ID for risk event
      const [student] = await db
        .select({ userId: studentsTable.userId })
        .from(studentsTable)
        .where(eq(studentsTable.id, recheck.studentId))
        .limit(1);

      if (student) {
        await createRiskEvent({
          userId: student.userId,
          sessionId,
          eventType: "MISSED_RECHECK",
          reason: "Did not complete mid-class re-check within the time window",
        });
      }

      processedCount++;
    }
  }

  return processedCount;
}

/**
 * Get pending re-checks for a student.
 */
export async function getPendingRechecksForStudent(studentId: string) {
  return db
    .select()
    .from(recheckRequestsTable)
    .where(and(
      eq(recheckRequestsTable.studentId, studentId),
      eq(recheckRequestsTable.status, "requested")
    ));
}

/**
 * Get all re-checks for a session (teacher view).
 */
export async function getRechecksForSession(sessionId: string) {
  return db
    .select()
    .from(recheckRequestsTable)
    .where(eq(recheckRequestsTable.sessionId, sessionId));
}

/**
 * Generate a random re-check delay time (in ms from session start).
 */
export function getRandomRecheckDelay(): number {
  const range = MAX_RECHECK_DELAY_MS - MIN_RECHECK_DELAY_MS;
  return MIN_RECHECK_DELAY_MS + Math.floor(Math.random() * range);
}
