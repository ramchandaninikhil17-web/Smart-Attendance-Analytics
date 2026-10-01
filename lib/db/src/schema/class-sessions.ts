import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { classesTable } from "./classes";
import { subjectsTable } from "./subjects";

export const sessionStatusEnum = pgEnum("session_status", [
  "SCHEDULED",
  "ACTIVE",
  "ENDED",
  "CANCELLED",
]);

export const classSessionsTable = pgTable("class_sessions", {
  id: text("id").primaryKey(), // UUID
  teacherId: text("teacher_id").notNull().references(() => teachersTable.id),
  classId: text("class_id").notNull().references(() => classesTable.id),
  subjectId: text("subject_id").references(() => subjectsTable.id),
  status: sessionStatusEnum("status").notNull().default("SCHEDULED"),
  code: text("code"), // security/verification code for the session
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClassSessionSchema = createInsertSchema(classSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClassSession = z.infer<typeof insertClassSessionSchema>;
export type ClassSession = typeof classSessionsTable.$inferSelect;
export type SessionStatus = "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
