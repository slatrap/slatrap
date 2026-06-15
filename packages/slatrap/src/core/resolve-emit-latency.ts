import { type SanitizedValue } from '../sanitization/sanitizer';

export function resolveEmitLatency(payload: SanitizedValue): SanitizedValue {
  if (!isRecord(payload)) {
    return payload;
  }

  const startedAt = payload.startedAt;
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) {
    return payload;
  }

  const { startedAt: _startedAt, ...rest } = payload;

  if (typeof rest.latency === 'number' && Number.isFinite(rest.latency)) {
    return rest as SanitizedValue;
  }

  return {
    ...rest,
    latency: Date.now() - startedAt,
  } as SanitizedValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
