import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceSettingsTable = pgTable("attendance_settings", {
  id: text("id").primaryKey(), // UUID
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSettingSchema = createInsertSchema(attendanceSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAttendanceSetting = z.infer<typeof insertAttendanceSettingSchema>;
export type AttendanceSetting = typeof attendanceSettingsTable.$inferSelect;
