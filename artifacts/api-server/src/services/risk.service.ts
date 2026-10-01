/**
 * Risk Engine — structured security event logging and risk scoring.
 *
 * Scoring rules:
 * 0–30 = VERIFIED / LOW RISK
 * 31–60 = REVIEW
 * 61+ = HIGH RISK / BLOCK OR MANUAL VERIFICATION
 *
 * Risk scoring avoids obvious false positives.
 * A risk score NEVER silently alters attendance without a documented rule.
 * No GPS/Wi-Fi/Bluetooth/IP-location attendance dependency.
 */
import { db } from "@workspace/db";
import { riskEventsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";
import { createNotification } from "./notification.service";

// Configurable risk scoring rules
export const RISK_SCORES: Record<string, { points: number; severity: "High" | "Medium" | "Low" }> = {
  FAILED_SECURITY_CODE: { points: 5, severity: "Low" },
  REPEATED_FAILED_CODE: { points: 15, severity: "Medium" },
  EXPIRED_QR_USED: { points: 5, severity: "Low" },
  INVALID_QR_SIGNATURE: { points: 20, severity: "Medium" },
  REPLAY_ATTEMPT: { points: 30, severity: "High" },
  DUPLICATE_ATTENDANCE_ATTEMPT: { points: 10, severity: "Low" },
  FAILED_WEBAUTHN: { points: 15, severity: "Medium" },
  EXPIRED_WEBAUTHN_CHALLENGE: { points: 5, severity: "Low" },
  WRONG_CREDENTIAL: { points: 25, severity: "High" },
  MISSED_RECHECK: { points: 20, severity: "Medium" },
  FAILED_RECHECK: { points: 10, severity: "Low" },
  RATE_LIMIT_HIT: { points: 25, severity: "Medium" },
  INVALID_SESSION_ACCESS: { points: 15, severity: "Medium" },
  UNAUTHORIZED_ACCESS_ATTEMPT: { points: 30, severity: "High" },
};

export type RiskEventType = keyof typeof RISK_SCORES;

export interface CreateRiskEventInput {
  userId: string;
  sessionId?: string;
  eventType: RiskEventType;
  reason?: string;
  deviceFingerprint?: string;
}

/**
 * Create a risk event with automatic scoring.
 */
export async function createRiskEvent(input: CreateRiskEventInput): Promise<string> {
  const scoring = RISK_SCORES[input.eventType];
  if (!scoring) {
    logger.warn({ eventType: input.eventType }, "Unknown risk event type");
    return "";
  }

  const id = uuidv4();
  const eventDescription = formatEventDescription(input.eventType, input.reason);

  await db.insert(riskEventsTable).values({
    id,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    event: eventDescription,
    severity: scoring.severity,
    riskScore: scoring.points,
    status: "Needs review",
    reason: input.reason ?? null,
    deviceFingerprint: input.deviceFingerprint ?? null,
    ipLocation: null,
  });

  // If high severity, create a notification for the teacher (via session lookup)
  if (scoring.severity === "High") {
    logger.warn({
      userId: input.userId,
      eventType: input.eventType,
      riskScore: scoring.points,
    }, "High severity risk event created");
  }

  return id;
}

/**
 * Get risk events for a session (teacher view).
 */
export async function getRiskEventsForSession(sessionId: string) {
  return db
    .select()
    .from(riskEventsTable)
    .where(eq(riskEventsTable.sessionId, sessionId))
    .orderBy(desc(riskEventsTable.createdAt));
}

/**
 * Get risk events for a user (admin view).
 */
export async function getRiskEventsForUser(userId: string) {
  return db
    .select()
    .from(riskEventsTable)
    .where(eq(riskEventsTable.userId, userId))
    .orderBy(desc(riskEventsTable.createdAt));
}

/**
 * Get all risk events (admin view).
 */
export async function getAllRiskEvents(limit = 200, offset = 0) {
  return db
    .select()
    .from(riskEventsTable)
    .orderBy(desc(riskEventsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Update risk event status (reviewed / dismissed).
 */
export async function updateRiskEventStatus(
  eventId: string,
  status: "Reviewed" | "Dismissed"
) {
  await db
    .update(riskEventsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(riskEventsTable.id, eventId));
}

/**
 * Calculate cumulative risk score for a user in a session.
 */
export async function getUserSessionRiskScore(userId: string, sessionId: string): Promise<number> {
  const events = await db
    .select({ riskScore: riskEventsTable.riskScore })
    .from(riskEventsTable)
    .where(and(
      eq(riskEventsTable.userId, userId),
      eq(riskEventsTable.sessionId, sessionId)
    ));

  return events.reduce((sum, e) => sum + e.riskScore, 0);
}

/**
 * Format a human-readable event description.
 */
function formatEventDescription(eventType: string, reason?: string): string {
  const descriptions: Record<string, string> = {
    FAILED_SECURITY_CODE: "Failed security code attempt",
    REPEATED_FAILED_CODE: "Multiple failed security code attempts",
    EXPIRED_QR_USED: "Used expired QR code",
    INVALID_QR_SIGNATURE: "Attempted to use tampered QR code",
    REPLAY_ATTEMPT: "Attempted to replay a used verification token",
    DUPLICATE_ATTENDANCE_ATTEMPT: "Duplicate attendance marking attempt",
    FAILED_WEBAUTHN: "Failed passkey verification",
    EXPIRED_WEBAUTHN_CHALLENGE: "Used expired passkey challenge",
    WRONG_CREDENTIAL: "Used credential not belonging to this student",
    MISSED_RECHECK: "Missed mid-class re-check verification",
    FAILED_RECHECK: "Failed mid-class re-check",
    RATE_LIMIT_HIT: "Exceeded rate limit for verification attempts",
    INVALID_SESSION_ACCESS: "Attempted to access invalid or unauthorized session",
    UNAUTHORIZED_ACCESS_ATTEMPT: "Unauthorized access attempt",
  };

  let description = descriptions[eventType] ?? eventType;
  if (reason) {
    description += `: ${reason}`;
  }
  return description;
}

/**
 * Get risk level classification from score.
 */
export function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score <= 30) return "low";
  if (score <= 60) return "medium";
  return "high";
}
