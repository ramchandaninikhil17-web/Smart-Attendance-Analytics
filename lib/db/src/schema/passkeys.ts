import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const passkeysTable = pgTable("passkeys", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => usersTable.id),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  deviceName: text("device_name"),
  lastUsed: timestamp("last_used", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPasskeySchema = createInsertSchema(passkeysTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPasskey = z.infer<typeof insertPasskeySchema>;
export type Passkey = typeof passkeysTable.$inferSelect;
