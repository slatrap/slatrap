import { type IncidentSeverity } from './incident.types';

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function maxSeverity(
  current: IncidentSeverity,
  incoming: IncidentSeverity,
): IncidentSeverity {
  return SEVERITY_RANK[incoming] > SEVERITY_RANK[current]
    ? incoming
    : current;
}
