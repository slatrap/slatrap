import { ERROR_SEVERITY_RULES, type ErrorSeverityInput } from './severity-rules';
import { type IncidentSeverity } from './incident.types';

export function classifyErrorSeverity(
  input: ErrorSeverityInput,
  rules = ERROR_SEVERITY_RULES,
): IncidentSeverity {
  const normalized = normalizeSeverityInput(input);
  const orderedRules = [...rules].sort((left, right) => right.priority - left.priority);

  for (const rule of orderedRules) {
    if (matchesSeverityRule(normalized, rule)) {
      return rule.severity;
    }
  }

  return 'medium';
}

function normalizeSeverityInput(input: {
  provider?: string;
  errorCode?: string;
  errorType?: string;
  statusCode?: number | null;
}): ErrorSeverityInput {
  return {
    provider: input.provider?.toLowerCase(),
    errorCode: input.errorCode,
    errorType: input.errorType,
    statusCode: input.statusCode ?? undefined,
  };
}

function matchesSeverityRule(
  input: ErrorSeverityInput,
  rule: (typeof ERROR_SEVERITY_RULES)[number],
): boolean {
  if (rule.provider && rule.provider !== input.provider) {
    return false;
  }

  if (rule.errorCode && !matchesStringOrList(input.errorCode, rule.errorCode)) {
    return false;
  }

  if (rule.errorType && !matchesStringOrList(input.errorType, rule.errorType)) {
    return false;
  }

  if (rule.statusCode !== undefined && input.statusCode !== rule.statusCode) {
    return false;
  }

  if (
    rule.statusCodeMin !== undefined &&
    (input.statusCode === undefined || input.statusCode < rule.statusCodeMin)
  ) {
    return false;
  }

  if (
    rule.statusCodeMax !== undefined &&
    (input.statusCode === undefined || input.statusCode > rule.statusCodeMax)
  ) {
    return false;
  }

  return true;
}

function matchesStringOrList(
  value: string | undefined,
  expected: string | string[],
): boolean {
  if (!value) {
    return false;
  }

  if (Array.isArray(expected)) {
    return expected.includes(value);
  }

  return value === expected;
}
