import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildErrorIncidentFingerprint,
  hashFingerprintParts,
} from './incident-fingerprint';
import { normalizeFintechPayload } from '../errors/provider-error-normalizer';

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
      errorType: '',
      errorCode: 'timeout',
      endpoint: '/stripe/charges',
      environment: 'simulation',
      fingerprintVersion: 1,
    });
  });

  it('groups stripe timeout events by endpoint + errorCode even when error type changes', () => {
    const base = {
      provider: 'stripe',
      errorCode: 'timeout',
      endpoint: '/stripe/charges',
      environment: 'simulation',
    };

    const apiConnectionTimeout = buildErrorIncidentFingerprint({
      ...base,
      errorType: 'api_connection_error',
    });
    const genericTimeout = buildErrorIncidentFingerprint({
      ...base,
      errorType: 'rate_limit_error',
    });

    expect(apiConnectionTimeout.hash).toBe(genericTimeout.hash);
  });

  it('keeps stripe non-timeout errors separated by error category', () => {
    const base = {
      provider: 'stripe',
      errorCode: 'card_declined',
      endpoint: '/stripe/charges',
      environment: 'simulation',
    };

    const cardError = buildErrorIncidentFingerprint({
      ...base,
      errorType: 'card_error',
    });
    const processingError = buildErrorIncidentFingerprint({
      ...base,
      errorType: 'processing_error',
    });

    expect(cardError.hash).not.toBe(processingError.hash);
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

  it('keeps plaid grouping based on endpoint + errorCode + errorType using simulation payloads', () => {
    const testCases = readSimulationPayloads();
    const loginRequired = normalizeFintechPayload(testCases.ITEM_LOGIN_REQUIRED);
    const invalidAccessToken = normalizeFintechPayload(
      testCases.INVALID_ACCESS_TOKEN,
    );

    const loginRequiredFingerprint = buildErrorIncidentFingerprint({
      provider: loginRequired.provider ?? 'plaid',
      errorCode: loginRequired.errorCode ?? '',
      errorType: loginRequired.errorType ?? '',
      endpoint: '/plaid/item-login-required',
      environment: 'simulation',
      metadata: {
        institutionId: 'ins_109508',
      },
    });
    const invalidAccessTokenFingerprint = buildErrorIncidentFingerprint({
      provider: invalidAccessToken.provider ?? 'plaid',
      errorCode: invalidAccessToken.errorCode ?? '',
      errorType: invalidAccessToken.errorType ?? '',
      endpoint: '/plaid/item-login-required',
      environment: 'simulation',
      metadata: {
        institutionId: 'ins_109508',
      },
    });

    expect(loginRequiredFingerprint.hash).not.toBe(
      invalidAccessTokenFingerprint.hash,
    );
  });

  it('uses default strategy for unsupported providers', () => {
    const retryableNetworkError = buildErrorIncidentFingerprint({
      provider: 'adyen',
      errorCode: 'timeout',
      errorType: 'network_error',
      endpoint: '/adyen/payments',
      environment: 'production',
    });
    const validationError = buildErrorIncidentFingerprint({
      provider: 'adyen',
      errorCode: 'timeout',
      errorType: 'validation_error',
      endpoint: '/adyen/payments',
      environment: 'production',
    });

    expect(retryableNetworkError.hash).not.toBe(validationError.hash);
    expect(retryableNetworkError.parts.fingerprintVersion).toBe(1);
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

function readSimulationPayloads(): Record<string, unknown> {
  const filePath = path.resolve(__dirname, '../../../../../test-cases.json');
  const raw = fs.readFileSync(filePath, 'utf8');

  return JSON.parse(raw) as Record<string, unknown>;
}
