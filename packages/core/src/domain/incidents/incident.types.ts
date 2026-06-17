import { type ErrorIncidentFingerprint } from './incident-fingerprint.types';

export type IncidentSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type ErrorIncidentSummary = {
  provider: string;
  errorCode: string;
  errorType: string;
  errorMessage: string;
  endpoint: string;
  statusCode: number;
  severity: IncidentSeverity;
  requestId?: string;
  latency?: number;
  metadata: Record<string, unknown>;
  fingerprint: ErrorIncidentFingerprint;
};

export type ErrorIncidentResult = {
  isDuplicate: boolean;
  id?: number;
  count?: number;
  severity: IncidentSeverity;
  previousSeverity?: IncidentSeverity;
};
