import { type IncidentSeverity } from './incident.types';
import { bumpSeverity, maxSeverity } from './severity-rank';

export type IncidentSeverityContext = {
  baseSeverity: IncidentSeverity;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  windowSeconds: number;
  provider: string;
  priorIncidentCount?: number;
};

export type IncidentSeverityThresholds = {
  countHigh: number;
  countElevated: number;
  countCritical: number;
  frequencyHighPerSec: number;
  recurrenceMinPriorIncidents: number;
};

export const DEFAULT_INCIDENT_SEVERITY_THRESHOLDS: IncidentSeverityThresholds =
  {
    countHigh: 10,
    countElevated: 50,
    countCritical: 100,
    frequencyHighPerSec: 1,
    recurrenceMinPriorIncidents: 2,
  };

export function resolveIncidentSeverity(
  input: IncidentSeverityContext,
  thresholds: IncidentSeverityThresholds = DEFAULT_INCIDENT_SEVERITY_THRESHOLDS,
): IncidentSeverity {
  let resolved = input.baseSeverity;

  if (input.count >= thresholds.countCritical) {
    resolved = maxSeverity(resolved, 'critical');
  } else if (input.count >= thresholds.countElevated) {
    resolved = maxSeverity(resolved, 'high');
  } else if (input.count >= thresholds.countHigh) {
    resolved = maxSeverity(resolved, 'medium');
  }

  if (input.count > 1) {
    const durationMs = Math.max(
      input.lastSeenAt.getTime() - input.firstSeenAt.getTime(),
      1000,
    );
    const errorsPerSecond = input.count / (durationMs / 1000);

    if (errorsPerSecond >= thresholds.frequencyHighPerSec) {
      resolved = bumpSeverity(resolved, 1);
    }
  }

  const priorIncidents = input.priorIncidentCount ?? 0;
  if (priorIncidents >= thresholds.recurrenceMinPriorIncidents) {
    resolved = bumpSeverity(resolved, 1);
  }

  return resolved;
}
