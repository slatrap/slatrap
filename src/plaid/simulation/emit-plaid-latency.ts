import { Slatrap, buildProviderLatencyEmitPayload } from '../../../packages/slatrap/src';

export function emitPlaidProviderLatency(params: {
  endpoint: string;
  startedAt: number;
  success: boolean;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
}): void {
  void Slatrap.emit(
    buildProviderLatencyEmitPayload({
      provider: 'plaid',
      endpoint: params.endpoint,
      latencyMs: Date.now() - params.startedAt,
      success: params.success,
      statusCode: params.statusCode,
      metadata: params.metadata,
    }),
  );
}
