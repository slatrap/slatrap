import { createHash } from 'node:crypto';
import {
  INCIDENT_FINGERPRINT_VERSION,
  type BuildErrorIncidentFingerprintInput,
  type ErrorIncidentFingerprint,
  type ErrorIncidentFingerprintParts,
} from './incident-fingerprint.types';

export const DEFAULT_FINGERPRINT_ENVIRONMENT = 'unknown';

export function buildDefaultFingerprintParts(
  input: BuildErrorIncidentFingerprintInput,
): ErrorIncidentFingerprintParts {
  return {
    provider: normalizeFingerprintValue(input.provider),
    errorCategory: normalizeFingerprintValue(input.errorType) || 'unknown',
    errorCode: normalizeFingerprintValue(input.errorCode),
    endpoint: input.endpoint ?? '',
    environment: normalizeFingerprintValue(
      input.environment ?? DEFAULT_FINGERPRINT_ENVIRONMENT,
    ),
    fingerprintVersion: INCIDENT_FINGERPRINT_VERSION,
  };
}

export function serializeFingerprintParts(
  parts: ErrorIncidentFingerprintParts,
): string {
  return [
    parts.fingerprintVersion,
    parts.provider,
    parts.errorCategory,
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

function normalizeFingerprintValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}
