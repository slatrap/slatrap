import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeSimulatorService } from './stripe-simulator.service';
import { StripeSimulatorApiClient } from './stripe-simulator-api.client';
import { StripeSimulatorErrorMapper } from './stripe-simulator-error.mapper';

describe('StripeSimulatorService', () => {
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };
  const apiClient = {
    createDeclinedPaymentIntent: jest.fn(),
  };
  const errorMapper = {
    map: jest.fn(),
  };

  const service = new StripeSimulatorService(
    configService as unknown as ConfigService,
    apiClient as unknown as StripeSimulatorApiClient,
    errorMapper as unknown as StripeSimulatorErrorMapper,
  );

  it('rejects unknown routes', () => {
    expect(() => service.run('not-a-scenario')).toThrow(NotFoundException);
  });

  it('dispatches timeout without calling the Stripe API client', async () => {
    errorMapper.map.mockReturnValue({
      stripeError: { type: 'api_error', message: 'timeout' },
      httpStatus: 504,
      requestId: undefined,
      shouldEmitProviderEvent: false,
    });

    await expect(service.run('timeout')).rejects.toMatchObject({
      status: 504,
    });
    expect(apiClient.createDeclinedPaymentIntent).not.toHaveBeenCalled();
  });
});
