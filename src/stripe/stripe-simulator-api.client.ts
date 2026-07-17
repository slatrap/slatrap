import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '@slatrap/slatrap';
import { type StripeSimulationSpec } from './stripe-simulator.definitions';
import {
  readStripeHttpTimeoutMs,
  toStripeHttpTimeoutError,
} from './stripe-http.utils';

const STRIPE_PAYMENT_INTENTS_URL = 'https://api.stripe.com/v1/payment_intents';

@Injectable()
export class StripeSimulatorApiClient {
  constructor(private readonly configService: ConfigService) {}

  async createDeclinedPaymentIntent(
    simulation: StripeSimulationSpec,
    externalRefId?: string,
    startedAt?: number,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is required to simulate Stripe errors',
      );
    }

    const body = simulation.buildBody(externalRefId);

    if (startedAt !== undefined) {
      body.set('metadata[start]', String(startedAt));
    }

    const timeoutMs = readStripeHttpTimeoutMs(this.configService);

    const response = await fetchWithTimeout(STRIPE_PAYMENT_INTENTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      timeoutMs,
      formatTimeoutError: toStripeHttpTimeoutError,
    });

    const data: unknown = await response.json();
    if (!response.ok) {
      const error = new Error('Stripe payment intent was declined') as Error & {
        response?: {
          status?: number;
          data?: unknown;
          headers?: Record<string, string>;
        };
      };

      error.response = {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };

      throw error;
    }

    return data as Record<string, unknown>;
  }
}
