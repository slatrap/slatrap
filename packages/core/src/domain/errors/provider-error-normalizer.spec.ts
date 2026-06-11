import { normalizeFintechPayload } from './provider-error-normalizer';

describe('normalizeFintechPayload', () => {
  it('normalizes direct plaid payload fields', () => {
    const payload = {
      error_code: 'ITEM_LOGIN_REQUIRED',
      error_type: 'ITEM_ERROR',
      error_message: 'Re-auth required',
      request_id: 'req_001',
      user_id: 'user_123',
      item_id: 'item_abc',
      institution_id: 'ins_109508',
      institution_name: 'First Platypus Bank',
    };

    const result = normalizeFintechPayload(payload);

    expect(result).toEqual({
      provider: 'plaid',
      payload,
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorType: 'ITEM_ERROR',
      errorMessage: 'Re-auth required',
      requestId: 'req_001',
      userId: 'user_123',
      itemId: 'item_abc',
      institutionId: 'ins_109508',
      institutionName: 'First Platypus Bank',
    });
  });

  it('uses explicit provider over detected provider', () => {
    const payload = {
      error_code: 'RATE_LIMIT_EXCEEDED',
      error_type: 'API_ERROR',
    };

    const result = normalizeFintechPayload(payload, 'stripe');

    expect(result.provider).toBe('stripe');
  });

  it('unwraps axios-like nested response.data payloads', () => {
    const payload = {
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: {
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_type: 'ITEM_ERROR',
          request_id: 'req_nested',
        },
      },
    };

    const result = normalizeFintechPayload(payload);

    expect(result.provider).toBe('plaid');
    expect(result.payload).toEqual(payload.response.data);
    expect(result.errorCode).toBe('ITEM_LOGIN_REQUIRED');
    expect(result.requestId).toBe('req_nested');
  });

  it('unwraps provider-key nested payloads (plaid/stripe envelope)', () => {
    const payload = {
      plaid: {
        error_code: 'INVALID_INPUT',
        error_type: 'INVALID_REQUEST',
        error_message: 'Bad request',
      },
    };

    const result = normalizeFintechPayload(payload);

    expect(result.provider).toBe('plaid');
    expect(result.payload).toEqual(payload.plaid);
    expect(result.errorMessage).toBe('Bad request');
  });

  it('detects stripe payload shape and maps type/code fields', () => {
    const payload = {
      type: 'card_error',
      code: 'card_declined',
      message: 'Your card was declined.',
      requestId: 'req_stripe_01',
      userId: 'user_stripe_01',
    };

    const result = normalizeFintechPayload(payload);

    expect(result.provider).toBe('stripe');
    expect(result.errorType).toBe('card_error');
    expect(result.errorCode).toBe('card_declined');
    expect(result.errorMessage).toBe('Your card was declined.');
    expect(result.requestId).toBe('req_stripe_01');
    expect(result.userId).toBe('user_stripe_01');
  });

  it('maps stripe timeout code to errorCode for stable dedup fingerprints', () => {
    const payload = {
      stripe: {
        type: 'api_connection_error',
        code: 'timeout',
        message: 'Stripe API request timed out after 300ms',
      },
    };

    const result = normalizeFintechPayload(payload);

    expect(result.provider).toBe('stripe');
    expect(result.errorType).toBe('api_connection_error');
    expect(result.errorCode).toBe('timeout');
    expect(result.errorMessage).toBe('Stripe API request timed out after 300ms');
  });
});
