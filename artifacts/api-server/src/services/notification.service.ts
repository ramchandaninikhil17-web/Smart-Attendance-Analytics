/**
 * Notification service — user-scoped notifications.
 */
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  category?: string;
}

/**
 * Create a notification for a specific user.
 */
export async function createNotification(input: CreateNotificationInput) {
  const id = uuidv4();
  await db.insert(notificationsTable).values({
    id,
    userId: input.userId,
    title: input.title,
    body: input.body,
    category: input.category ?? "General",
    isRead: false,
  });
  return { id };
}

/**
 * Get notifications for a specific user (owned only).
 */
export async function getNotificationsForUser(userId: string) {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt));
}

/**
 * Mark a notification as read (ownership enforced).
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(
      eq(notificationsTable.id, notificationId),
      eq(notificationsTable.userId, userId) // ownership check
    ));
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, userId));
}
