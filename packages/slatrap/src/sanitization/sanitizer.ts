import { z } from 'zod';

export type SanitizedValue =
  | string
  | number
  | boolean
  | null
  | SanitizedValue[]
  | { [key: string]: SanitizedValue };

export type SanitizerOptions = {
  redactionText?: string;
  whitelist?: readonly string[];
};

export type Sanitizer<T = unknown> = (
  value: T,
  options?: SanitizerOptions,
) => SanitizedValue;

export const DEFAULT_REDACTION_TEXT = '[REDACTED]';

const DEFAULT_WHITELIST_CANDIDATES = [
  'provider',
  'endpoint',
  'statusCode',
  'latency',
  'providerPayload',
  'eventName',
  'payload',
  'userId',
  'itemId',
  'institutionId',
  'institutionName',
  'response',
  'data',
  'error_code',
  'error_type',
  'error_message',
  'display_message',
  'status_code',
  'request_id',
  'type',
  'code',
  'decline_code',
  'message',
  'param',
  'doc_url',
  'request_log_url',
  'access_token',
  'public_token',
  'refresh_token',
  'client_secret',
  'authorization',
  'api_key',
  'password',
  'token',
  'name',
  'stack',
  'metadata',
  'details',
  'errors',
  'issues',
] as const;

export const SENSITIVE_KEY_PATTERNS = [
  /access[_-]?token/i,
  /public[_-]?token/i,
  /link[_-]?token/i,
  /processor[_-]?token/i,
  /client[_-]?secret/i,
  /refresh[_-]?token/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /password/i,
  /private[_-]?key/i,
  /request[_-]?log[_-]?url/i,
  /fingerprint/i,
  /^cvc$/i,
  /^cvv$/i,
  /^pin$/i,
  /^pan$/i,
  /^number$/i,
  /^account[_-]?id$/i,
  /^account[_-]?number$/i,
  /^routing[_-]?number$/i,
  /^iban$/i,
  /^ssn$/i,
  /^tax[_-]?id$/i,
  /^token$/i,
  /^payment[_-]?intent$/i,
  /^payment[_-]?method$/i,
];

const sanitizedValueSchema: z.ZodType<SanitizedValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(sanitizedValueSchema),
    z.record(z.string(), sanitizedValueSchema),
  ]),
);

export const sanitizeErrorData: Sanitizer = (
  value,
  options: SanitizerOptions = {},
) => {
  const redactionText = options.redactionText ?? DEFAULT_REDACTION_TEXT;
  const whitelist = buildWhitelist(options.whitelist);
  const sanitized = sanitizeUnknown(
    value,
    redactionText,
    new WeakSet(),
    whitelist,
  );
  const parsed = sanitizedValueSchema.safeParse(sanitized);

  if (parsed.success) {
    return parsed.data;
  }

  return {
    message: 'Unable to sanitize error payload',
    issues: parsed.error.issues.map((issue) => issue.message),
  };
};

function sanitizeUnknown(
  value: unknown,
  redactionText: string,
  seen: WeakSet<object>,
  whitelist?: Set<string>,
): SanitizedValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return sanitizeUnknown(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      redactionText,
      seen,
      whitelist,
    );
  }

  if (typeof value !== 'object') {
    return String(value as string | number | bigint | boolean | symbol);
  }

  if (seen.has(value)) {
    return redactionText;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) =>
      sanitizeUnknown(entry, redactionText, seen, whitelist),
    );
  }

  const record = value as Record<string, unknown>;
  const sanitizedRecord: Record<string, SanitizedValue> = {};

  for (const [key, entry] of Object.entries(record)) {
    if (whitelist && !whitelist.has(key)) {
      continue;
    }

    sanitizedRecord[key] = isSensitiveKey(key)
      ? redactionText
      : sanitizeUnknown(entry, redactionText, seen, whitelist);
  }

  return sanitizedRecord;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function buildWhitelist(keys?: readonly string[]): Set<string> | undefined {
  const merged = [...DEFAULT_WHITELIST_CANDIDATES, ...(keys ?? [])];

  return new Set(merged);
}
