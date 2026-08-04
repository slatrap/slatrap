import {
  type SanitizedValue,
  type StructuredValue,
} from '../sanitization/sanitizer';
import { isRecord } from './is-record';

export function resolveEmitLatency(payload: SanitizedValue): SanitizedValue {
  if (!isRecord(payload)) {
    return payload;
  }

  const eventName = payload.eventName;
  if (typeof eventName === 'string' && isRecord(payload.payload)) {
    return {
      ...payload,
      payload: resolveRecordLatency(
        payload.payload as Record<string, StructuredValue>,
      ),
    } as unknown as SanitizedValue;
  }

  return resolveRecordLatency(
    payload as Record<string, StructuredValue>,
  ) as unknown as SanitizedValue;
}

function resolveRecordLatency(
  payload: Record<string, StructuredValue>,
): Record<string, StructuredValue> {
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
