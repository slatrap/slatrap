import { type IncidentSeverity } from './incident.types';

export type ErrorSeverityInput = {
  provider?: string;
  errorCode?: string;
  errorType?: string;
  statusCode?: number;
};

export type SeverityRule = {
  severity: IncidentSeverity;
  priority: number;
  provider?: string;
  errorCode?: string | string[];
  errorType?: string | string[];
  statusCode?: number;
  statusCodeMin?: number;
  statusCodeMax?: number;
};

/**
 * Higher priority rules are evaluated first.
 * Provider-specific rules should outrank generic HTTP fallbacks.
 */
export const ERROR_SEVERITY_RULES: SeverityRule[] = [
  {
    priority: 100,
    severity: 'low',
    errorCode: ['timeout', 'api_connection_error'],
  },
  {
    priority: 90,
    severity: 'critical',
    statusCodeMin: 500,
    statusCodeMax: 599,
  },
  {
    priority: 80,
    severity: 'high',
    provider: 'stripe',
    errorCode: ['stolen_card', 'fraudulent'],
  },
  {
    priority: 80,
    severity: 'high',
    provider: 'plaid',
    errorCode: ['INSTITUTION_NOT_RESPONDING', 'INTERNAL_SERVER_ERROR'],
  },
  {
    priority: 70,
    severity: 'high',
    statusCode: 429,
  },
  {
    priority: 60,
    severity: 'high',
    statusCode: 504,
  },
  {
    priority: 50,
    severity: 'medium',
    provider: 'plaid',
    errorCode: ['ITEM_LOGIN_REQUIRED', 'INVALID_ACCESS_TOKEN'],
  },
  {
    priority: 50,
    severity: 'medium',
    provider: 'stripe',
    errorCode: ['card_declined', 'insufficient_funds', 'account_closed'],
  },
  {
    priority: 40,
    severity: 'medium',
    statusCodeMin: 400,
    statusCodeMax: 499,
  },
  {
    priority: 10,
    severity: 'low',
    provider: 'stripe',
    errorType: 'card_error',
  },
  {
    priority: 0,
    severity: 'medium',
  },
];
