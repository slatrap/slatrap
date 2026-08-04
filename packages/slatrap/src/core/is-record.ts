/**
 * Plain object check used across emit, interceptors, mappers, and normalizers.
 *
 * Semantics: `true` only for non-null objects that are **not** arrays.
 * Arrays are never treated as records (avoids treating list payloads as key maps).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Same semantics as {@link isRecord}; returns `null` when the value is not a record. */
export function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
