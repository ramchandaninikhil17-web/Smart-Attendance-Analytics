import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const teachersTable = pgTable("teachers", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => usersTable.id).unique(),
  department: text("department").notNull(),
  institute: text("institute").notNull(), // CSPIT, DEPSTAR, CMPICA
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeacherSchema = createInsertSchema(teachersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachersTable.$inferSelect;
