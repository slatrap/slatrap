import { type IncidentSeverity } from './incident.types';

const SEVERITY_ORDER: IncidentSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
];

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

export function bumpSeverity(
  severity: IncidentSeverity,
  levels = 1,
): IncidentSeverity {
  const index = SEVERITY_ORDER.indexOf(severity);
  const nextIndex = Math.min(index + levels, SEVERITY_ORDER.length - 1);
  return SEVERITY_ORDER[nextIndex];
}