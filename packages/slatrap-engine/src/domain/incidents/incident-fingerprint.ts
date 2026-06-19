import { createHash } from 'node:crypto';
import {
  type BuildErrorIncidentFingerprintInput,
  type ErrorIncidentFingerprint,
  type ErrorIncidentFingerprintParts,
} from './incident-fingerprint.types';
import {
  buildFingerprintStrategyInput,
  resolveFingerprintStrategy,
} from './incident-fingerprint-strategies';

export const DEFAULT_FINGERPRINT_ENVIRONMENT = 'unknown';

export function buildDefaultFingerprintParts(
  input: BuildErrorIncidentFingerprintInput,
): ErrorIncidentFingerprintParts {
  const strategyInput = buildFingerprintStrategyInput({
    ...input,
    environment: input.environment ?? DEFAULT_FINGERPRINT_ENVIRONMENT,
  });
  const strategy = resolveFingerprintStrategy(strategyInput.provider);

  return strategy(strategyInput);
}

export function serializeFingerprintParts(
  parts: ErrorIncidentFingerprintParts,
): string {
  return [
    parts.fingerprintVersion,
    parts.provider,
    parts.errorType,
    parts.errorCode,
    parts.endpoint,
    parts.environment,
  ].join('|');
}

export function hashFingerprintParts(
  parts: ErrorIncidentFingerprintParts,
): string {
  return createHash('sha256')
    .update(serializeFingerprintParts(parts))
    .digest('hex');
}

export function buildErrorIncidentFingerprint(
  input: BuildErrorIncidentFingerprintInput,
): ErrorIncidentFingerprint {
  const parts = buildDefaultFingerprintParts(input);
  const hash = hashFingerprintParts(parts);

  return {
    parts,
    hash,
    cacheKey: `error:fp:${hash}`,
  };
}
