/**
 * Realtime Service — Server-Sent Events (SSE) for live attendance updates.
 *
 * Teachers see live attendance stream without manual refresh.
 * Uses native SSE (no additional infrastructure required).
 * Never exposes another student's private information.
 */
import type { Request, Response } from "express";
import { logger } from "../lib/logger";

type SSEClient = {
  res: Response;
  userId: string;
  sessionId: string;
};

// Active SSE connections: sessionId → Set<client>
const sseClients = new Map<string, Set<SSEClient>>();

/**
 * Register an SSE client for a session.
 */
export function addSSEClient(sessionId: string, userId: string, res: Response): void {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx compatibility
  res.flushHeaders();

  // Send initial keepalive
  res.write(": connected\n\n");

  const client: SSEClient = { res, userId, sessionId };

  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId)!.add(client);

  // Clean up on disconnect
  res.on("close", () => {
    const clients = sseClients.get(sessionId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        sseClients.delete(sessionId);
      }
    }
  });
}

/**
 * Broadcast an event to all clients subscribed to a session.
 */
export function broadcastToSession(sessionId: string, event: string, data: unknown): void {
  const clients = sseClients.get(sessionId);
  if (!clients || clients.size === 0) return;

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    try {
      client.res.write(message);
    } catch {
      // Client disconnected — remove
      clients.delete(client);
    }
  }
}

/**
 * Send attendance update event.
 */
export function sendAttendanceUpdate(sessionId: string, update: {
  presentCount: number;
  totalEnrolled: number;
  latestStudentName?: string;
  verificationMethod?: string;
  failedAttempts?: number;
  riskEvents?: number;
}): void {
  broadcastToSession(sessionId, "attendance_update", update);
}

/**
 * Send re-check status update.
 */
export function sendRecheckUpdate(sessionId: string, update: {
  status: string;
  completedCount: number;
  totalRequested: number;
  expiredCount: number;
}): void {
  broadcastToSession(sessionId, "recheck_update", update);
}

/**
 * Send security event notification to teacher.
 */
export function sendSecurityEvent(sessionId: string, event: {
  type: string;
  severity: string;
  message: string;
}): void {
  broadcastToSession(sessionId, "security_event", event);
}

/**
 * Send session ended event.
 */
export function sendSessionEnded(sessionId: string): void {
  broadcastToSession(sessionId, "session_ended", { status: "ENDED" });

  // Close all connections for this session
  const clients = sseClients.get(sessionId);
  if (clients) {
    for (const client of clients) {
      try { client.res.end(); } catch {}
    }
    sseClients.delete(sessionId);
  }
}

/**
 * Get the count of active SSE connections for a session.
 */
export function getSSEClientCount(sessionId: string): number {
  return sseClients.get(sessionId)?.size ?? 0;
}

/**
 * Send a keepalive ping to all clients (call periodically).
 */
export function sendKeepalive(): void {
  for (const [, clients] of sseClients) {
    for (const client of clients) {
      try {
        client.res.write(": keepalive\n\n");
      } catch {
        clients.delete(client);
      }
    }
  }
}
