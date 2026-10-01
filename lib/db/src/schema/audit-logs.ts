import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditSeverityEnum = pgEnum("audit_severity", ["Info", "Warning", "Critical"]);

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey(), // UUID
  actorId: text("actor_id").notNull(), // user ID performing the action
  actorRole: text("actor_role").notNull(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"), // e.g. "session", "student", "attendance"
  targetId: text("target_id"),
  severity: auditSeverityEnum("severity").notNull().default("Info"),
  success: boolean("success").notNull().default(true),
  metadata: text("metadata"), // JSON string for additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
