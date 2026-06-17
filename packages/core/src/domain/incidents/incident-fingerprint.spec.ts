import {
  buildErrorIncidentFingerprint,
  hashFingerprintParts,
} from './incident-fingerprint';

describe('buildErrorIncidentFingerprint', () => {
  it('generates a stable hash for the same stripe timeout on the same endpoint', () => {
    const input = {
      provider: 'stripe',
      errorType: 'api_connection_error',
      errorCode: 'timeout',
      endpoint: '/stripe/charges',
      environment: 'simulation',
    };

    const first = buildErrorIncidentFingerprint(input);
    const second = buildErrorIncidentFingerprint(input);

    expect(first.hash).toBe(second.hash);
    expect(first.cacheKey).toBe(`error:fp:${first.hash}`);
    expect(first.parts).toEqual({
      provider: 'stripe',
      errorCategory: 'api_connection_error',
      errorCode: 'timeout',
      endpoint: '/stripe/charges',
      environment: 'simulation',
      fingerprintVersion: 1,
    });
  });

  it('creates separate fingerprints for different error codes', () => {
    const base = {
      provider: 'stripe',
      errorType: 'card_error',
      endpoint: '/stripe/charges',
      environment: 'simulation',
    };

    const insufficientFunds = buildErrorIncidentFingerprint({
      ...base,
      errorCode: 'insufficient_funds',
    });
    const timeout = buildErrorIncidentFingerprint({
      ...base,
      errorCode: 'timeout',
      errorType: 'api_connection_error',
    });

    expect(insufficientFunds.hash).not.toBe(timeout.hash);
  });

  it('creates separate fingerprints for different endpoints', () => {
    const base = {
      provider: 'stripe',
      errorType: 'api_connection_error',
      errorCode: 'timeout',
      environment: 'simulation',
    };

    const charges = buildErrorIncidentFingerprint({
      ...base,
      endpoint: '/stripe/charges',
    });
    const refunds = buildErrorIncidentFingerprint({
      ...base,
      endpoint: '/stripe/refunds',
    });

    expect(charges.hash).not.toBe(refunds.hash);
  });

  it('creates separate fingerprints for different environments', () => {
    const base = {
      provider: 'plaid',
      errorType: 'item_error',
      errorCode: 'item_login_required',
      endpoint: '/plaid/transactions/get',
    };

    const simulation = buildErrorIncidentFingerprint({
      ...base,
      environment: 'simulation',
    });
    const production = buildErrorIncidentFingerprint({
      ...base,
      environment: 'production',
    });

    expect(simulation.hash).not.toBe(production.hash);
  });

  it('changes the hash when fingerprint version changes', () => {
    const parts = buildErrorIncidentFingerprint({
      provider: 'stripe',
      errorType: 'card_error',
      errorCode: 'card_declined',
      endpoint: '/stripe/charges',
      environment: 'simulation',
    }).parts;

    const nextVersionHash = hashFingerprintParts({
      ...parts,
      fingerprintVersion: 2,
    });

    expect(nextVersionHash).not.toBe(hashFingerprintParts(parts));
  });
});
