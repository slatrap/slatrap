export type IncidentSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

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
};
