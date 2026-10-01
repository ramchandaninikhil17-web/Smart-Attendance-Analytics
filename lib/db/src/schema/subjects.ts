import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subjectsTable = pgTable("subjects", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  credits: integer("credits").notNull().default(4),
  threshold: integer("threshold").notNull().default(75), // minimum attendance %
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjectsTable.$inferSelect;
