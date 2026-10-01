/**
 * Standardized API response helpers.
 * Every API endpoint MUST use these to ensure consistent response format.
 */
import type { Response } from "express";
import type { ErrorCode } from "./constants";
import { ERROR_CODES } from "./constants";

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/**
 * Send a success response.
 */
export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200): void {
  const response: ApiSuccess<T> = { success: true, data };
  if (message) response.message = message;
  res.status(statusCode).json(response);
}

/**
 * Send an error response.
 */
export function sendError(res: Response, statusCode: number, code: ErrorCode, message: string): void {
  const response: ApiError = {
    success: false,
    error: { code, message },
  };
  res.status(statusCode).json(response);
}

// Convenience error senders

export function sendUnauthorized(res: Response, message = "Authentication required."): void {
  sendError(res, 401, ERROR_CODES.UNAUTHORIZED, message);
}

export function sendForbidden(res: Response, message = "You do not have permission to perform this action."): void {
  sendError(res, 403, ERROR_CODES.FORBIDDEN, message);
}

export function sendNotFound(res: Response, message = "Resource not found."): void {
  sendError(res, 404, ERROR_CODES.NOT_FOUND, message);
}

export function sendBadRequest(res: Response, message = "Invalid request."): void {
  sendError(res, 400, ERROR_CODES.BAD_REQUEST, message);
}

export function sendConflict(res: Response, message = "Resource already exists."): void {
  sendError(res, 409, ERROR_CODES.CONFLICT, message);
}

export function sendValidationError(res: Response, message = "Validation failed."): void {
  sendError(res, 422, ERROR_CODES.VALIDATION_ERROR, message);
}

export function sendInternalError(res: Response, message = "An internal error occurred."): void {
  sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, message);
}
