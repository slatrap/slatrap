import { ConfigService } from '@nestjs/config';
import {
  createAxiosLatencyHooks,
  createAxiosResponseErrorInterceptor,
} from '@slatrap/slatrap';
import { withPlaidSimulationMetadata } from './plaid-simulation-metadata.util';

/**
 * Thin Plaid-simulation wiring around SDK Axios helpers:
 * latency hooks + createAxiosResponseErrorInterceptor (timeout-aware emit).
 */
export function createPlaidSimulationAxiosHooks(params: {
  configService: ConfigService;
  endpoint: string;
  startedAt: number;
}) {
  const captureError = createAxiosResponseErrorInterceptor(undefined, {
    defaultProvider: 'plaid',
    resolveEndpoint: () => params.endpoint,
    resolveStartedAt: () => params.startedAt,
    mapResponseData: (responseData) =>
      mapPlaidSimulationResponseData(responseData, params.configService),
  });

  return createAxiosLatencyHooks({
    provider: 'plaid',
    endpoint: params.endpoint,
    startedAt: params.startedAt,
    onError: captureError,
  });
}

function mapPlaidSimulationResponseData(
  responseData: unknown,
  configService: ConfigService,
): unknown {
  const providerPayload = unwrapPlaidPayload(responseData);
  if (!providerPayload) {
    return responseData;
  }

  return withPlaidSimulationMetadata(providerPayload, configService);
}

function unwrapPlaidPayload(
  responseData: unknown,
): Record<string, unknown> | null {
  if (!isRecord(responseData)) {
    return null;
  }

  const nestedPayload = responseData['plaid'];
  if (isRecord(nestedPayload)) {
    return nestedPayload;
  }

  return responseData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
