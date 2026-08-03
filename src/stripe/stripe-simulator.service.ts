import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Slatrap } from '@slatrap/slatrap';
import { StripeSimulatorApiClient } from './stripe-simulator-api.client';
import {
  readStripeHttpTimeoutMs,
  toStripeHttpTimeoutError,
} from './stripe-http.utils';
import { StripeSimulatorErrorMapper } from './stripe-simulator-error.mapper';
import {
  getStripeSimulation,
  type StripeSimulationSpec,
} from './stripe-simulator.definitions';

@Injectable()
export class StripeSimulatorService {
  private readonly logger = new Logger(StripeSimulatorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly stripeSimulatorApiClient: StripeSimulatorApiClient,
    private readonly stripeSimulatorErrorMapper: StripeSimulatorErrorMapper,
  ) {}

  /**
   * Dispatches a registered Stripe simulation by route segment
   * (e.g. `insufficient-funds`, `timeout`).
   */
  run(route: string): Promise<never> {
    const simulation = getStripeSimulation(route);
    if (!simulation) {
      throw new NotFoundException(`Unknown Stripe simulation scenario: ${route}`);
    }

    if (simulation.kind === 'timeout') {
      return this.triggerTimeout(simulation);
    }

    return this.triggerDeclinedPaymentIntent(simulation);
  }

  private async triggerTimeout(
    simulation: StripeSimulationSpec,
  ): Promise<never> {
    const start = Date.now();
    const timeoutMs = readStripeHttpTimeoutMs(this.configService);

    return this.handleSimulationFailure(
      simulation,
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
        startedAt: start,
      },
      simulation.successMessage,
    );

    throw new HttpException({ stripe: stripePayload }, httpStatus);
  }
}
