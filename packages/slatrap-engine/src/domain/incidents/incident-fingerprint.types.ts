export const INCIDENT_FINGERPRINT_VERSION = 2;

export type ErrorIncidentFingerprintParts = {
  provider: string;
  errorType: string;
  errorCode: string;
  statusClass: string;
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
  statusCode?: number;
  endpoint: string;
  environment?: string;
  metadata?: Record<string, unknown>;
};
