/**
 * Verification routes — the student attendance verification pipeline.
 * All attendance marking flows through here.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { ROLES } from "../lib/constants";
import { sendSuccess, sendBadRequest, sendNotFound, sendError, sendInternalError } from "../lib/responses";
import { getParam } from "../lib/params";
import { ERROR_CODES } from "../lib/constants";
import { verifyAttendance } from "../services/verification-pipeline.service";
import * as webauthnService from "../services/webauthn.service";
import * as studentService from "../services/student.service";
import * as recheckService from "../services/recheck.service";
import * as sessionService from "../services/session.service";
import { createAuditLog } from "../services/audit.service";
import { createRiskEvent } from "../services/risk.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All verification routes require STUDENT role
router.use(authenticate, authorize(ROLES.STUDENT));

/**
 * POST /verify/attendance
 * THE attendance verification endpoint.
 * Requires: sessionId, qrToken, securityCode, optional webauthnResponse
 */
router.post("/attendance", async (req: Request, res: Response) => {
  try {
    const { sessionId, qrToken, securityCode, webauthnResponse } = req.body;

    if (!sessionId || !qrToken || !securityCode) {
      sendBadRequest(res, "sessionId, qrToken, and securityCode are required.");
      return;
    }

    const result = await verifyAttendance({
      userId: req.user!.id,
      sessionId,
      qrToken,
      securityCode,
      webauthnResponse,
    });

    if (result.success) {
      sendSuccess(res, {
        attendanceId: result.attendanceId,
        riskScore: result.riskScore,
      }, result.message);
    } else {
      sendBadRequest(res, result.message);
    }
  } catch (error) {
    logger.error({ error }, "Attendance verification error");
    sendInternalError(res);
  }
});

/**
 * GET /verify/active-session
 * Get the active session for the student's enrolled class.
 */
router.get("/active-session", async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student || !student.classId) {
      sendNotFound(res, "No active class assignment found.");
      return;
    }

    const session = await sessionService.getActiveSessionForClass(student.classId);
    if (!session) {
      sendSuccess(res, null, "No active session.");
      return;
    }

    // Don't expose the security code to the student via this endpoint
    sendSuccess(res, {
      id: session.id,
      classId: session.classId,
      status: session.status,
      startTime: session.startTime,
    });
  } catch (error) {
    logger.error({ error }, "Get active session error");
    sendInternalError(res);
  }
});

// ===== WEBAUTHN PASSKEY ROUTES =====

/**
 * POST /verify/passkey/register/options
 * Get WebAuthn registration options.
 */
router.post("/passkey/register/options", async (req: Request, res: Response) => {
  try {
    const options = await webauthnService.generatePasskeyRegistrationOptions(
      req.user!.id,
      req.user!.email,
      req.user!.name
    );

    sendSuccess(res, options);
  } catch (error) {
    logger.error({ error }, "Passkey registration options error");
    sendInternalError(res);
  }
});

/**
 * POST /verify/passkey/register/verify
 * Verify a WebAuthn registration response.
 */
router.post("/passkey/register/verify", async (req: Request, res: Response) => {
  try {
    const { response: registrationResponse, deviceName } = req.body;

    if (!registrationResponse) {
      sendBadRequest(res, "Registration response is required.");
      return;
    }

    const result = await webauthnService.verifyPasskeyRegistration(
      req.user!.id,
      registrationResponse,
      deviceName
    );

    if (result.success) {
      await createAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        actorName: req.user!.name,
        action: "Registered new passkey",
        targetType: "passkey",
        targetId: result.credentialId,
        severity: "Info",
      });

      sendSuccess(res, { credentialId: result.credentialId }, "Passkey registered successfully.");
    } else {
      sendBadRequest(res, result.error ?? "Registration failed.");
    }
  } catch (error) {
    logger.error({ error }, "Passkey registration verify error");
    sendInternalError(res);
  }
});

/**
 * POST /verify/passkey/auth/options
 * Get WebAuthn authentication options for a session.
 */
router.post("/passkey/auth/options", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      sendBadRequest(res, "sessionId is required.");
      return;
    }

    const options = await webauthnService.generatePasskeyAuthOptions(
      req.user!.id,
      sessionId
    );

    if (!options) {
      sendSuccess(res, null, "No passkeys registered.");
      return;
    }

    sendSuccess(res, options);
  } catch (error) {
    logger.error({ error }, "Passkey auth options error");
    sendInternalError(res);
  }
});

/**
 * GET /verify/passkeys
 * Get user's registered passkeys.
 */
router.get("/passkeys", async (req: Request, res: Response) => {
  try {
    const passkeys = await webauthnService.getUserPasskeys(req.user!.id);
    sendSuccess(res, passkeys);
  } catch (error) {
    logger.error({ error }, "Get passkeys error");
    sendInternalError(res);
  }
});

/**
 * DELETE /verify/passkeys/:id
 * Delete a passkey (ownership enforced).
 */
router.delete("/passkeys/:id", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const deleted = await webauthnService.deletePasskey(id, req.user!.id);

    if (!deleted) {
      sendNotFound(res, "Passkey not found or not owned by you.");
      return;
    }

    await createAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name,
      action: "Deleted passkey",
      targetType: "passkey",
      targetId: id,
      severity: "Warning",
    });

    sendSuccess(res, null, "Passkey deleted.");
  } catch (error) {
    logger.error({ error }, "Delete passkey error");
    sendInternalError(res);
  }
});

// ===== RE-CHECK ROUTES =====

/**
 * GET /verify/rechecks
 * Get pending re-checks for the student.
 */
router.get("/rechecks", async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    const rechecks = await recheckService.getPendingRechecksForStudent(student.id);
    sendSuccess(res, rechecks);
  } catch (error) {
    logger.error({ error }, "Get rechecks error");
    sendInternalError(res);
  }
});

/**
 * POST /verify/rechecks/:id/complete
 * Complete a re-check.
 */
router.post("/rechecks/:id/complete", async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const student = await studentService.getStudentByUserId(req.user!.id);
    if (!student) {
      sendNotFound(res, "Student profile not found.");
      return;
    }

    const result = await recheckService.completeRecheck(id, student.id);

    if (result.success) {
      sendSuccess(res, null, "Re-check completed successfully.");
    } else {
      sendBadRequest(res, result.error ?? "Re-check failed.");
    }
  } catch (error) {
    logger.error({ error }, "Complete recheck error");
    sendInternalError(res);
  }
});

export default router;
