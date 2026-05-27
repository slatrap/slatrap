import {
  DEFAULT_REDACTION_TEXT,
  SENSITIVE_KEY_PATTERNS,
  sanitizeErrorData,
  type SanitizedValue,
} from '../sanitization/sanitizer';

export function sanitizeBeforeEmit(
  payload: SanitizedValue,
  redactionText?: string,
): SanitizedValue {
  const expectedRedactionText = redactionText ?? DEFAULT_REDACTION_TEXT;

  if (hasSensitiveData(payload, expectedRedactionText, new WeakSet<object>())) {
    console.warn(
      '[Slatrap] emit() received payload with sensitive fields. Call Slatrap.sanitize(...) before emit.',
    );

    return sanitizeErrorData(payload, { redactionText });
  }

  return payload;
}

function hasSensitiveData(
  value: SanitizedValue,
  expectedRedactionText: string,
  seen: WeakSet<object>,
): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasSensitiveData(item, expectedRedactionText, seen)) {
        return true;
      }
    }

    return false;
  }

  const record = value as Record<string, SanitizedValue>;
  if (seen.has(record)) {
    return false;
  }

  seen.add(record);

  for (const [key, entry] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      if (entry === expectedRedactionText) {
        return false;
      }

      return true;
    }

    if (hasSensitiveData(entry, expectedRedactionText, seen)) {
      return true;
    }
  }

  return false;
}
