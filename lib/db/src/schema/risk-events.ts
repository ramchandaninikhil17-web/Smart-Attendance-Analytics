import { pgTable, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { classSessionsTable } from "./class-sessions";

export const riskSeverityEnum = pgEnum("risk_severity", ["High", "Medium", "Low"]);
export const riskStatusEnum = pgEnum("risk_status", ["Needs review", "Reviewed", "Dismissed"]);

export const riskEventsTable = pgTable("risk_events", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").references(() => usersTable.id),
  sessionId: text("session_id").references(() => classSessionsTable.id),
  event: text("event").notNull(),
  severity: riskSeverityEnum("severity").notNull(),
  riskScore: integer("risk_score").notNull().default(0),
  status: riskStatusEnum("status").notNull().default("Needs review"),
  reason: text("reason"),
  deviceFingerprint: text("device_fingerprint"),
  ipLocation: text("ip_location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRiskEventSchema = createInsertSchema(riskEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRiskEvent = z.infer<typeof insertRiskEventSchema>;
export type RiskEvent = typeof riskEventsTable.$inferSelect;
