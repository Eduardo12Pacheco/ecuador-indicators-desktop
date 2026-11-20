/**
 * The application layer re-exports the domain error model so use cases and
 * adapters have one import for typed failures.
 */

export {
  type AppError,
  type AppErrorCode,
  appError,
  isAppError,
} from "../domain/errors";
