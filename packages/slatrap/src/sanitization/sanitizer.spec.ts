import { sanitizeErrorData, type SanitizedValue } from './sanitizer';

describe('sanitizeErrorData', () => {
  it('strips unknown fields by default and keeps whitelisted fintech keys', () => {
    const sanitized = sanitizeErrorData({
      provider: 'stripe',
      endpoint: '/stripe/webhook',
      statusCode: 402,
      providerPayload: {
        type: 'card_error',
        code: 'insufficient_funds',
      },
      unexpected: 'remove-me',
    });

    expect(sanitized).toEqual({
      provider: 'stripe',
      endpoint: '/stripe/webhook',
      statusCode: 402,
      providerPayload: {
        type: 'card_error',
        code: 'insufficient_funds',
      },
    });
  });

  it('keeps startedAt so emit can derive latency', () => {
    const sanitized = sanitizeErrorData({
      provider: 'stripe',
      endpoint: '/stripe/charges',
      statusCode: 402,
      startedAt: 1_700_000_000_000,
      providerPayload: { type: 'card_error', code: 'card_declined' },
    });

    expect(sanitized).toEqual({
      provider: 'stripe',
      endpoint: '/stripe/charges',
      statusCode: 402,
      startedAt: 1_700_000_000_000,
      providerPayload: { type: 'card_error', code: 'card_declined' },
    });
  });

  it('allows extending whitelist via options.whitelist', () => {
    const sanitized = sanitizeErrorData(
      {
        provider: 'plaid',
        traceId: 'trace-001',
        customDetails: {
          keepMe: 'yes',
        },
      },
      {
        whitelist: ['traceId', 'customDetails', 'keepMe'],
      },
    );

    expect(sanitized).toEqual({
      provider: 'plaid',
      traceId: 'trace-001',
      customDetails: {
        keepMe: 'yes',
      },
    });
  });

  it('redacts sensitive values for whitelisted keys', () => {
    const sanitized = sanitizeErrorData({
      provider: 'stripe',
      providerPayload: {
        type: 'authentication_error',
        request_log_url: 'https://api.stripe.com/v1/logs/abc',
      },
    });

    expect(sanitized).toEqual({
      provider: 'stripe',
      providerPayload: {
        type: 'authentication_error',
        request_log_url: '[REDACTED]',
      },
    });
  });

  it('serializes Error instances and strips unknown fields from the result', () => {
    const error = new Error('network failure');
    error.name = 'StripeConnectionError';

    const sanitized: SanitizedValue = sanitizeErrorData(
      error,
    ) as unknown as SanitizedValue;

    expect(sanitized).toEqual({
      name: 'StripeConnectionError',
      message: 'network failure',
      stack: expect.any(String) as unknown,
    });
  });

  it('keeps custom fields only when they are explicitly whitelisted', () => {
    const sanitized: SanitizedValue = sanitizeErrorData(
      {
        createdAt: new Date('2026-05-08T10:00:00.000Z'),
        amount: BigInt(12345),
      },
      { whitelist: ['createdAt', 'amount'] },
    ) as unknown as SanitizedValue;

    expect(sanitized).toEqual({
      createdAt: '2026-05-08T10:00:00.000Z',
      amount: '12345',
    });
  });

  it('supports custom redaction text', () => {
    const sanitized = sanitizeErrorData(
      {
        provider: 'plaid',
        providerPayload: {
          message: 'keep this',
          request_log_url: 'https://secure.example/logs/1',
        },
      },
      { redactionText: '[HIDDEN]' },
    );

    expect(sanitized).toEqual({
      provider: 'plaid',
      providerPayload: {
        message: 'keep this',
        request_log_url: '[HIDDEN]',
      },
    });
  });
});
