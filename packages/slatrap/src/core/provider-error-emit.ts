import { type SanitizedValue } from '../sanitization/sanitizer';

export type ProviderErrorEmitInput = {
  provider: string;
  endpoint?: string;
  statusCode?: number | null;
  providerPayload: unknown;
  startedAt?: number;
};

/**
 * Builds the standard provider-error envelope.
 * Package-internal — callers should pass plain fields to `Slatrap.emit`, which normalizes here.
 */
export function buildProviderErrorEmitPayload(
  input: ProviderErrorEmitInput,
): SanitizedValue {
  const payload: Record<string, unknown> = {
    provider: input.provider,
    statusCode: input.statusCode ?? null,
    providerPayload: input.providerPayload,
  };

  if (input.endpoint !== undefined) {
    payload.endpoint = input.endpoint;
  }

  if (input.startedAt !== undefined) {
    payload.startedAt = input.startedAt;
  }

  return payload as SanitizedValue;
}

/** When emit receives a provider-error shaped payload, normalize defaults via the builder. */
export function normalizeProviderErrorEmitPayload(
  payload: SanitizedValue,
): SanitizedValue {
  if (!isProviderErrorEmitInput(payload)) {
    return payload;
  }

  return buildProviderErrorEmitPayload(payload);
}

function isProviderErrorEmitInput(
  value: unknown,
): value is ProviderErrorEmitInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  // Core event envelopes (e.g. provider.latency) must pass through unchanged.
  if (typeof record.eventName === 'string') {
    return false;
  }

  if (typeof record.provider !== 'string') {
    return false;
  }

  if (!('providerPayload' in record)) {
    return false;
  }

  return true;
}
