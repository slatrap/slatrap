import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaidSimulationErrorService } from './simulation-error.service';

describe('PlaidSimulationErrorService', () => {
  const configService = {
    get: jest.fn().mockReturnValue(null),
  } as unknown as ConfigService;

  const testCases = {
    ITEM_LOGIN_REQUIRED: {
      error_code: 'ITEM_LOGIN_REQUIRED',
      error_type: 'ITEM_ERROR',
      message: 'Request failed with status code 400',
    },
    ACCOUNTS_LIMIT: {
      error_code: 'ACCOUNTS_LIMIT',
      error_type: 'RATE_LIMIT_EXCEEDED',
      message: 'Request failed with status code 429',
    },
  };

  it('throws the fixture payload from the injected in-memory map', () => {
    const service = new PlaidSimulationErrorService(configService, testCases);

    try {
      service.triggerError('ITEM_LOGIN_REQUIRED', {
        skipProviderErrorEmit: true,
      });
      throw new Error('expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect((error as HttpException).getResponse()).toEqual({
        plaid: testCases.ITEM_LOGIN_REQUIRED,
      });
    }
  });

  it('infers 429 for rate-limit fixtures from the cached payload', () => {
    const service = new PlaidSimulationErrorService(configService, testCases);

    try {
      service.triggerError('ACCOUNTS_LIMIT', { skipProviderErrorEmit: true });
      throw new Error('expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('fails for unknown scenario keys without filesystem access', () => {
    const service = new PlaidSimulationErrorService(configService, testCases);

    expect(() =>
      service.triggerError('MISSING_SCENARIO', { skipProviderErrorEmit: true }),
    ).toThrow(/Missing test case 'MISSING_SCENARIO'/);
  });
});
