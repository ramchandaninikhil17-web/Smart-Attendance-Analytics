import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const studentsTable = pgTable("students", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => usersTable.id).unique(),
  studentId: text("student_id").notNull().unique(), // e.g. "22DCSE001"
  classId: text("class_id"), // FK to classes, nullable for initial creation
  attendancePercent: integer("attendance_percent").notNull().default(0),
  status: text("status").notNull().default("Active"), // Active, At risk, On leave
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
