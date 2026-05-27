export type PlaidSimulationScenario = {
  name: string;
  provider: 'plaid';
  expectedError: string;
  endpoint?: string;
  frequency: number;
  requestPath: string;
  buildRequestBody: () => Promise<unknown>;
};

export function buildPlaidSimulationScenarios(): PlaidSimulationScenario[] {
  return [
    {
      name: 'Bank Down Scenario',
      provider: 'plaid',
      expectedError: 'INSTITUTION_DOWN',
      endpoint: 'institution-down',
      frequency: 0.05,
      requestPath: '/plaid/institution-down',
      buildRequestBody: () => Promise.resolve(undefined),
    },
    {
      name: 'Rate Limit Scenario',
      provider: 'plaid',
      expectedError: 'ACCOUNTS_LIMIT',
      endpoint: 'accounts-limit',
      frequency: 0.05,
      requestPath: '/plaid/accounts-limit',
      buildRequestBody: () => Promise.resolve(undefined),
    },
    {
      name: 'No Accounts Scenario',
      provider: 'plaid',
      expectedError: 'NO_ACCOUNTS',
      endpoint: 'no-accounts',
      frequency: 0.05,
      requestPath: '/plaid/no-accounts',
      buildRequestBody: () => Promise.resolve(undefined),
    },
    {
      name: 'Institution Not Responding Scenario',
      provider: 'plaid',
      expectedError: 'INSTITUTION_NOT_RESPONDING',
      endpoint: 'institution-not-responding',
      frequency: 0.05,
      requestPath: '/plaid/institution-not-responding',
      buildRequestBody: () => Promise.resolve(undefined),
    },
    {
      name: 'Item Login Required Scenario',
      provider: 'plaid',
      expectedError: 'ITEM_LOGIN_REQUIRED',
      endpoint: 'item-login-required',
      frequency: 0.05,
      requestPath: '/plaid/item-login-required',
      buildRequestBody: () => Promise.resolve(undefined),
    },
    {
      name: 'Invalid Access Token Scenario',
      provider: 'plaid',
      expectedError: 'INVALID_ACCESS_TOKEN',
      endpoint: 'invalid-access-token',
      frequency: 0.05,
      requestPath: '/plaid/invalid-access-token',
      buildRequestBody: () => Promise.resolve(undefined),
    },
  ];
}
