import { type SanitizedValue } from '../sanitization/sanitizer';

export function resolveEmitLatency(payload: SanitizedValue): SanitizedValue {
  if (!isRecord(payload)) {
    return payload;
  }

  const eventName = payload.eventName;
  if (typeof eventName === 'string' && isRecord(payload.payload)) {
    return {
      ...payload,
      payload: resolveRecordLatency(payload.payload),
    } as SanitizedValue;
  }

  return resolveRecordLatency(payload) as SanitizedValue;
}

function resolveRecordLatency(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const startedAt = payload.startedAt;
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) {
    return payload;
  }

  const { startedAt: _startedAt, ...rest } = payload;

  if (typeof rest.latency === 'number' && Number.isFinite(rest.latency)) {
    return rest;
  }

  return {
    ...rest,
    latency: Date.now() - startedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
