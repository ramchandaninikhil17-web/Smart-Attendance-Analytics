import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { classesTable } from "./classes";
import { subjectsTable } from "./subjects";

export const teacherAssignmentsTable = pgTable("teacher_assignments", {
  id: text("id").primaryKey(), // UUID
  teacherId: text("teacher_id").notNull().references(() => teachersTable.id),
  classId: text("class_id").notNull().references(() => classesTable.id),
  subjectId: text("subject_id").references(() => subjectsTable.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeacherAssignmentSchema = createInsertSchema(teacherAssignmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTeacherAssignment = z.infer<typeof insertTeacherAssignmentSchema>;
export type TeacherAssignment = typeof teacherAssignmentsTable.$inferSelect;
