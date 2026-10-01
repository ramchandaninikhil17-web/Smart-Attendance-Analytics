/**
 * Authorization middleware.
 * Provides role-based and permission-based access control.
 * ALWAYS used AFTER authentication middleware.
 */
import type { Request, Response, NextFunction } from "express";
import { sendForbidden } from "../lib/responses";
import { hasPermission, type Role, type Permission } from "../lib/constants";

/**
 * Require that the authenticated user has one of the specified roles.
 * Usage: authorize(ROLES.ADMIN, ROLES.TEACHER)
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendForbidden(res, "Authentication required before authorization.");
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(res, "You do not have the required role to access this resource.");
      return;
    }

    next();
  };
}

/**
 * Require that the authenticated user has ALL of the specified permissions.
 * Usage: requirePermissions(PERMISSIONS.TEACHER_SESSIONS_CREATE)
 */
export function requirePermissions(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendForbidden(res, "Authentication required before authorization.");
      return;
    }

    for (const perm of requiredPermissions) {
      if (!hasPermission(req.user.role, perm)) {
        sendForbidden(res, `Missing required permission: ${perm}`);
        return;
      }
    }

    next();
  };
}

/**
 * Require that the authenticated user has ANY of the specified permissions.
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendForbidden(res, "Authentication required before authorization.");
      return;
    }

    const hasAny = permissions.some((perm) => hasPermission(req.user!.role, perm));

    if (!hasAny) {
      sendForbidden(res, "You do not have permission to perform this action.");
      return;
    }

    next();
  };
}
