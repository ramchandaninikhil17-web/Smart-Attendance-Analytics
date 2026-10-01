/**
 * Attendance Correction Service — audited modification of authoritative records.
 *
 * Every correction stores: old value, new value, actor, reason, timestamp.
 * History is never overwritten without traceability.
 */
import { db } from "@workspace/db";
import { attendanceTable, attendanceCorrectionTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createAuditLog } from "./audit.service";
import { logger } from "../lib/logger";

export interface CorrectionInput {
  attendanceId: string;
  newStatus: "Present" | "Late" | "Absent" | "Excused";
  reason: string;
  actorId: string;
  actorRole: string;
  actorName: string;
}

/**
 * Apply an attendance correction with full audit trail.
 */
export async function correctAttendance(input: CorrectionInput): Promise<{
  success: boolean;
  correctionId?: string;
  error?: string;
}> {
  // Get current record
  const [current] = await db
    .select({
      id: attendanceTable.id,
      status: attendanceTable.status,
      studentId: attendanceTable.studentId,
      sessionId: attendanceTable.sessionId,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.id, input.attendanceId))
    .limit(1);

  if (!current) {
    return { success: false, error: "Attendance record not found." };
  }

  if (current.status === input.newStatus) {
    return { success: false, error: "No change in status." };
  }

  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: "A reason is required for corrections." };
  }

  // Create correction record
  const correctionId = uuidv4();
  await db.insert(attendanceCorrectionTable).values({
    id: correctionId,
    attendanceId: input.attendanceId,
    oldStatus: current.status,
    newStatus: input.newStatus,
    reason: input.reason.trim(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    actorName: input.actorName,
  });

  // Update the attendance record
  await db
    .update(attendanceTable)
    .set({
      status: input.newStatus,
      verificationMethod: "Manual Override",
      updatedAt: new Date(),
    })
    .where(eq(attendanceTable.id, input.attendanceId));

  // Audit log
  await createAuditLog({
    actorId: input.actorId,
    actorRole: input.actorRole,
    actorName: input.actorName,
    action: `Corrected attendance from ${current.status} to ${input.newStatus}`,
    targetType: "attendance",
    targetId: input.attendanceId,
    severity: "Warning",
    metadata: {
      oldStatus: current.status,
      newStatus: input.newStatus,
      reason: input.reason,
      studentId: current.studentId,
      sessionId: current.sessionId,
    },
  });

  logger.info({
    correctionId,
    attendanceId: input.attendanceId,
    oldStatus: current.status,
    newStatus: input.newStatus,
    actorId: input.actorId,
  }, "Attendance corrected");

  return { success: true, correctionId };
}

/**
 * Get correction history for an attendance record.
 */
export async function getCorrectionHistory(attendanceId: string) {
  return db
    .select()
    .from(attendanceCorrectionTable)
    .where(eq(attendanceCorrectionTable.attendanceId, attendanceId));
}

/**
 * Get all corrections (with pagination).
 */
export async function getAllCorrections(limit: number = 100, offset: number = 0) {
  return db
    .select()
    .from(attendanceCorrectionTable)
    .orderBy(attendanceCorrectionTable.createdAt)
    .limit(limit)
    .offset(offset);
}
