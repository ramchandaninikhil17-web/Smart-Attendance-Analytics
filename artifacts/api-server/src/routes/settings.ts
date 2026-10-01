/**
 * Settings routes — admin-managed system settings.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { ROLES } from "../lib/constants";
import { sendSuccess, sendBadRequest, sendInternalError } from "../lib/responses";
import { db } from "@workspace/db";
import { attendanceSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createAuditLog } from "../services/audit.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /settings
 * Get all settings. Any authenticated user can read settings.
 */
router.get("/", authenticate, async (_req: Request, res: Response) => {
  try {
    const settings = await db.select().from(attendanceSettingsTable);
    // Convert to a key-value object for easy frontend consumption
    const settingsObj: Record<string, string> = {};
    for (const s of settings) {
      settingsObj[s.key] = s.value;
    }
    sendSuccess(res, settingsObj);
  } catch (error) {
    logger.error({ error }, "Get settings error");
    sendInternalError(res);
  }
});

/**
 * PUT /settings
 * Update settings. Admin only.
 */
router.put("/", authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;

    for (const [key, value] of Object.entries(updates)) {
      const [existing] = await db
        .select({ id: attendanceSettingsTable.id })
        .from(attendanceSettingsTable)
        .where(eq(attendanceSettingsTable.key, key))
        .limit(1);

      if (existing) {
        await db
          .update(attendanceSettingsTable)
          .set({ value: String(value), updatedBy: req.user!.id, updatedAt: new Date() })
          .where(eq(attendanceSettingsTable.key, key));
      } else {
        await db.insert(attendanceSettingsTable).values({
          id: uuidv4(),
          key,
          value: String(value),
          updatedBy: req.user!.id,
        });
      }
    }

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: `Updated system settings: ${Object.keys(updates).join(", ")}`,
      targetType: "settings",
      severity: "Warning",
      req,
    });

    sendSuccess(res, null, "Settings updated.");
  } catch (error) {
    logger.error({ error }, "Update settings error");
    sendInternalError(res);
  }
});

export default router;
