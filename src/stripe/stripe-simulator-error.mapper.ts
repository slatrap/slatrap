import { Injectable } from '@nestjs/common';
import { type StripeErrorObject } from './stripe-simulator.definitions';

const SYNC_STRIPE_ERROR_TYPES = new Set([
  'invalid_request_error',
  'authentication_error',
  'api_connection_error',
]);

type StripeErrorResponse = {
  status?: number;
  data?: unknown;
  headers?: Record<string, string>;
};

export type StripeMappedError = {
  stripeError: StripeErrorObject;
  httpStatus: number;
  requestId?: string;
  shouldEmitProviderEvent: boolean;
};

@Injectable()
export class StripeSimulatorErrorMapper {
  map(error: unknown): StripeMappedError {
    const stripeError = this.extractStripeError(error);
    const httpStatus = this.extractHttpStatus(error) ?? 402;
    const requestId = this.extractRequestId(error);

    return {
      stripeError,
      httpStatus,
      requestId,
      shouldEmitProviderEvent: this.shouldEmitInspectorEvent(stripeError),
    };
  }

  private extractStripeError(error: unknown): StripeErrorObject {
    const response = this.getResponse(error);
    const data = response?.data as { error?: StripeErrorObject } | undefined;
    return data?.error ?? (data as StripeErrorObject) ?? {};
  }

  private shouldEmitInspectorEvent(stripeError: StripeErrorObject): boolean {
    return Boolean(
      stripeError.type && SYNC_STRIPE_ERROR_TYPES.has(stripeError.type),
    );
  }

  private extractHttpStatus(error: unknown): number | undefined {
    const response = this.getResponse(error);
    return response?.status;
  }

  private extractRequestId(error: unknown): string | undefined {
    const response = this.getResponse(error);
    const headers = response?.headers;
    if (!headers) {
      return undefined;
    }

    return this.readHeader(headers, 'request-id', 'stripe-request-id');
  }

  private readHeader(
    headers: Record<string, string>,
    ...candidates: string[]
  ): string | undefined {
    for (const candidate of candidates) {
      const value = headers[candidate];
      if (typeof value === 'string') {
        return value;
      }
    }

    return undefined;
  }

  private getResponse(error: unknown): StripeErrorResponse | undefined {
    const maybeError = error as { response?: unknown };
    const response = maybeError?.response;
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    return response as StripeErrorResponse;
  }
}
