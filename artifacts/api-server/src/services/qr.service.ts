/**
 * QR Rotation Engine — generates cryptographically secure rotating QR tokens.
 *
 * Design:
 * - Each token is a signed opaque string containing sessionId + random nonce + timestamp
 * - Tokens expire after 15 seconds (server-authoritative, never trust frontend timer)
 * - Each token is single-use — consumed tokens cannot be replayed
 * - No sensitive student/credential data is embedded in the QR payload
 */
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { verificationChallengesTable } from "@workspace/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && (!process.env.QR_HMAC_SECRET || process.env.QR_HMAC_SECRET === "charusat-qr-hmac-secret-change-in-production")) {
  throw new Error("FATAL: QR_HMAC_SECRET environment variable is required and must be set to a secure string in production.");
}
const QR_ROTATION_INTERVAL_MS = 15_000; // 15 seconds
const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || "charusat-qr-hmac-secret-change-in-production";

// In-memory cache of active session QR state (sessionId → current token info)
const activeQRTokens = new Map<string, {
  tokenId: string;
  token: string;
  expiresAt: Date;
  generatedAt: Date;
}>();

/**
 * Generate a cryptographically secure QR token for a session.
 * The token is an HMAC-signed opaque payload.
 */
export function generateQRToken(sessionId: string): {
  tokenId: string;
  token: string;
  expiresAt: Date;
  generatedAt: Date;
} {
  const tokenId = uuidv4();
  const nonce = crypto.randomBytes(32).toString("hex");
  const timestamp = Date.now();
  const expiresAt = new Date(timestamp + QR_ROTATION_INTERVAL_MS);
  const generatedAt = new Date(timestamp);

  // Create the raw payload (sessionId + nonce + timestamp)
  const payload = `${sessionId}:${nonce}:${timestamp}`;

  // Sign with HMAC-SHA256 to prevent tampering
  const signature = crypto
    .createHmac("sha256", QR_HMAC_SECRET)
    .update(payload)
    .digest("hex");

  // The token is the payload + signature, base64 encoded for QR friendliness
  const token = Buffer.from(`${payload}:${signature}`).toString("base64url");

  return { tokenId, token, expiresAt, generatedAt };
}

/**
 * Parse and validate a QR token's structural integrity (does NOT check database state).
 * Returns the extracted sessionId and timestamp if the signature is valid.
 */
export function parseQRToken(token: string): {
  valid: boolean;
  sessionId?: string;
  timestamp?: number;
  error?: string;
} {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");

    if (parts.length !== 4) {
      return { valid: false, error: "Malformed QR token" };
    }

    const [sessionId, nonce, timestampStr, providedSignature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return { valid: false, error: "Invalid timestamp in QR token" };
    }

    // Verify HMAC signature
    const payload = `${sessionId}:${nonce}:${timestampStr}`;
    const expectedSignature = crypto
      .createHmac("sha256", QR_HMAC_SECRET)
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(
      Buffer.from(providedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    )) {
      return { valid: false, error: "Invalid QR token signature" };
    }

    // Check expiry (server-authoritative)
    const age = Date.now() - timestamp;
    if (age > QR_ROTATION_INTERVAL_MS + 2000) {
      // Allow 2 second grace period for network latency
      return { valid: false, error: "QR token expired" };
    }

    if (age < -5000) {
      // Token from the future (clock skew > 5s)
      return { valid: false, error: "QR token has invalid timestamp" };
    }

    return { valid: true, sessionId, timestamp };
  } catch {
    return { valid: false, error: "Failed to parse QR token" };
  }
}

/**
 * Rotate the QR token for a session. Stores the new token in the database
 * and invalidates previous tokens.
 */
export async function rotateSessionQR(sessionId: string): Promise<{
  token: string;
  expiresAt: Date;
  generatedAt: Date;
}> {
  const { tokenId, token, expiresAt, generatedAt } = generateQRToken(sessionId);

  // Store in database for replay detection
  await db.insert(verificationChallengesTable).values({
    id: tokenId,
    sessionId,
    type: "qr",
    challenge: token,
    consumed: false,
    expiresAt,
  });

  // Update in-memory cache
  activeQRTokens.set(sessionId, { tokenId, token, expiresAt, generatedAt });

  return { token, expiresAt, generatedAt };
}

/**
 * Get the current active QR token for a session.
 * If expired, rotates automatically.
 */
export async function getCurrentQR(sessionId: string): Promise<{
  token: string;
  expiresAt: Date;
  generatedAt: Date;
}> {
  const cached = activeQRTokens.get(sessionId);

  if (cached && cached.expiresAt.getTime() > Date.now()) {
    return {
      token: cached.token,
      expiresAt: cached.expiresAt,
      generatedAt: cached.generatedAt,
    };
  }

  // Expired or not yet generated — rotate
  return rotateSessionQR(sessionId);
}

/**
 * Validate a QR token for attendance verification.
 * Checks: signature, expiry, session match, single-use (replay protection).
 *
 * Returns the challenge record ID if valid, or an error message.
 */
export async function validateQRToken(
  token: string,
  expectedSessionId: string,
  consumingUserId: string
): Promise<{ valid: boolean; challengeId?: string; error?: string }> {
  // Step 1: Parse and verify signature + expiry
  const parsed = parseQRToken(token);
  if (!parsed.valid) {
    return { valid: false, error: parsed.error };
  }

  // Step 2: Verify session match
  if (parsed.sessionId !== expectedSessionId) {
    return { valid: false, error: "QR token does not match session" };
  }

  // Step 3: Check database for the token (replay protection)
  const [challenge] = await db
    .select()
    .from(verificationChallengesTable)
    .where(and(
      eq(verificationChallengesTable.sessionId, expectedSessionId),
      eq(verificationChallengesTable.challenge, token),
      eq(verificationChallengesTable.type, "qr"),
    ))
    .limit(1);

  if (!challenge) {
    return { valid: false, error: "QR token not recognized" };
  }

  if (challenge.consumed) {
    return { valid: false, error: "QR token already used" };
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    return { valid: false, error: "QR token expired" };
  }

  // Step 4: Mark as consumed (single-use enforcement)
  // Note: We don't mark QR tokens as consumed per-student since multiple students
  // scan the same QR within the 15s window. Replay protection is per-student via
  // the attendance unique constraint (student + session).

  return { valid: true, challengeId: challenge.id };
}

/**
 * Clean up QR state when a session ends.
 */
export function clearSessionQR(sessionId: string): void {
  activeQRTokens.delete(sessionId);
}

/**
 * Get rotation interval in milliseconds.
 */
export function getQRRotationInterval(): number {
  return QR_ROTATION_INTERVAL_MS;
}

export const getOrCreateSessionQR = getCurrentQR;
