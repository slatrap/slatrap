import { type ErrorIncidentSummary } from '../../domain/incidents/incident.types';

export function buildErrorIncidentSlackAlert(
  summary: ErrorIncidentSummary,
  context: {
    incidentId?: number;
    occurrenceCount?: number;
  } = {},
): string {
  return JSON.stringify(
    {
      type: 'error_incident',
      incidentId: context.incidentId,
      severity: summary.severity,
      provider: summary.provider,
      errorCode: summary.errorCode,
      errorType: summary.errorType,
      errorMessage: summary.errorMessage,
      endpoint: summary.endpoint,
      statusCode: summary.statusCode,
      requestId: summary.requestId,
      latency: summary.latency,
      occurrenceCount: context.occurrenceCount,
      metadata: summary.metadata,
    },
    null,
    2,
  );
}
