/**
 * Authentication middleware.
 * Verifies JWT from Authorization header and attaches user to request.
 * Never trusts the role from the token alone — verifies against database.
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendUnauthorized, sendError } from "../lib/responses";
import { ERROR_CODES, type Role } from "../lib/constants";
import { logger } from "../lib/logger";

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "charusat-attendance-dev-secret-change-in-production")) {
  throw new Error("FATAL: JWT_SECRET environment variable is required and must be set to a secure string in production.");
}
const JWT_SECRET = process.env.JWT_SECRET || "charusat-attendance-dev-secret-change-in-production";
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || "24h";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  institute: string | null;
  avatar: string | null;
  isActive: boolean;
}

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token.
 */
export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: (TOKEN_EXPIRY as jwt.SignOptions["expiresIn"]) || "24h" });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Authentication middleware — required for all protected routes.
 * Validates the JWT, then confirms the user exists and is active in the database.
 * The role is ALWAYS determined server-side from the database, never from the token alone.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      sendUnauthorized(res, "Missing or invalid authorization header.");
      return;
    }
    const decoded = verifyToken(token);

    if (!decoded) {
      sendError(res, 401, ERROR_CODES.SESSION_EXPIRED, "Token is invalid or expired.");
      return;
    }

    // ALWAYS verify against database — token role is NOT trusted
    const [dbUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);

    if (!dbUser) {
      sendUnauthorized(res, "User account not found.");
      return;
    }

    if (!dbUser.isActive) {
      sendError(res, 403, ERROR_CODES.INACTIVE_ACCOUNT, "Account is deactivated. Contact your administrator.");
      return;
    }

    // Attach verified user data from the DATABASE (not from token)
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as Role,
      department: dbUser.department,
      institute: dbUser.institute,
      avatar: dbUser.avatar,
      isActive: dbUser.isActive,
    };

    next();
  } catch (error) {
    logger.error({ error }, "Authentication middleware error");
    sendUnauthorized(res, "Authentication failed.");
  }
}

/**
 * Optional authentication — sets req.user if valid token present, continues either way.
 */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      next();
      return;
    }

    const [dbUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);

    if (dbUser && dbUser.isActive) {
      req.user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role as Role,
        department: dbUser.department,
        institute: dbUser.institute,
        avatar: dbUser.avatar,
        isActive: dbUser.isActive,
      };
    }
  } catch {
    // Silently continue without auth
  }
  next();
}
