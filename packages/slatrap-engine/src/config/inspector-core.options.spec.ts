import { createInspectorCoreOptionsFromConfigService } from './inspector-core.options';

describe('createInspectorCoreOptionsFromConfigService', () => {
  it('maps error severity threshold env vars', () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          ERROR_SEVERITY_COUNT_HIGH: '5',
          ERROR_SEVERITY_COUNT_ELEVATED: '20',
          ERROR_SEVERITY_COUNT_CRITICAL: '40',
          ERROR_SEVERITY_FREQUENCY_HIGH_PER_SEC: '2',
          ERROR_SEVERITY_RECURRENCE_MIN_PRIOR_INCIDENTS: '3',
          ERROR_DEDUP_WINDOW_SECONDS: 300,
          REDIS_PORT: 6379,
        };

        return values[key] ?? defaultValue;
      }),
    };

    const options = createInspectorCoreOptionsFromConfigService(
      configService as never,
    );

    expect(options.errorSeverityThresholds).toEqual({
      countHigh: 5,
      countElevated: 20,
      countCritical: 40,
      frequencyHighPerSec: 2,
      recurrenceMinPriorIncidents: 3,
    });
  });

  it('maps incident environment from APP_PROFILE', () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          APP_PROFILE: 'simulation',
          ERROR_DEDUP_WINDOW_SECONDS: 300,
          REDIS_PORT: 6379,
        };

        return values[key] ?? defaultValue;
      }),
    };

    const options = createInspectorCoreOptionsFromConfigService(
      configService as never,
    );

    expect(options.incidentEnvironment).toBe('simulation');
  });
});
