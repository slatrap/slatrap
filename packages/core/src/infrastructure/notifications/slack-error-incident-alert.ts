import {
  type ErrorIncidentSummary,
  type IncidentSeverity,
} from '../../domain/incidents/incident.types';
import { hasSeverityIncreased } from '../../domain/incidents/severity-rank';

export type ErrorIncidentSlackAlertContext = {
  incidentId?: number;
  occurrenceCount?: number;
  severity: IncidentSeverity;
  previousSeverity?: IncidentSeverity;
};

export function buildErrorIncidentSlackAlert(
  summary: ErrorIncidentSummary,
  context: ErrorIncidentSlackAlertContext,
): string {
  const isEscalation =
    context.previousSeverity !== undefined &&
    hasSeverityIncreased(context.previousSeverity, context.severity);

  return JSON.stringify(
    {
      type: isEscalation ? 'error_incident_escalation' : 'error_incident',
      incidentId: context.incidentId,
      severity: context.severity,
      previousSeverity: isEscalation ? context.previousSeverity : undefined,
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
