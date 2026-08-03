import { getPlaidSimulationScenario, buildPlaidSimulationScenarios } from './plaid-simulation-scenarios';

describe('plaid-simulation-scenarios', () => {
  it('resolves registered routes from the shared registry', () => {
    expect(getPlaidSimulationScenario('institution-down')).toMatchObject({
      kind: 'error',
      fixtureKey: 'INSTITUTION_DOWN',
    });
    expect(getPlaidSimulationScenario('missing')).toBeUndefined();
  });

  it('builds cron scenarios only for entries with frequency > 0', () => {
    const scenarios = buildPlaidSimulationScenarios();

    expect(scenarios.every((scenario) => scenario.frequency > 0)).toBe(true);
    expect(scenarios.map((scenario) => scenario.endpoint)).toEqual(
      expect.arrayContaining(['item-created', 'institution-down']),
    );
    expect(scenarios.map((scenario) => scenario.endpoint)).not.toContain(
      'slow-response',
    );
  });
});
