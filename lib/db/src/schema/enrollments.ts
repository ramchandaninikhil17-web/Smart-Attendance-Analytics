import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { classesTable } from "./classes";
import { subjectsTable } from "./subjects";

export const enrollmentsTable = pgTable("enrollments", {
  id: text("id").primaryKey(), // UUID
  studentId: text("student_id").notNull().references(() => studentsTable.id),
  classId: text("class_id").notNull().references(() => classesTable.id),
  subjectId: text("subject_id").references(() => subjectsTable.id),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("active"), // active, dropped, completed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnrollmentSchema = createInsertSchema(enrollmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollmentsTable.$inferSelect;
