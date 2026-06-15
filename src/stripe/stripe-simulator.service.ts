import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Slatrap } from '../../packages/slatrap/src';
import { StripeSimulatorApiClient } from './stripe-simulator-api.client';
import {
  readStripeHttpTimeoutMs,
  toStripeHttpTimeoutError,
} from './stripe-http.utils';
import { StripeSimulatorErrorMapper } from './stripe-simulator-error.mapper';
import {
  STRIPE_SIMULATIONS,
  type StripeSimulationSpec,
} from './stripe-simulator.definitions';

@Injectable()
export class StripeSimulatorService {
  private readonly logger = new Logger(StripeSimulatorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly stripeSimulatorApiClient: StripeSimulatorApiClient,
    private readonly stripeSimulatorErrorMapper: StripeSimulatorErrorMapper,
  ) { }

  async triggerInsufficientFundsError(): Promise<never> {
    return this.triggerDeclinedPaymentIntent(
      STRIPE_SIMULATIONS.insufficientFunds,
    );
  }

  async triggerAccountClosedError(): Promise<never> {
    return this.triggerDeclinedPaymentIntent(STRIPE_SIMULATIONS.accountClosed);
  }

  async triggerCustomerNotAuthorizedError(): Promise<never> {
    return this.triggerDeclinedPaymentIntent(
      STRIPE_SIMULATIONS.customerNotAuthorized,
    );
  }

  async triggerInvalidAccountRoutingNumberError(): Promise<never> {
    return this.triggerDeclinedPaymentIntent(
      STRIPE_SIMULATIONS.invalidAccountRoutingNumber,
    );
  }

  async triggerStolenCardError(): Promise<never> {
    return this.triggerDeclinedPaymentIntent(STRIPE_SIMULATIONS.stolenCard);
  }

  async triggerFraudulentError(): Promise<never> {
    return this.triggerDeclinedPaymentIntent(STRIPE_SIMULATIONS.fraudulent);
  }

  async triggerTimeoutError(): Promise<never> {
    const start = Date.now();
    const timeoutMs = readStripeHttpTimeoutMs(this.configService);

    return this.handleSimulationFailure(
      STRIPE_SIMULATIONS.timeout,
      toStripeHttpTimeoutError(timeoutMs),
      start,
    );
  }

  private async triggerDeclinedPaymentIntent(
    simulation: StripeSimulationSpec,
  ): Promise<never> {
    const start = Date.now();
    const externalRefId = this.configService.get<string>(
      'STRIPE_EXTERNAL_REF_ID',
    );

    try {
      await this.stripeSimulatorApiClient.createDeclinedPaymentIntent(
        simulation,
        externalRefId,
        start,
      );

      throw new Error(
        `Stripe ${simulation.endpoint} simulation unexpectedly succeeded`,
      );
    } catch (error: unknown) {
      return this.handleSimulationFailure(simulation, error, start);
    }
  }

  private async handleSimulationFailure(
    simulation: StripeSimulationSpec,
    error: unknown,
    start: number,
  ): Promise<never> {
    const externalRefId = this.configService.get<string>(
      'STRIPE_EXTERNAL_REF_ID',
    );
    const mapped = this.stripeSimulatorErrorMapper.map(error);
    const stripeError = mapped.stripeError;
    const latency = Date.now() - start;
    const httpStatus = mapped.httpStatus;
    const requestId = mapped.requestId;

    if (requestId) {
      stripeError.request_id = requestId;
    }

    const stripePayload = {
      ...stripeError,
      ...(externalRefId ? { userId: externalRefId } : {}),
    };

    if (mapped.shouldEmitProviderEvent) {
      void Slatrap.emit(
        Slatrap.sanitize({
          provider: 'stripe',
          endpoint: simulation.endpoint,
          statusCode: httpStatus,
          providerPayload: stripePayload,
          startedAt: start,
        }),
      );
    }

    this.logger.warn(
      {
        endpoint: simulation.endpoint,
        statusCode: httpStatus,
        latency,
      },
      simulation.successMessage,
    );

    throw new HttpException({ stripe: stripePayload }, httpStatus);
  }
}
