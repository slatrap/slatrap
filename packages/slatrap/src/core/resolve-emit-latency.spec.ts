import { resolveEmitLatency } from './resolve-emit-latency';
import { PROVIDER_LATENCY_EVENT_NAME } from './provider-latency-emit';

describe('resolveEmitLatency', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('derives latency from startedAt', () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_500);

    expect(
      resolveEmitLatency({
        provider: 'plaid',
        endpoint: '/plaid/item/get',
        startedAt: 2_000,
      }),
    ).toEqual({
      provider: 'plaid',
      endpoint: '/plaid/item/get',
      latency: 500,
    });
  });

  it('derives latency inside core event envelope payloads', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5_000);

    expect(
      resolveEmitLatency({
        eventName: PROVIDER_LATENCY_EVENT_NAME,
        payload: {
          provider: 'plaid',
          endpoint: '/plaid/slow-response',
          startedAt: 2_500,
          success: true,
          statusCode: 200,
        },
      }),
    ).toEqual({
      eventName: PROVIDER_LATENCY_EVENT_NAME,
      payload: {
        provider: 'plaid',
        endpoint: '/plaid/slow-response',
        success: true,
        statusCode: 200,
        latency: 2_500,
      },
    });
  });

  it('keeps explicit latency when both are provided', () => {
    jest.spyOn(Date, 'now').mockReturnValue(9_999);

    expect(
      resolveEmitLatency({
        provider: 'stripe',
        startedAt: 1_000,
        latency: 42,
      }),
    ).toEqual({
      provider: 'stripe',
      latency: 42,
    });
  });

  it('returns payload unchanged when startedAt is absent', () => {
    const payload = { provider: 'plaid', latency: 10 };

    expect(resolveEmitLatency(payload)).toBe(payload);
  });
});
