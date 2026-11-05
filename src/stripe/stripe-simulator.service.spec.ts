import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Slatrap } from '@slatrap/slatrap';
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

  describe('emitted provider payload', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      configService.get.mockReturnValue(undefined);
    });

    async function emitWithEnv(env: Record<string, string>) {
      configService.get.mockImplementation((key: string) => env[key]);
      errorMapper.map.mockReturnValue({
        stripeError: { type: 'api_error', code: 'timeout', message: 'timeout' },
        httpStatus: 504,
        requestId: undefined,
        shouldEmitProviderEvent: true,
      });
      const emitSpy = jest
        .spyOn(Slatrap, 'emit')
        .mockImplementation(() => undefined);

      await expect(service.run('timeout')).rejects.toMatchObject({
        status: 504,
      });

      return emitSpy.mock.calls[0][0];
    }

    it('adds the configured user and connected account ids', async () => {
      const emitted = await emitWithEnv({
        STRIPE_EXTERNAL_REF_ID: 'user_1',
        STRIPE_CONNECTED_ACCOUNT_ID: 'acct_123',
      });

      expect(emitted).toMatchObject({
        provider: 'stripe',
        providerPayload: { userId: 'user_1', connectedAccountId: 'acct_123' },
      });
    });

    it('omits connectedAccountId when the env var is not set', async () => {
      const emitted = await emitWithEnv({ STRIPE_EXTERNAL_REF_ID: 'user_1' });

      expect(emitted).toMatchObject({ providerPayload: { userId: 'user_1' } });
      expect(emitted).not.toHaveProperty('providerPayload.connectedAccountId');
    });
  });
});
