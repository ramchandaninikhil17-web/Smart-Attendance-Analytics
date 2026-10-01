/**
 * WebAuthn / Passkey Service — real server-side WebAuthn verification.
 *
 * Uses @simplewebauthn/server for proper FIDO2/WebAuthn operations.
 * Never stores biometric data — only public key material.
 * Never fakes passkey verification — this is real cryptographic proof.
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { db } from "@workspace/db";
import { passkeysTable, verificationChallengesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

// WebAuthn configuration
const isProduction = process.env.NODE_ENV === "production";
const RP_NAME = process.env.WEBAUTHN_RP_NAME || "CHARUSAT Smart Attendance";
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:5173";
const CHALLENGE_TIMEOUT_MS = Number(process.env.WEBAUTHN_CHALLENGE_TIMEOUT_MS) || 120_000; // 2 minutes

if (isProduction && (RP_ID === "localhost" || ORIGIN.includes("localhost"))) {
  logger.warn({ RP_ID, ORIGIN }, "WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN should be configured with your production domain (e.g. attendance.charusat.ac.in and https://attendance.charusat.ac.in) for hardware passkeys to work in production.");
}

// In-memory challenge store (sessionId+userId → challenge)
const pendingChallenges = new Map<string, {
  challenge: string;
  type: "register" | "auth";
  expiresAt: number;
  sessionId?: string;
}>();

/**
 * Generate WebAuthn registration options for a user.
 */
export async function generatePasskeyRegistrationOptions(
  userId: string,
  userName: string,
  userDisplayName: string
) {
  // Get existing credentials for this user to exclude
  const existingCredentials = await db
    .select({
      credentialId: passkeysTable.credentialId,
    })
    .from(passkeysTable)
    .where(eq(passkeysTable.userId, userId));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName,
    userDisplayName,
    attestationType: "none", // Don't require attestation for broader device compatibility
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    timeout: CHALLENGE_TIMEOUT_MS,
  });

  // Store challenge for verification
  const challengeKey = `register:${userId}`;
  pendingChallenges.set(challengeKey, {
    challenge: options.challenge,
    type: "register",
    expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS,
  });

  return options;
}

/**
 * Verify a WebAuthn registration response and store the credential.
 */
export async function verifyPasskeyRegistration(
  userId: string,
  registrationResponse: any,
  deviceName?: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  const challengeKey = `register:${userId}`;
  const pending = pendingChallenges.get(challengeKey);

  if (!pending) {
    return { success: false, error: "No pending registration challenge" };
  }

  if (Date.now() > pending.expiresAt) {
    pendingChallenges.delete(challengeKey);
    return { success: false, error: "Registration challenge expired" };
  }

  try {
    const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: pending.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { success: false, error: "Registration verification failed" };
    }

    const { credential } = verification.registrationInfo;

    // Store the credential
    const passkeyId = uuidv4();
    await db.insert(passkeysTable).values({
      id: passkeyId,
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      deviceName: deviceName ?? "Unknown Device",
      lastUsed: null,
    });

    // Clean up challenge
    pendingChallenges.delete(challengeKey);

    return { success: true, credentialId: passkeyId };
  } catch (error) {
    logger.error({ error }, "WebAuthn registration verification failed");
    pendingChallenges.delete(challengeKey);
    return { success: false, error: "Registration verification failed" };
  }
}

/**
 * Generate WebAuthn authentication options for attendance verification.
 */
export async function generatePasskeyAuthOptions(
  userId: string,
  sessionId: string
) {
  // Get user's registered credentials
  const credentials = await db
    .select({
      credentialId: passkeysTable.credentialId,
    })
    .from(passkeysTable)
    .where(eq(passkeysTable.userId, userId));

  if (credentials.length === 0) {
    return null; // No passkeys registered
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.credentialId,
    })),
    userVerification: "preferred",
    timeout: CHALLENGE_TIMEOUT_MS,
  });

  // Store challenge for verification
  const challengeKey = `auth:${userId}:${sessionId}`;
  pendingChallenges.set(challengeKey, {
    challenge: options.challenge,
    type: "auth",
    expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS,
    sessionId,
  });

  return options;
}

/**
 * Verify a WebAuthn authentication response.
 * This is the critical path for attendance verification.
 */
export async function verifyPasskeyAuth(
  userId: string,
  sessionId: string,
  authResponse: any
): Promise<{ valid: boolean; error?: string }> {
  const challengeKey = `auth:${userId}:${sessionId}`;
  const pending = pendingChallenges.get(challengeKey);

  if (!pending) {
    return { valid: false, error: "No pending authentication challenge" };
  }

  if (Date.now() > pending.expiresAt) {
    pendingChallenges.delete(challengeKey);
    return { valid: false, error: "Authentication challenge expired" };
  }

  // Verify session ID matches
  if (pending.sessionId !== sessionId) {
    return { valid: false, error: "Challenge session mismatch" };
  }

  try {
    // Find the credential in database
    const credentialId = authResponse.id;
    const [storedCredential] = await db
      .select()
      .from(passkeysTable)
      .where(and(
        eq(passkeysTable.userId, userId),
        eq(passkeysTable.credentialId, credentialId)
      ))
      .limit(1);

    if (!storedCredential) {
      pendingChallenges.delete(challengeKey);
      return { valid: false, error: "Credential not found or not owned by user" };
    }

    const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: pending.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCredential.credentialId,
        publicKey: Buffer.from(storedCredential.publicKey, "base64url"),
        counter: 0, // We don't track counters currently, accept any valid signature
      },
    });

    if (!verification.verified) {
      pendingChallenges.delete(challengeKey);
      return { valid: false, error: "Authentication verification failed" };
    }

    // Update last used timestamp
    await db
      .update(passkeysTable)
      .set({ lastUsed: new Date(), updatedAt: new Date() })
      .where(eq(passkeysTable.id, storedCredential.id));

    // Clean up challenge (single-use)
    pendingChallenges.delete(challengeKey);

    return { valid: true };
  } catch (error) {
    logger.error({ error }, "WebAuthn auth verification failed");
    pendingChallenges.delete(challengeKey);
    return { valid: false, error: "Authentication verification failed" };
  }
}

/**
 * Check if a user has any registered passkeys.
 */
export async function hasPasskeys(userId: string): Promise<boolean> {
  const [result] = await db
    .select({ id: passkeysTable.id })
    .from(passkeysTable)
    .where(eq(passkeysTable.userId, userId))
    .limit(1);
  return !!result;
}

/**
 * Get all passkeys for a user.
 */
export async function getUserPasskeys(userId: string) {
  return db
    .select({
      id: passkeysTable.id,
      credentialId: passkeysTable.credentialId,
      deviceName: passkeysTable.deviceName,
      lastUsed: passkeysTable.lastUsed,
      createdAt: passkeysTable.createdAt,
    })
    .from(passkeysTable)
    .where(eq(passkeysTable.userId, userId));
}

/**
 * Delete a passkey (user self-management).
 */
export async function deletePasskey(passkeyId: string, userId: string): Promise<boolean> {
  // Ownership check — only delete passkeys belonging to this user
  const [passkey] = await db
    .select({ id: passkeysTable.id })
    .from(passkeysTable)
    .where(and(
      eq(passkeysTable.id, passkeyId),
      eq(passkeysTable.userId, userId)
    ))
    .limit(1);

  if (!passkey) return false;

  await db.delete(passkeysTable).where(eq(passkeysTable.id, passkeyId));
  return true;
}

/**
 * Clean up expired challenges (housekeeping).
 */
export function cleanupExpiredChallenges(): void {
  const now = Date.now();
  for (const [key, challenge] of pendingChallenges) {
    if (now > challenge.expiresAt) {
      pendingChallenges.delete(key);
    }
  }
}
