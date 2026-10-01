/**
 * Authentication routes — login, logout, profile, token refresh.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { sendSuccess, sendBadRequest, sendError, sendInternalError } from "../lib/responses";
import { ERROR_CODES, getPermissionsForRole, type Role } from "../lib/constants";
import * as authService from "../services/auth.service";
import { createAuditLog } from "../services/audit.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * POST /auth/login
 * Authenticate with email + password. Returns JWT + user profile + permissions.
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendBadRequest(res, "Email and password are required.");
      return;
    }

    const result = await authService.login(email, password);

    if (!result) {
      await createAuditLog({
        actorId: "unknown",
        actorRole: "unknown",
        actorName: email,
        action: `Failed login attempt for ${email}`,
        severity: "Warning",
        success: false,
        req,
      });

      sendError(res, 401, ERROR_CODES.INVALID_CREDENTIALS, "Invalid email or password.");
      return;
    }

    await createAuditLog({
      actorId: result.user.id,
      actorRole: result.user.role,
      actorName: result.user.name,
      action: `Successful login`,
      severity: "Info",
      success: true,
      req,
    });

    sendSuccess(res, result, "Login successful.");
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "INACTIVE_ACCOUNT") {
      sendError(res, 403, ERROR_CODES.INACTIVE_ACCOUNT, "Account is deactivated. Contact your administrator.");
      return;
    }
    logger.error({ error }, "Login error");
    sendInternalError(res);
  }
});

/**
 * GET /auth/me
 * Get current user profile + permissions. Requires authentication.
 */
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const permissions = getPermissionsForRole(user.role);

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        department: user.department,
        institute: user.institute,
      },
      permissions,
    });
  } catch (error) {
    logger.error({ error }, "Get profile error");
    sendInternalError(res);
  }
});

/**
 * POST /auth/logout
 * Logout (client should discard token). Audited.
 */
router.post("/logout", authenticate, async (req: Request, res: Response) => {
  try {
    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: "User logged out",
      severity: "Info",
      success: true,
      req,
    });

    sendSuccess(res, null, "Logged out successfully.");
  } catch (error) {
    logger.error({ error }, "Logout error");
    sendInternalError(res);
  }
});

/**
 * PUT /auth/profile
 * Update own profile (name, avatar). Requires authentication.
 */
router.put("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const { name, avatar, department } = req.body;

    await authService.updateUserProfile(req.user!.id, { name, avatar, department });

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: "Updated own profile",
      targetType: "user",
      targetId: req.user!.id,
      severity: "Info",
      req,
    });

    sendSuccess(res, null, "Profile updated successfully.");
  } catch (error) {
    logger.error({ error }, "Profile update error");
    sendInternalError(res);
  }
});

/**
 * PUT /auth/password
 * Change own password. Requires authentication + current password.
 */
router.put("/password", authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      sendBadRequest(res, "Current and new password are required.");
      return;
    }

    if (newPassword.length < 8) {
      sendBadRequest(res, "New password must be at least 8 characters.");
      return;
    }

    const changed = await authService.changePassword(req.user!.id, currentPassword, newPassword);

    if (!changed) {
      sendError(res, 401, ERROR_CODES.INVALID_CREDENTIALS, "Current password is incorrect.");
      return;
    }

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: "Changed own password",
      targetType: "user",
      targetId: req.user!.id,
      severity: "Warning",
      req,
    });

    sendSuccess(res, null, "Password changed successfully.");
  } catch (error) {
    logger.error({ error }, "Password change error");
    sendInternalError(res);
  }
});

export default router;
