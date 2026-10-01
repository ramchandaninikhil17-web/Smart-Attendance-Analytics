/**
 * Attendance Verification Pipeline — THE authoritative backend verification service.
 *
 * All attendance marking MUST flow through this pipeline.
 * Validates in secure order (see step numbers).
 *
 * Student submits: session + QR token + security code + authenticated identity + WebAuthn
 * The server validates everything before creating attendance.
 */
import { db } from "@workspace/db";
import {
  attendanceTable, classSessionsTable, studentsTable, enrollmentsTable
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { validateQRToken } from "./qr.service";
import { validateSecurityCode } from "./security-code.service";
import { verifyPasskeyAuth, hasPasskeys } from "./webauthn.service";
import { checkRateLimit, recordFailedAttempt } from "./rate-limiter.service";
import { createRiskEvent, getUserSessionRiskScore, getRiskLevel } from "./risk.service";
import { createAuditLog } from "./audit.service";
import { sendAttendanceUpdate } from "./realtime.service";
import { getSessionLiveStats } from "./session.service";
import { usersTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";

export interface VerifyAttendanceInput {
  userId: string;         // authenticated user ID
  sessionId: string;      // target session
  qrToken: string;        // scanned QR token
  securityCode: string;   // entered security code
  webauthnResponse?: any; // WebAuthn assertion (optional if no passkeys registered)
}

export interface VerificationResult {
  success: boolean;
  attendanceId?: string;
  message: string;
  riskScore?: number;
}

/**
 * THE verification pipeline. Every step must succeed.
 */
export async function verifyAttendance(input: VerifyAttendanceInput): Promise<VerificationResult> {
  const { userId, sessionId, qrToken, securityCode, webauthnResponse } = input;

  // === Step 1: User must be authenticated (enforced at route level, but double-check) ===
  if (!userId) {
    return fail("Authentication required.");
  }

  // === Step 13: Rate limit check (moved early to prevent abuse) ===
  const rateCheck = checkRateLimit(userId, "verify_attendance");
  if (!rateCheck.allowed) {
    await createRiskEvent({
      userId,
      sessionId,
      eventType: "RATE_LIMIT_HIT",
      reason: `Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)}s`,
    });
    return fail("Too many verification attempts. Please wait before trying again.");
  }

  // === Step 2-3: User is active and is a STUDENT (enforced at route level via authorize middleware) ===

  // === Step 4: Student account exists ===
  const [student] = await db
    .select({
      id: studentsTable.id,
      classId: studentsTable.classId,
      status: studentsTable.status,
      name: usersTable.name,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.userId, userId))
    .limit(1);

  if (!student) {
    recordFailedAttempt(userId, "verify_attendance");
    return fail("Student account not found.");
  }

  // === Step 6: Session exists ===
  const [session] = await db
    .select({
      id: classSessionsTable.id,
      classId: classSessionsTable.classId,
      subjectId: classSessionsTable.subjectId,
      status: classSessionsTable.status,
      teacherId: classSessionsTable.teacherId,
    })
    .from(classSessionsTable)
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    recordFailedAttempt(userId, "verify_attendance");
    await createRiskEvent({
      userId,
      sessionId,
      eventType: "INVALID_SESSION_ACCESS",
      reason: "Session not found",
    });
    return fail("Session not found.");
  }

  // === Step 7: Session is ACTIVE ===
  if (session.status !== "ACTIVE") {
    recordFailedAttempt(userId, "verify_attendance");
    return fail("Session is not currently active.");
  }

  // === Step 5: Student is enrolled in the session's class ===
  const [enrollment] = await db
    .select({ id: enrollmentsTable.id })
    .from(enrollmentsTable)
    .where(and(
      eq(enrollmentsTable.studentId, student.id),
      eq(enrollmentsTable.classId, session.classId),
      eq(enrollmentsTable.status, "active")
    ))
    .limit(1);

  if (!enrollment) {
    recordFailedAttempt(userId, "verify_attendance");
    return fail("You are not enrolled in this class.");
  }

  // === Step 8-10: QR token validation (valid, not expired, not replayed) ===
  const qrResult = await validateQRToken(qrToken, sessionId, userId);
  if (!qrResult.valid) {
    recordFailedAttempt(userId, "qr_verify");

    // Determine risk event type based on QR error
    let eventType: "EXPIRED_QR_USED" | "INVALID_QR_SIGNATURE" | "REPLAY_ATTEMPT" = "EXPIRED_QR_USED";
    if (qrResult.error?.includes("signature")) eventType = "INVALID_QR_SIGNATURE";
    if (qrResult.error?.includes("already used")) eventType = "REPLAY_ATTEMPT";

    await createRiskEvent({
      userId,
      sessionId,
      eventType,
      reason: qrResult.error,
    });

    return fail("QR code verification failed. Please scan the current QR code.");
  }

  // === Step 11-12: Security code validation (correct and current) ===
  const codeResult = validateSecurityCode(sessionId, securityCode);
  if (!codeResult.valid) {
    recordFailedAttempt(userId, "security_code");

    await createRiskEvent({
      userId,
      sessionId,
      eventType: "FAILED_SECURITY_CODE",
      reason: codeResult.error,
    });

    return fail("Security code verification failed. Please enter the current code.");
  }

  // === Step 14-17: WebAuthn challenge validation (if passkeys registered) ===
  const hasRegisteredPasskeys = await hasPasskeys(userId);
  if (hasRegisteredPasskeys) {
    if (!webauthnResponse) {
      return fail("Passkey verification required. Please complete biometric authentication.");
    }

    const webauthnResult = await verifyPasskeyAuth(userId, sessionId, webauthnResponse);
    if (!webauthnResult.valid) {
      recordFailedAttempt(userId, "webauthn");

      let eventType: "FAILED_WEBAUTHN" | "EXPIRED_WEBAUTHN_CHALLENGE" | "WRONG_CREDENTIAL" = "FAILED_WEBAUTHN";
      if (webauthnResult.error?.includes("expired")) eventType = "EXPIRED_WEBAUTHN_CHALLENGE";
      if (webauthnResult.error?.includes("not owned") || webauthnResult.error?.includes("not found")) eventType = "WRONG_CREDENTIAL";

      await createRiskEvent({
        userId,
        sessionId,
        eventType,
        reason: webauthnResult.error,
      });

      return fail("Passkey verification failed.");
    }
  }

  // === Step 18: Check for duplicate attendance ===
  const [existing] = await db
    .select({ id: attendanceTable.id })
    .from(attendanceTable)
    .where(and(
      eq(attendanceTable.sessionId, sessionId),
      eq(attendanceTable.studentId, student.id)
    ))
    .limit(1);

  if (existing) {
    await createRiskEvent({
      userId,
      sessionId,
      eventType: "DUPLICATE_ATTENDANCE_ATTEMPT",
    });
    return fail("Attendance already marked for this session.");
  }

  // === Step 19: Double-check session is still open ===
  const [currentSession] = await db
    .select({ status: classSessionsTable.status })
    .from(classSessionsTable)
    .where(eq(classSessionsTable.id, sessionId))
    .limit(1);

  if (currentSession?.status !== "ACTIVE") {
    return fail("Session has ended. Attendance cannot be recorded.");
  }

  // === Step 20: Create attendance record ===
  const riskScore = await getUserSessionRiskScore(userId, sessionId);

  const attendanceId = uuidv4();
  try {
    await db.insert(attendanceTable).values({
      id: attendanceId,
      sessionId,
      studentId: student.id,
      classId: session.classId,
      subjectId: session.subjectId ?? null,
      status: "Present",
      verified: true,
      verificationMethod: hasRegisteredPasskeys ? "Passkey (WebAuthn)" : "QR + Rotating Code",
      riskScore,
      markedBy: userId,
      markedAt: new Date(),
    });
  } catch (error: any) {
    // Handle unique constraint violation (race condition protection)
    if (error.code === "23505" || error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return fail("Attendance already marked for this session.");
    }
    logger.error({ error }, "Failed to create attendance record");
    return fail("Failed to record attendance. Please try again.");
  }

  // Audit the successful verification
  await createAuditLog({
    actorId: userId,
    actorRole: "STUDENT",
    actorName: "Student",
    action: `Verified attendance via ${hasRegisteredPasskeys ? "Passkey (WebAuthn)" : "QR + Rotating Code"}`,
    targetType: "attendance",
    targetId: attendanceId,
    severity: "Info",
  });

  logger.info({
    attendanceId,
    studentId: student.id,
    sessionId,
    riskScore,
    verificationMethod: hasRegisteredPasskeys ? "Passkey" : "QR+Code",
  }, "Attendance verified successfully");

  // Push realtime update to teacher's live session feed
  try {
    const liveStats = await getSessionLiveStats(sessionId);
    if (liveStats) {
      sendAttendanceUpdate(sessionId, {
        presentCount: liveStats.present,
        totalEnrolled: liveStats.totalEnrolled,
        latestStudentName: student.name,
        verificationMethod: hasRegisteredPasskeys ? "Passkey (WebAuthn)" : "Dynamic QR + Rotating Code",
        riskEvents: liveStats.riskEventCount,
      });
    }
  } catch (pushErr) {
    logger.warn({ pushErr, sessionId }, "Failed to push realtime attendance update");
  }

  return {
    success: true,
    attendanceId,
    message: "Attendance marked successfully.",
    riskScore,
  };
}

function fail(message: string): VerificationResult {
  return { success: false, message };
}
