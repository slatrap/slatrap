import { classifyErrorSeverity } from './error-severity.classifier';

describe('classifyErrorSeverity', () => {
  it('classifies provider timeouts as critical', () => {
    expect(
      classifyErrorSeverity({
        provider: 'stripe',
        errorCode: 'timeout',
        errorType: 'api_connection_error',
        statusCode: 504,
      }),
    ).toBe('critical');
  });

  it('classifies 5xx responses as critical', () => {
    expect(
      classifyErrorSeverity({
        provider: 'plaid',
        errorCode: 'INTERNAL_SERVER_ERROR',
        statusCode: 503,
      }),
    ).toBe('critical');
  });

  it('classifies rate limits as high', () => {
    expect(
      classifyErrorSeverity({
        provider: 'plaid',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
      }),
    ).toBe('high');
  });

  it('classifies stripe fraud signals as high', () => {
    expect(
      classifyErrorSeverity({
        provider: 'stripe',
        errorCode: 'fraudulent',
        errorType: 'card_error',
        statusCode: 402,
      }),
    ).toBe('high');
  });

  it('classifies common plaid re-auth errors as medium', () => {
    expect(
      classifyErrorSeverity({
        provider: 'plaid',
        errorCode: 'ITEM_LOGIN_REQUIRED',
        errorType: 'ITEM_ERROR',
        statusCode: 400,
      }),
    ).toBe('medium');
  });

  it('classifies generic card declines as medium', () => {
    expect(
      classifyErrorSeverity({
        provider: 'stripe',
        errorCode: 'insufficient_funds',
        errorType: 'card_error',
        statusCode: 402,
      }),
    ).toBe('medium');
  });
});
