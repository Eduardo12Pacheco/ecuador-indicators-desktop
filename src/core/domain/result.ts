/**
 * A small, explicit `Result` type used across the pure core.
 *
 * Use cases and domain functions never throw for expected failures; they return
 * `Err` with a typed {@link AppError} instead, and the UI/adapter boundary
 * decides how to present it (toast, inline error, retry).
 */

import type { AppError } from "./errors";

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = AppError> = Ok<T> | Err<E>;

/** Wraps a value as a successful result. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Wraps an error as a failed result. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Maps the success value, preserving a failure unchanged. */
export function map<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result;
}

/** Chains a fallible step, short-circuiting on failure. */
export function andThen<T, U, E>(
  result: Result<T, E>,
  next: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? next(result.value) : result;
}

/** Returns the success value or a fallback. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
