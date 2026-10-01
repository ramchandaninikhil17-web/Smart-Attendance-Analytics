import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const classesTable = pgTable("classes", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  section: text("section").notNull(),
  semester: text("semester").notNull(),
  room: text("room"),
  institute: text("institute").notNull(), // CSPIT, DEPSTAR, CMPICA
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClassSchema = createInsertSchema(classesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClass = z.infer<typeof insertClassSchema>;
export type ClassRoom = typeof classesTable.$inferSelect;
