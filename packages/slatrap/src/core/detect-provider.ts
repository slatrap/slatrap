import { isRecord } from './is-record';

export type DetectedProvider = 'plaid' | 'stripe';

/**
 * Infers the fintech provider from a raw error response payload.
 * Used by emit paths (SDK interceptor) and ingest paths (engine normalizer).
 */
export function detectProvider(payload: unknown): DetectedProvider | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if ('error_code' in payload || 'error_type' in payload) {
    return 'plaid';
  }

  if ('type' in payload || 'code' in payload) {
    return 'stripe';
  }

  return undefined;
}
