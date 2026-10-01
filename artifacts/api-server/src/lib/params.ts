/**
 * Helper to safely extract route parameters in Express 5.
 * Express 5 types route params as `string | string[]`.
 * This helper ensures we always get a string.
 */
import type { Request } from "express";

export function getParam(req: Request, name: string): string {
  const val = req.params[name];
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}
