/**
 * Stable, cross-runtime error codes (D24) plus the input/transform codes the
 * user-visible domain needs. The Rust core owns the IPC half of this list; the
 * TypeScript core mirrors it so the UI can branch without string literals.
 */
export type AppErrorCode =
  | "SNAPSHOT_INVALID"
  | "SNAPSHOT_NOT_FOUND"
  | "VIEW_NOT_FOUND"
  | "VIEW_INVALID"
  | "LIMIT_EXCEEDED"
  | "STORAGE"
  | "EXPORT_REJECTED"
  | "UPDATE_FEED"
  | "NETWORK"
  | "INTERNAL"
  | "INVALID_INPUT"
  | "DUPLICATE_YEAR"
  | "NON_FINITE"
  | "BASE_YEAR_MISSING"
  | "BASE_VALUE_ZERO";

/** The typed error carried by every failed {@link Result}. */
export interface AppError {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly details?: string;
}

/** Every code the TypeScript core may carry. */
export const APP_ERROR_CODES = [
  "SNAPSHOT_INVALID",
  "SNAPSHOT_NOT_FOUND",
  "VIEW_NOT_FOUND",
  "VIEW_INVALID",
  "LIMIT_EXCEEDED",
  "STORAGE",
  "EXPORT_REJECTED",
  "UPDATE_FEED",
  "NETWORK",
  "INTERNAL",
  "INVALID_INPUT",
  "DUPLICATE_YEAR",
  "NON_FINITE",
  "BASE_YEAR_MISSING",
  "BASE_VALUE_ZERO",
] as const satisfies readonly AppErrorCode[];

/** Narrows a string to an {@link AppErrorCode}. */
export function isAppErrorCode(value: string): value is AppErrorCode {
  return (APP_ERROR_CODES as readonly string[]).includes(value);
}

/** Creates a typed application error. */
export function appError(code: AppErrorCode, message: string, details?: string): AppError {
  return details === undefined ? { code, message } : { code, message, details };
}

/** True when the value is a well-formed {@link AppError}. */
export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { code?: unknown; message?: unknown };
  return (
    typeof candidate.code === "string" &&
    isAppErrorCode(candidate.code) &&
    typeof candidate.message === "string"
  );
}
