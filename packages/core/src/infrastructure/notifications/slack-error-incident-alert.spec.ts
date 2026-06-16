import { buildErrorIncidentSlackAlert } from './slack-error-incident-alert';
import { type ErrorIncidentSummary } from '../../domain/incidents/incident.types';

describe('buildErrorIncidentSlackAlert', () => {
  const summary: ErrorIncidentSummary = {
    provider: 'stripe',
    errorCode: 'timeout',
    errorType: 'api_connection_error',
    errorMessage: 'Request timed out',
    endpoint: '/stripe/charges',
    statusCode: 504,
    severity: 'low',
    requestId: 'req_123',
    latency: 5000,
    metadata: { userId: 'user_01' },
  };

  it('uses incident severity from context instead of summary', () => {
    const alert = JSON.parse(
      buildErrorIncidentSlackAlert(summary, {
        incidentId: 42,
        occurrenceCount: 100,
        severity: 'critical',
      }),
    );

    expect(alert.type).toBe('error_incident');
    expect(alert.severity).toBe('critical');
    expect(alert.previousSeverity).toBeUndefined();
    expect(alert.occurrenceCount).toBe(100);
  });

  it('marks escalations when severity increases on duplicate incidents', () => {
    const alert = JSON.parse(
      buildErrorIncidentSlackAlert(summary, {
        incidentId: 42,
        occurrenceCount: 50,
        severity: 'high',
        previousSeverity: 'low',
      }),
    );

    expect(alert.type).toBe('error_incident_escalation');
    expect(alert.severity).toBe('high');
    expect(alert.previousSeverity).toBe('low');
  });

  it('does not mark escalation when severity is unchanged', () => {
    const alert = JSON.parse(
      buildErrorIncidentSlackAlert(summary, {
        incidentId: 42,
        occurrenceCount: 2,
        severity: 'medium',
        previousSeverity: 'medium',
      }),
    );

    expect(alert.type).toBe('error_incident');
    expect(alert.previousSeverity).toBeUndefined();
  });
});
