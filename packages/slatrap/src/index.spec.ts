import {
  configureSlatrapForCoreInspector,
  configureSlatrap,
  createAxiosResponseErrorInterceptor,
  createSlatrap,
  Slatrap,
} from './index';

describe('Slatrap', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    configureSlatrap({ emit: () => undefined });
    warnSpy.mockRestore();
  });

  it('normalizes axios timeout errors before emit', async () => {
    const emit = jest.fn();
    const slatrap = createSlatrap({ emit });
    const interceptor = createAxiosResponseErrorInterceptor(slatrap, {
      defaultProvider: 'stripe',
      resolveEndpoint: () => '/payment_intents',
      resolveTimeoutMs: () => 20_000,
    });
    const error = Object.assign(new Error('timeout of 20000ms exceeded'), {
      code: 'ECONNABORTED',
      config: { timeout: 20_000 },
    });

    await expect(interceptor(error)).rejects.toBe(error);

    expect(emit).toHaveBeenCalledWith({
      provider: 'stripe',
      endpoint: '/payment_intents',
      statusCode: 504,
      providerPayload: {
        error_type: 'timeout',
        code: 'timeout',
        message: 'HTTP request timed out after 20000ms',
      },
    });
  });

  it('emits structured provider errors when defaultProvider is set', async () => {
    const emit = jest.fn();
    const slatrap = createSlatrap({ emit });
    const interceptor = createAxiosResponseErrorInterceptor(slatrap, {
      defaultProvider: 'plaid',
      resolveEndpoint: () => '/plaid/item-login-required',
      resolveStartedAt: () => 9_000,
      mapResponseData: (data) =>
        typeof data === 'object' &&
        data !== null &&
        'plaid' in data &&
        typeof (data as { plaid: unknown }).plaid === 'object' &&
        (data as { plaid: unknown }).plaid !== null
          ? (data as { plaid: Record<string, unknown> }).plaid
          : data,
    });
    const error = Object.assign(new Error('Request failed with status code 400'), {
      response: {
        status: 400,
        data: {
          plaid: {
            error_code: 'ITEM_LOGIN_REQUIRED',
            access_token: 'secret',
          },
        },
      },
    });

    await expect(interceptor(error)).rejects.toBe(error);

    expect(emit).toHaveBeenCalledWith({
      provider: 'plaid',
      endpoint: '/plaid/item-login-required',
      statusCode: 400,
      latency: expect.any(Number),
      providerPayload: {
        error_code: 'ITEM_LOGIN_REQUIRED',
        access_token: '[REDACTED]',
      },
    });
  });

  it('sanitizes and emits through the axios response interceptor helper', async () => {
    const emit = jest.fn();
    const slatrap = createSlatrap({ emit });
    const interceptor = createAxiosResponseErrorInterceptor(slatrap);
    const error = {
      message: 'request failed',
      access_token: 'secret-token',
      response: {
        data: {
          error_code: 'INVALID_ACCOUNT',
          request_id: 'req_789',
        },
      },
    };

    await expect(interceptor(error)).rejects.toThrow('request failed');

    expect(emit).toHaveBeenCalledWith({
      message: 'request failed',
      access_token: '[REDACTED]',
      response: {
        data: {
          error_code: 'INVALID_ACCOUNT',
          request_id: 'req_789',
        },
      },
    });
  });

  it('supports direct Slatrap usage without factory helpers', async () => {
    const emit = jest.fn();
    Slatrap.configure({ emit });

    const error = {
      message: 'request failed',
      access_token: 'secret-token',
      response: {
        data: {
          error_code: 'INVALID_ACCOUNT',
          request_id: 'req_789',
        },
      },
    };

    const cleanData = Slatrap.sanitize(error);
    await Slatrap.emit(cleanData);

    expect(emit).toHaveBeenCalledWith({
      message: 'request failed',
      access_token: '[REDACTED]',
      response: {
        data: {
          error_code: 'INVALID_ACCOUNT',
          request_id: 'req_789',
        },
      },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns when emit is called with unsanitized sensitive payload', async () => {
    const emit = jest.fn();
    Slatrap.configure({ emit });

    await Slatrap.emit({
      provider: 'plaid',
      providerPayload: {
        access_token: 'raw-secret',
      },
    });

    expect(emit).toHaveBeenCalledWith({
      provider: 'plaid',
      providerPayload: {
        access_token: '[REDACTED]',
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[Slatrap] emit() received payload with sensitive fields. Call Slatrap.sanitize(...) before emit.',
    );
  });

  it('does not warn when emit is called with already sanitized payload', async () => {
    const emit = jest.fn();
    Slatrap.configure({ emit });

    const payload = Slatrap.sanitize({
      provider: 'plaid',
      providerPayload: {
        access_token: 'raw-secret',
      },
    });

    await Slatrap.emit(payload);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('configures provider error envelope handling in package helper', async () => {
    const emitProviderError = jest.fn();

    Slatrap.configureProviderErrors({
      emitProviderError,
      defaultProvider: 'plaid',
    });

    await Slatrap.emit({
      endpoint: '/plaid/transactions',
      statusCode: 429,
      latency: 42,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
    });

    expect(emitProviderError).toHaveBeenCalledWith({
      provider: 'plaid',
      endpoint: '/plaid/transactions',
      statusCode: 429,
      latency: 42,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
    });
  });

  it('configures provider error emission from core inspector helper', async () => {
    const emit = jest.fn();

    configureSlatrapForCoreInspector({
      emitter: { emit },
      providerErrorEventName: 'provider.error',
      defaultProvider: 'plaid',
    });

    await Slatrap.emit({
      endpoint: '/plaid/transactions',
      statusCode: 400,
      latency: 50,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
    });

    expect(emit).toHaveBeenCalledWith('provider.error', {
      provider: 'plaid',
      endpoint: '/plaid/transactions',
      statusCode: 400,
      latency: 50,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
    });
  });

  it('forwards explicit core-event envelope via configureForCoreInspector', async () => {
    const emit = jest.fn();

    configureSlatrapForCoreInspector({
      emitter: { emit },
      defaultProvider: 'plaid',
    });

    await Slatrap.emit(
      Slatrap.sanitize(
        {
          eventName: 'plaid.item.created',
          payload: {
            itemId: 'item_123',
            institutionId: 'ins_109508',
            institutionName: 'First Platypus Bank',
          },
        },
        {
          whitelist: [
            'eventName',
            'payload',
            'itemId',
            'institutionId',
            'institutionName',
          ],
        },
      ),
    );

    expect(emit).toHaveBeenCalledWith('plaid.item.created', {
      itemId: 'item_123',
      institutionId: 'ins_109508',
      institutionName: 'First Platypus Bank',
    });
  });
});
