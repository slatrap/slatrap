import {
  resolveIncidentSeverity,
  resolveIncidentSeverityThresholds,
} from './incident-severity.resolver';

describe('resolveIncidentSeverity', () => {
  const windowStart = new Date('2026-06-16T12:00:00.000Z');
  const windowEnd = new Date('2026-06-16T12:05:00.000Z');

  it('keeps a single timeout at low severity', () => {
    expect(
      resolveIncidentSeverity({
        baseSeverity: 'low',
        count: 1,
        firstSeenAt: windowStart,
        lastSeenAt: windowStart,
        windowSeconds: 300,
        provider: 'stripe',
      }),
    ).toBe('low');
  });

  it('escalates hundreds of payment failures to critical', () => {
    expect(
      resolveIncidentSeverity({
        baseSeverity: 'medium',
        count: 100,
        firstSeenAt: windowStart,
        lastSeenAt: windowEnd,
        windowSeconds: 300,
        provider: 'stripe',
      }),
    ).toBe('critical');
  });

  it('escalates high-volume errors to high before critical threshold', () => {
    expect(
      resolveIncidentSeverity({
        baseSeverity: 'low',
        count: 50,
        firstSeenAt: windowStart,
        lastSeenAt: windowEnd,
        windowSeconds: 300,
        provider: 'plaid',
      }),
    ).toBe('high');
  });

  it('bumps severity when error frequency exceeds one per second', () => {
    expect(
      resolveIncidentSeverity({
        baseSeverity: 'low',
        count: 5,
        firstSeenAt: windowStart,
        lastSeenAt: new Date('2026-06-16T12:00:02.000Z'),
        windowSeconds: 300,
        provider: 'plaid',
      }),
    ).toBe('medium');
  });

  it('bumps severity for recurring incidents', () => {
    expect(
      resolveIncidentSeverity({
        baseSeverity: 'low',
        count: 1,
        firstSeenAt: windowStart,
        lastSeenAt: windowStart,
        windowSeconds: 300,
        provider: 'plaid',
        priorIncidentCount: 2,
      }),
    ).toBe('medium');
  });
});

describe('resolveIncidentSeverityThresholds', () => {
  it('returns defaults when no overrides are provided', () => {
    expect(resolveIncidentSeverityThresholds()).toEqual({
      countHigh: 10,
      countElevated: 50,
      countCritical: 100,
      frequencyHighPerSec: 1,
      recurrenceMinPriorIncidents: 2,
    });
  });

  it('merges partial overrides with defaults', () => {
    expect(
      resolveIncidentSeverityThresholds({
        countElevated: 5,
        countCritical: 25,
      }),
    ).toEqual({
      countHigh: 10,
      countElevated: 5,
      countCritical: 25,
      frequencyHighPerSec: 1,
      recurrenceMinPriorIncidents: 2,
    });
  });
});
