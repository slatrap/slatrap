import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaidSimulatorService } from './plaid-simulator.service';
import { PlaidSimulationErrorService } from './simulation-error.service';

describe('PlaidSimulatorService', () => {
  const simulationErrorService = {
    triggerError: jest.fn(),
    triggerSlowResponse: jest.fn().mockResolvedValue({ ok: true, latencyMs: 1 }),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'PLAID_SIMULATION_SLOW_MS') {
        return 2_500;
      }
      return null;
    }),
  };

  const service = new PlaidSimulatorService(
    simulationErrorService as unknown as PlaidSimulationErrorService,
    configService as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches error scenarios by route to the fixture key', () => {
    simulationErrorService.triggerError.mockImplementation(() => {
      throw new Error('expected throw');
    });

    expect(() => service.run('item-login-required')).toThrow('expected throw');
    expect(simulationErrorService.triggerError).toHaveBeenCalledWith(
      'ITEM_LOGIN_REQUIRED',
      {},
    );
  });

  it('dispatches slow-response with delay from body', async () => {
    await service.run('slow-response', { body: { delayMs: 100 } });

    expect(simulationErrorService.triggerSlowResponse).toHaveBeenCalledWith(
      100,
      {},
    );
  });

  it('rejects unknown routes', () => {
    expect(() => service.run('not-a-scenario')).toThrow(NotFoundException);
  });
});
