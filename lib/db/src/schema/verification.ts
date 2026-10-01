import { pgTable, text, timestamp, boolean, integer, unique } from "drizzle-orm/pg-core";
import { classSessionsTable } from "./class-sessions";
import { usersTable } from "./users";

/**
 * Verification challenges — stores active QR tokens and WebAuthn challenges.
 * Each record is single-use. Replay detection is enforced by the `consumed` column.
 */
export const verificationChallengesTable = pgTable("verification_challenges", {
  id: text("id").primaryKey(), // UUID
  sessionId: text("session_id").notNull().references(() => classSessionsTable.id),
  type: text("type").notNull(), // "qr" | "webauthn_register" | "webauthn_auth"
  challenge: text("challenge").notNull(), // the cryptographic challenge/token
  consumed: boolean("consumed").notNull().default(false),
  consumedBy: text("consumed_by").references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Re-check requests — random mid-class spot checks.
 */
export const recheckRequestsTable = pgTable("recheck_requests", {
  id: text("id").primaryKey(), // UUID
  sessionId: text("session_id").notNull().references(() => classSessionsTable.id),
  studentId: text("student_id").notNull(),
  status: text("status").notNull().default("requested"), // requested | completed | expired | failed | missed
  prompt: text("prompt").notNull().default("Please verify your attendance"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Attendance corrections — audit trail for any attendance changes.
 */
export const attendanceCorrectionTable = pgTable("attendance_corrections", {
  id: text("id").primaryKey(), // UUID
  attendanceId: text("attendance_id").notNull(),
  oldStatus: text("old_status").notNull(),
  newStatus: text("new_status").notNull(),
  reason: text("reason").notNull(),
  actorId: text("actor_id").notNull().references(() => usersTable.id),
  actorRole: text("actor_role").notNull(),
  actorName: text("actor_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Rate limit tracking — tracks verification attempts per student per session.
 */
export const rateLimitTable = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  action: text("action").notNull(), // "verify_attendance" | "security_code" | "login"
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(1),
  lastAttempt: timestamp("last_attempt", { withTimezone: true }).notNull().defaultNow(),
});
