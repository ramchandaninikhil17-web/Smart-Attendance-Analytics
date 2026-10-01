import { pgTable, text, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classSessionsTable } from "./class-sessions";
import { studentsTable } from "./students";
import { classesTable } from "./classes";
import { subjectsTable } from "./subjects";

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "Present",
  "Late",
  "Absent",
  "Excused",
]);

export const attendanceTable = pgTable("attendance", {
  id: text("id").primaryKey(), // UUID
  sessionId: text("session_id").notNull().references(() => classSessionsTable.id),
  studentId: text("student_id").notNull().references(() => studentsTable.id),
  classId: text("class_id").notNull().references(() => classesTable.id),
  subjectId: text("subject_id").references(() => subjectsTable.id),
  status: attendanceStatusEnum("status").notNull(),
  verified: boolean("verified").notNull().default(false),
  verificationMethod: text("verification_method"), // 'QR + Rotating Code', 'Passkey (WebAuthn)', 'Spot Check Verified', 'Manual Override'
  riskScore: integer("risk_score").default(0),
  markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
  markedBy: text("marked_by"), // user ID of who marked (teacher for manual, student for self-verify)
  metadata: text("metadata"), // JSON string for extra verification data
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
export type AttendanceStatus = "Present" | "Late" | "Absent" | "Excused";
