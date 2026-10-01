/**
 * Security Code Service — generates rotating 6-character alphanumeric codes.
 *
 * Design:
 * - New code every 15 seconds (server-authoritative)
 * - Cryptographically secure random generation (no predictable sequence)
 * - Previous code expires immediately when new one is generated
 * - Brute-force protected via rate limiting
 * - Case-insensitive validation (codes are uppercase, input is uppercased)
 */
import crypto from "node:crypto";
import { logger } from "../lib/logger";

const CODE_ROTATION_INTERVAL_MS = 15_000; // 15 seconds
const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O/1/I confusion

// In-memory store of active session security codes
const activeSecurityCodes = new Map<string, {
  code: string;
  generatedAt: Date;
  expiresAt: Date;
}>();

/**
 * Generate a cryptographically secure random code.
 */
function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

/**
 * Rotate the security code for a session.
 * The previous code is invalidated immediately.
 */
export function rotateSecurityCode(sessionId: string): {
  code: string;
  generatedAt: Date;
  expiresAt: Date;
} {
  const now = Date.now();
  const code = generateCode();
  const generatedAt = new Date(now);
  const expiresAt = new Date(now + CODE_ROTATION_INTERVAL_MS);

  activeSecurityCodes.set(sessionId, { code, generatedAt, expiresAt });

  return { code, generatedAt, expiresAt };
}

/**
 * Get the current active security code for a session.
 * Auto-rotates if expired.
 */
export function getCurrentSecurityCode(sessionId: string): {
  code: string;
  generatedAt: Date;
  expiresAt: Date;
} {
  const cached = activeSecurityCodes.get(sessionId);

  if (cached && cached.expiresAt.getTime() > Date.now()) {
    return cached;
  }

  // Expired or not yet generated — rotate
  return rotateSecurityCode(sessionId);
}

/**
 * Validate a security code against the current active code for a session.
 * Case-insensitive comparison.
 *
 * Returns true only if the code matches the current active code AND it hasn't expired.
 */
export function validateSecurityCode(
  sessionId: string,
  inputCode: string
): { valid: boolean; error?: string } {
  const cached = activeSecurityCodes.get(sessionId);

  if (!cached) {
    return { valid: false, error: "No active security code for this session" };
  }

  // Server-authoritative expiry check
  if (cached.expiresAt.getTime() < Date.now()) {
    return { valid: false, error: "Security code expired" };
  }

  // Case-insensitive comparison
  const normalizedInput = inputCode.trim().toUpperCase();
  const normalizedCode = cached.code.toUpperCase();

  // Timing-safe comparison to prevent timing attacks
  if (normalizedInput.length !== normalizedCode.length) {
    return { valid: false, error: "Invalid security code" };
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(normalizedInput),
    Buffer.from(normalizedCode)
  );

  if (!isValid) {
    return { valid: false, error: "Invalid security code" };
  }

  return { valid: true };
}

/**
 * Clean up security code state when a session ends.
 */
export function clearSessionSecurityCode(sessionId: string): void {
  activeSecurityCodes.delete(sessionId);
}

/**
 * Get rotation interval in milliseconds.
 */
export function getCodeRotationInterval(): number {
  return CODE_ROTATION_INTERVAL_MS;
}
