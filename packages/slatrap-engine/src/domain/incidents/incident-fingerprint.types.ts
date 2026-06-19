export const INCIDENT_FINGERPRINT_VERSION = 1;

export type ErrorIncidentFingerprintParts = {
  provider: string;
  errorType: string;
  errorCode: string;
  endpoint: string;
  environment: string;
  fingerprintVersion: number;
};

export type ErrorIncidentFingerprint = {
  parts: ErrorIncidentFingerprintParts;
  hash: string;
  cacheKey: string;
};

export type BuildErrorIncidentFingerprintInput = {
  provider: string;
  errorCode: string;
  errorType: string;
  endpoint: string;
  environment?: string;
  metadata?: Record<string, unknown>;
};
