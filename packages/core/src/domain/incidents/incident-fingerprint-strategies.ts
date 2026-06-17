import {
  INCIDENT_FINGERPRINT_VERSION,
  type BuildErrorIncidentFingerprintInput,
  type ErrorIncidentFingerprintParts,
} from './incident-fingerprint.types';

export type FingerprintStrategyInput = {
  provider: string;
  errorType: string;
  errorCode: string;
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
  return {
    provider: normalizeFingerprintValue(input.provider),
    errorType: normalizeFingerprintValue(input.errorType),
    errorCode: normalizeFingerprintValue(input.errorCode),
    endpoint: input.endpoint ?? '',
    environment: normalizeFingerprintValue(input.environment ?? 'unknown'),
    metadata: input.metadata ?? {},
  };
}

export function resolveFingerprintStrategy(provider: string): FingerprintStrategy {
  return STRATEGIES[provider] ?? DEFAULT_STRATEGY;
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