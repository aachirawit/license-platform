import { ZodError } from "zod";

import { ProviderUnavailableError } from "@/lib/license/types";

import { fail } from "./response";
import { logger } from "@/lib/logger";

// A typed application error whose code + status are safe to send to the client.
// Anything NOT an AppError is treated as an unexpected internal error: it is
// logged server-side and the client only ever sees a generic INTERNAL_ERROR,
// so a stack trace or a database message never leaks.

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  | "NOT_FOUND"
  | "APP_NOT_FOUND"
  | "LICENSE_NOT_FOUND"
  | "PACKAGE_NOT_FOUND"
  | "ADMIN_NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_CREDENTIALS"
  | "INTERNAL_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SESSION_EXPIRED: 401,
  NOT_FOUND: 404,
  APP_NOT_FOUND: 404,
  LICENSE_NOT_FOUND: 404,
  PACKAGE_NOT_FOUND: 404,
  ADMIN_NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  INVALID_CREDENTIALS: 401,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return STATUS[this.code];
  }
}

/** Shorthand throwers for the common cases. */
export const Errors = {
  invalid: (msg = "Invalid request") => new AppError("INVALID_REQUEST", msg),
  unauthorized: (msg = "Authentication required") => new AppError("UNAUTHORIZED", msg),
  forbidden: (msg = "You do not have permission to do that") =>
    new AppError("FORBIDDEN", msg),
  notFound: (code: Extract<ApiErrorCode, `${string}NOT_FOUND`>, msg: string) =>
    new AppError(code, msg),
  conflict: (msg: string) => new AppError("CONFLICT", msg),
  rateLimited: (msg = "Too many requests") => new AppError("RATE_LIMITED", msg),
};

/**
 * Turn any thrown value into the standard error response. Wrap every route
 * handler body in try/catch and pass the error here, so error shaping lives in
 * exactly one place.
 */
export function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.status);
  }
  if (err instanceof ZodError) {
    const first = err.errors[0];
    const where = first?.path.join(".");
    return fail(
      "INVALID_REQUEST",
      first ? `${where ? `${where}: ` : ""}${first.message}` : "Invalid request",
      400,
    );
  }
  if (err instanceof ProviderUnavailableError) {
    // Expected when an app is set to a provider that is not ready; not a bug.
    return fail("PROVIDER_UNAVAILABLE", err.message, 503);
  }

  // Genuinely unexpected: log with detail, return nothing revealing.
  logger.error(
    { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
    "unhandled_route_error",
  );
  return fail("INTERNAL_ERROR", "Internal server error", 500);
}
