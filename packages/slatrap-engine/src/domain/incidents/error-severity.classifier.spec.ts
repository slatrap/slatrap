import { classifyErrorSeverity } from './error-severity.classifier';
import {
  ERROR_SEVERITY_RULES,
  type ErrorSeverityInput,
  type SeverityRule,
} from './severity-rules';

describe('classifyErrorSeverity', () => {
  it('classifies a single provider timeout as low', () => {
    expect(
      classifyErrorSeverity({
        provider: 'stripe',
        errorCode: 'timeout',
        errorType: 'api_connection_error',
        statusCode: 504,
      }),
    ).toBe('low');
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

  it('classifies 504 responses as critical', () => {
    expect(classifyErrorSeverity({ statusCode: 504 })).toBe('critical');
  });

  it('has no unreachable severity rules', () => {
    const orderedRules = [...ERROR_SEVERITY_RULES].sort(
      (left, right) => right.priority - left.priority,
    );

    orderedRules.forEach((rule, index) => {
      const input: ErrorSeverityInput = {
        provider: rule.provider,
        errorCode: Array.isArray(rule.errorCode)
          ? rule.errorCode[0]
          : rule.errorCode,
        errorType: Array.isArray(rule.errorType)
          ? rule.errorType[0]
          : rule.errorType,
        statusCode: rule.statusCode ?? rule.statusCodeMin ?? rule.statusCodeMax,
      };
      const fallbackRule: SeverityRule = {
        priority: rule.priority - 1,
        severity: rule.severity === 'critical' ? 'low' : 'critical',
      };

      expect(
        classifyErrorSeverity(input, [
          ...orderedRules.slice(0, index + 1),
          fallbackRule,
        ]),
      ).toBe(rule.severity);
    });
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
