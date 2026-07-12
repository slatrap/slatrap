import {
  buildProviderLatencyEmitPayload,
  PROVIDER_LATENCY_EVENT_NAME,
} from './provider-latency-emit';

describe('buildProviderLatencyEmitPayload', () => {
  it('builds a core event envelope with startedAt for latency resolution', () => {
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
        startedAt: 2_500,
        success: true,
        statusCode: 200,
        metadata: { simulatedDelayMs: 2_500 },
      },
    });
  });
});
