import {
  buildProviderLatencyEmitPayload,
  PROVIDER_LATENCY_EVENT_NAME,
} from './provider-latency-emit';

describe('buildProviderLatencyEmitPayload', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a core event envelope for provider latency', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5_000);

    expect(
      buildProviderLatencyEmitPayload({
        provider: 'plaid',
        endpoint: '/plaid/slow-response',
        startedAt: 2_500,
        success: true,
        statusCode: 200,
        metadata: { simulatedDelayMs: 2_500 },
      }),
    ).toEqual({
      eventName: PROVIDER_LATENCY_EVENT_NAME,
      payload: {
        provider: 'plaid',
        endpoint: '/plaid/slow-response',
        latencyMs: 2_500,
        success: true,
        statusCode: 200,
        metadata: { simulatedDelayMs: 2_500 },
      },
    });
  });
});
