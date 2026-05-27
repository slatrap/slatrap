import { Injectable } from '@nestjs/common';
import { Slatrap } from '../../packages/slatrap/src';
import { type StripeErrorObject } from './stripe-simulator.definitions';

@Injectable()
export class StripeSimulatorEventPublisher {
  publishProviderError(params: {
    shouldEmitProviderEvent: boolean;
    endpoint: string;
    statusCode: number;
    providerPayload: StripeErrorObject & { userId?: string };
    latency: number;
  }) {
    if (!params.shouldEmitProviderEvent) {
      return;
    }

    void Slatrap.emit(
      Slatrap.sanitize({
        provider: 'stripe',
        endpoint: params.endpoint,
        statusCode: params.statusCode,
        providerPayload: params.providerPayload,
        latency: params.latency,
      }),
    );
  }
}
