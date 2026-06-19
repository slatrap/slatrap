import { buildErrorIncidentSummary } from './build-error-incident-summary';
import { buildErrorIncidentFingerprint } from './incident-fingerprint';

describe('buildErrorIncidentSummary', () => {
  it('combines severity, exported error fields, and a fingerprint', () => {
    const summary = buildErrorIncidentSummary({
      captured: {
        normalizedProvider: 'plaid',
        errorCode: 'ITEM_LOGIN_REQUIRED',
        errorType: 'ITEM_ERROR',
        errorMessage: 'Re-auth required',
        endpoint: '/plaid/item-login-required',
        statusCode: 400,
        requestId: 'req_001',
        metadata: {
          itemId: 'item_abc',
          institutionId: 'ins_109508',
          institutionName: 'First Platypus Bank',
        },
      },
      latency: 120,
      environment: 'simulation',
    });

    expect(summary).toEqual({
      provider: 'plaid',
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorType: 'ITEM_ERROR',
      errorMessage: 'Re-auth required',
      endpoint: '/plaid/item-login-required',
      statusCode: 400,
      severity: 'medium',
      requestId: 'req_001',
      latency: 120,
      metadata: {
        itemId: 'item_abc',
        institutionId: 'ins_109508',
        institutionName: 'First Platypus Bank',
      },
      fingerprint: buildErrorIncidentFingerprint({
        provider: 'plaid',
        errorCode: 'ITEM_LOGIN_REQUIRED',
        errorType: 'ITEM_ERROR',
        endpoint: '/plaid/item-login-required',
        environment: 'simulation',
      }),
    });
  });
});
