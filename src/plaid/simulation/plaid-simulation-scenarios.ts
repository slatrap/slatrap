export type PlaidSimulationScenarioKind =
  | 'error'
  | 'item-created'
  | 'slow-response';

export type PlaidSimulationScenarioDefinition = {
  /** HTTP path segment under `/plaid/` */
  route: string;
  kind: PlaidSimulationScenarioKind;
  /** Key in test-cases.json when kind is `error` */
  fixtureKey?: string;
  name: string;
  expectedError: string;
  /** Cron selection weight; `0` excludes from auto-simulation */
  frequency: number;
};

/**
 * Single source of truth for Plaid simulation routes, fixtures, and cron metadata.
 * Add a scenario here — controller/service dispatch from this registry.
 */
export const PLAID_SIMULATION_SCENARIOS = [
  {
    route: 'item-created',
    kind: 'item-created',
    name: 'Item Created Scenario',
    expectedError: 'NONE',
    frequency: 0.05,
  },
  {
    route: 'institution-down',
    kind: 'error',
    fixtureKey: 'INSTITUTION_DOWN',
    name: 'Bank Down Scenario',
    expectedError: 'INSTITUTION_DOWN',
    frequency: 0.05,
  },
  {
    route: 'accounts-limit',
    kind: 'error',
    fixtureKey: 'ACCOUNTS_LIMIT',
    name: 'Rate Limit Scenario',
    expectedError: 'ACCOUNTS_LIMIT',
    frequency: 0.05,
  },
  {
    route: 'no-accounts',
    kind: 'error',
    fixtureKey: 'NO_ACCOUNTS',
    name: 'No Accounts Scenario',
    expectedError: 'NO_ACCOUNTS',
    frequency: 0.05,
  },
  {
    route: 'institution-not-responding',
    kind: 'error',
    fixtureKey: 'INSTITUTION_NOT_RESPONDING',
    name: 'Institution Not Responding Scenario',
    expectedError: 'INSTITUTION_NOT_RESPONDING',
    frequency: 0.05,
  },
  {
    route: 'item-login-required',
    kind: 'error',
    fixtureKey: 'ITEM_LOGIN_REQUIRED',
    name: 'Item Login Required Scenario',
    expectedError: 'ITEM_LOGIN_REQUIRED',
    frequency: 0.05,
  },
  {
    route: 'invalid-access-token',
    kind: 'error',
    fixtureKey: 'INVALID_ACCESS_TOKEN',
    name: 'Invalid Access Token Scenario',
    expectedError: 'INVALID_ACCESS_TOKEN',
    frequency: 0.05,
  },
  {
    route: 'slow-response',
    kind: 'slow-response',
    name: 'Slow Response Scenario',
    expectedError: 'NONE',
    frequency: 0,
  },
] as const satisfies readonly PlaidSimulationScenarioDefinition[];

export type PlaidSimulationRoute =
  (typeof PLAID_SIMULATION_SCENARIOS)[number]['route'];

export type PlaidSimulationScenario = {
  name: string;
  provider: 'plaid';
  expectedError: string;
  endpoint?: string;
  frequency: number;
  requestPath: string;
  buildRequestBody: () => Promise<unknown>;
};

const scenariosByRoute = new Map<string, PlaidSimulationScenarioDefinition>(
  PLAID_SIMULATION_SCENARIOS.map((scenario) => [scenario.route, scenario]),
);

export function getPlaidSimulationScenario(
  route: string,
): PlaidSimulationScenarioDefinition | undefined {
  return scenariosByRoute.get(route);
}

/** Cron auto-simulation entries derived from the shared registry. */
export function buildPlaidSimulationScenarios(): PlaidSimulationScenario[] {
  return PLAID_SIMULATION_SCENARIOS.filter(
    (scenario) => scenario.frequency > 0,
  ).map((scenario) => ({
    name: scenario.name,
    provider: 'plaid',
    expectedError: scenario.expectedError,
    endpoint: scenario.route,
    frequency: scenario.frequency,
    requestPath: `/plaid/${scenario.route}`,
    buildRequestBody: () => Promise.resolve(undefined),
  }));
}
