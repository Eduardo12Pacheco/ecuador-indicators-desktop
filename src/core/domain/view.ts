/**
 * Saved-view validation mirrored from the authoritative Rust `ViewService`
 * (D25). Both implementations are property-tested against the same rules.
 */

import { appError } from "./errors";
import { isIso3, isYear, type ViewSpec, type Year } from "./model";
import { err, ok, type Result } from "./result";

/** Maximum number of saved views (S6). */
export const MAX_VIEWS = 200;
/** Maximum saved-view name length in characters (S6). */
export const MAX_NAME_CHARS = 80;
/** Minimum and maximum accepted years for every view range. */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

function invalid(message: string) {
  return appError("VIEW_INVALID", message);
}

function validYear(value: Year, field: string): Result<void> {
  return isYear(value) ? ok(undefined) : err(invalid(`${field} must be between 1900 and 2100`));
}

function nonEmpty(value: string, field: string): Result<void> {
  return value.trim().length > 0 ? ok(undefined) : err(invalid(`${field} must not be empty`));
}

function unique(values: readonly string[], field: string): Result<void> {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      return err(invalid(`${field} must be unique, duplicate ${value}`));
    }
    seen.add(value);
  }
  return ok(undefined);
}

function validateExplore(spec: Extract<ViewSpec, { kind: "explore" }>): Result<void> {
  const indicator = nonEmpty(spec.indicator, "indicator");
  if (!indicator.ok) {
    return indicator;
  }
  if (spec.geographies.length < 1 || spec.geographies.length > 5) {
    return err(invalid("explore geographies must contain 1 to 5 entries"));
  }
  if (spec.geographies[0] !== "ECU") {
    return err(invalid("the first explore geography must be ECU"));
  }
  for (const geography of spec.geographies) {
    if (!isIso3(geography)) {
      return err(invalid(`geographies must be uppercase ISO3 codes, got ${geography}`));
    }
  }
  const uniqueness = unique(spec.geographies, "geographies");
  if (!uniqueness.ok) {
    return uniqueness;
  }
  if (spec.from !== null) {
    const from = validYear(spec.from, "from");
    if (!from.ok) {
      return from;
    }
  }
  if (spec.to !== null) {
    const to = validYear(spec.to, "to");
    if (!to.ok) {
      return to;
    }
  }
  if (spec.from !== null && spec.to !== null && spec.from > spec.to) {
    return err(invalid(`from (${spec.from}) must not be after to (${spec.to})`));
  }
  if (spec.baseYear !== null) {
    return validYear(spec.baseYear, "base_year");
  }
  return ok(undefined);
}

function validateTrajectories(spec: Extract<ViewSpec, { kind: "trajectories" }>): Result<void> {
  if (spec.indicators.length < 2 || spec.indicators.length > 4) {
    return err(invalid("trajectories must contain 2 to 4 indicators"));
  }
  for (const indicator of spec.indicators) {
    const check = nonEmpty(indicator, "indicator");
    if (!check.ok) {
      return check;
    }
  }
  const uniqueness = unique(spec.indicators, "indicators");
  if (!uniqueness.ok) {
    return uniqueness;
  }
  if (!isIso3(spec.geography)) {
    return err(invalid(`geography must be an uppercase ISO3 code, got ${spec.geography}`));
  }
  if (spec.baseYear !== null) {
    return validYear(spec.baseYear, "base_year");
  }
  return ok(undefined);
}

function validateRanking(spec: Extract<ViewSpec, { kind: "ranking" }>): Result<void> {
  const indicator = nonEmpty(spec.indicator, "indicator");
  if (!indicator.ok) {
    return indicator;
  }
  return validYear(spec.year, "year");
}

/**
 * Validates a persisted view spec.
 *
 * Totality matters because this function also validates JSON read from disk:
 * malformed shapes return `VIEW_INVALID` instead of throwing.
 */
export function validateViewSpec(spec: ViewSpec): Result<void> {
  try {
    switch (spec.kind) {
      case "explore":
        return validateExplore(spec);
      case "trajectories":
        return validateTrajectories(spec);
      case "ranking":
        return validateRanking(spec);
      default:
        return err(invalid("unknown view kind"));
    }
  } catch {
    return err(invalid("malformed view spec"));
  }
}

/** Validates a saved-view name: trimmed length between 1 and 80 characters. */
export function validateViewName(name: string): Result<void> {
  const length = [...name.trim()].length;
  if (length === 0 || length > MAX_NAME_CHARS) {
    return err(invalid(`name must contain 1 to ${MAX_NAME_CHARS} characters, got ${length}`));
  }
  return ok(undefined);
}
