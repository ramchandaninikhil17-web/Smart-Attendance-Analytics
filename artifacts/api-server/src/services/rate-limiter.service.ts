/**
 * Rate Limiter — protects sensitive endpoints from brute-force and abuse.
 *
 * In-memory sliding window rate limiting.
 * Does NOT permanently lock legitimate users for a single accidental failure.
 */
import { logger } from "../lib/logger";

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
  lastAttempt: number;
}

// In-memory rate limit store: key → entry
const rateLimits = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG: Record<string, { maxAttempts: number; windowMs: number; blockMs: number }> = {
  login: { maxAttempts: 5, windowMs: 300_000, blockMs: 900_000 },          // 5 attempts per 5 min, block 15 min
  security_code: { maxAttempts: 10, windowMs: 60_000, blockMs: 300_000 },  // 10 attempts per min, block 5 min
  qr_verify: { maxAttempts: 15, windowMs: 60_000, blockMs: 120_000 },     // 15 per min, block 2 min
  webauthn: { maxAttempts: 5, windowMs: 300_000, blockMs: 600_000 },       // 5 per 5 min, block 10 min
  recheck: { maxAttempts: 5, windowMs: 120_000, blockMs: 300_000 },        // 5 per 2 min, block 5 min
  verify_attendance: { maxAttempts: 10, windowMs: 120_000, blockMs: 300_000 }, // 10 per 2 min, block 5 min
};

/**
 * Check if an action is rate limited.
 * Returns { allowed: true } if within limits, or { allowed: false, retryAfterMs } if blocked.
 */
export function checkRateLimit(
  userId: string,
  action: string
): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  const config = RATE_LIMIT_CONFIG[action];
  if (!config) {
    // Unknown action — allow
    return { allowed: true };
  }

  const key = `${action}:${userId}`;
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry) {
    // First attempt
    rateLimits.set(key, { attempts: 1, windowStart: now, lastAttempt: now });
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  // Check if window has expired
  if (now - entry.windowStart > config.windowMs) {
    // Reset window
    rateLimits.set(key, { attempts: 1, windowStart: now, lastAttempt: now });
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  // Check if currently blocked
  if (entry.attempts >= config.maxAttempts) {
    const blockEnds = entry.lastAttempt + config.blockMs;
    if (now < blockEnds) {
      return { allowed: false, retryAfterMs: blockEnds - now };
    }
    // Block expired, reset
    rateLimits.set(key, { attempts: 1, windowStart: now, lastAttempt: now });
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  // Increment
  entry.attempts++;
  entry.lastAttempt = now;
  return { allowed: true, remaining: config.maxAttempts - entry.attempts };
}

/**
 * Record a failed attempt (increases the counter).
 * Call this after a failed verification, NOT on success.
 */
export function recordFailedAttempt(userId: string, action: string): void {
  const config = RATE_LIMIT_CONFIG[action];
  if (!config) return;

  const key = `${action}:${userId}`;
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry) {
    rateLimits.set(key, { attempts: 1, windowStart: now, lastAttempt: now });
  } else if (now - entry.windowStart > config.windowMs) {
    rateLimits.set(key, { attempts: 1, windowStart: now, lastAttempt: now });
  } else {
    entry.attempts++;
    entry.lastAttempt = now;
  }
}

/**
 * Reset rate limit for a user+action (e.g., after successful login).
 */
export function resetRateLimit(userId: string, action: string): void {
  const key = `${action}:${userId}`;
  rateLimits.delete(key);
}

/**
 * Clean up expired entries (housekeeping, call periodically).
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    const action = key.split(":")[0];
    const config = RATE_LIMIT_CONFIG[action];
    if (config && now - entry.windowStart > config.windowMs + config.blockMs) {
      rateLimits.delete(key);
    }
  }
}
