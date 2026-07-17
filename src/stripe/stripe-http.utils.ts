import { type ConfigService } from '@nestjs/config';
import {
  buildHttpTimeoutTransportError,
  DEFAULT_HTTP_TIMEOUT_MS,
  isHttpTimeoutError,
  parseHttpTimeoutMs,
  type HttpTimeoutTransportError,
} from '@slatrap/slatrap';
import { type StripeErrorObject } from './stripe-simulator.definitions';

export const DEFAULT_STRIPE_HTTP_TIMEOUT_MS = DEFAULT_HTTP_TIMEOUT_MS;

export type StripeHttpError = HttpTimeoutTransportError & {
  response: {
    status: number;
    data: { error: StripeErrorObject };
    headers: Record<string, string>;
  };
};

export function readStripeHttpTimeoutMs(
  configService: Pick<ConfigService, 'get'>,
): number {
  return parseHttpTimeoutMs(
    configService.get<string | number>('STRIPE_HTTP_TIMEOUT_MS'),
  );
}

export const isStripeTimeoutError = isHttpTimeoutError;

export function toStripeHttpTimeoutError(
  timeoutMs: number,
  cause?: unknown,
): StripeHttpError {
  const message = `Stripe API request timed out after ${timeoutMs}ms`;

  return buildHttpTimeoutTransportError({
    timeoutMs,
    cause,
    data: {
      error: {
        type: 'api_connection_error',
        code: 'timeout',
        message,
      } satisfies StripeErrorObject,
    },
  }) as StripeHttpError;
}
