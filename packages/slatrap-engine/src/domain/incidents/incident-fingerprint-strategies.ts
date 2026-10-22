import {
  INCIDENT_FINGERPRINT_VERSION,
  type BuildErrorIncidentFingerprintInput,
  type ErrorIncidentFingerprintParts,
} from './incident-fingerprint.types';
import { normalizeEndpointForFingerprint } from './incident-endpoint-normalizer';

export type FingerprintStrategyInput = {
  provider: string;
  errorType: string;
  errorCode: string;
  statusClass: string;
  endpoint: string;
  environment: string;
  metadata: Record<string, unknown>;
};

export type FingerprintStrategy = (
  input: FingerprintStrategyInput,
) => ErrorIncidentFingerprintParts;

export const DEFAULT_STRATEGY: FingerprintStrategy = (input) => ({
  provider: input.provider,
  errorType: input.errorType || 'unknown',
  errorCode: input.errorCode,
  statusClass: input.statusClass,
  endpoint: input.endpoint,
  environment: input.environment,
  fingerprintVersion: INCIDENT_FINGERPRINT_VERSION,
});

export const stripeFingerprintStrategy: FingerprintStrategy = (input) => {
  if (isStripeTimeoutFingerprint(input)) {
    // Stripe timeout bursts should collapse by endpoint + error code.
    return {
      ...DEFAULT_STRATEGY(input),
      errorType: '',
    };
  }

  return DEFAULT_STRATEGY(input);
};

export const plaidFingerprintStrategy: FingerprintStrategy = (input) => {
  return DEFAULT_STRATEGY(input);
};

const STRATEGIES: Record<string, FingerprintStrategy> = {
  stripe: stripeFingerprintStrategy,
  plaid: plaidFingerprintStrategy,
};

export function buildFingerprintStrategyInput(
  input: BuildErrorIncidentFingerprintInput,
): FingerprintStrategyInput {
  const errorCode = normalizeFingerprintValue(input.errorCode);

  return {
    provider: normalizeFingerprintValue(input.provider),
    errorType: normalizeFingerprintValue(input.errorType),
    errorCode,
    statusClass: GENERIC_ERROR_CODES.has(errorCode)
      ? toStatusClass(input.statusCode)
      : '',
    endpoint: normalizeEndpointForFingerprint(input.endpoint ?? ''),
    environment: normalizeFingerprintValue(input.environment ?? 'unknown'),
    metadata: input.metadata ?? {},
  };
}

export function resolveFingerprintStrategy(provider: string): FingerprintStrategy {
  return STRATEGIES[provider] ?? DEFAULT_STRATEGY;
}

const GENERIC_ERROR_CODES = new Set([
  '',
  'api_error',
  'unknown',
  'internal_error',
  'server_error',
]);

function toStatusClass(statusCode: number | undefined): string {
  if (statusCode === undefined || statusCode < 100 || statusCode > 599) {
    return '';
  }

  return `${Math.floor(statusCode / 100)}xx`;
}

function normalizeFingerprintValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function isStripeTimeoutFingerprint(input: FingerprintStrategyInput): boolean {
  return (
    input.provider === 'stripe' &&
    (input.errorCode === 'timeout' ||
      input.errorType === 'api_connection_error')
  );
}