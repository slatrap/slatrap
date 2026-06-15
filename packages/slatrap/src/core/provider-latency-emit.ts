import { type SanitizedValue } from '../sanitization/sanitizer';

export const PROVIDER_LATENCY_EVENT_NAME = 'provider.latency';

export type ProviderLatencyEmitInput = {
  provider: string;
  endpoint: string;
  latencyMs: number;
  success: boolean;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
};

export function buildProviderLatencyEmitPayload(
  input: ProviderLatencyEmitInput,
): SanitizedValue {
  const payload: Record<string, unknown> = {
    provider: input.provider,
    endpoint: input.endpoint,
    latencyMs: input.latencyMs,
    success: input.success,
    statusCode: input.statusCode ?? null,
  };

  if (input.metadata !== undefined) {
    payload.metadata = input.metadata;
  }

  return {
    eventName: PROVIDER_LATENCY_EVENT_NAME,
    payload: payload as SanitizedValue,
  };
}
