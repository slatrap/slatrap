import axios, { type AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { Slatrap } from '../../../packages/slatrap/src';
import { withPlaidSimulationMetadata } from './plaid-simulation-metadata.util';
import { emitPlaidProviderLatency } from './emit-plaid-latency';

export function createSlatrapAxiosLatencyHooks(params: {
  configService: ConfigService;
  endpoint: string;
  startedAt: number;
}) {
  return {
    onSuccess: <T>(response: AxiosResponse<T>) => {
      emitPlaidProviderLatency({
        endpoint: params.endpoint,
        startedAt: params.startedAt,
        success: true,
        statusCode: response.status,
      });

      return response;
    },
    onError: createSlatrapAxiosInterceptor(params),
  };
}

export function createSlatrapAxiosInterceptor(params: {
  configService: ConfigService;
  endpoint: string;
  startedAt: number;
}) {
  return (error: unknown) => {
    const axiosError = axios.isAxiosError(error) ? error : null;

    emitPlaidProviderLatency({
      endpoint: params.endpoint,
      startedAt: params.startedAt,
      success: false,
      statusCode: axiosError?.response?.status,
    });

    const responsePayload = extractProviderPayload(axiosError?.response?.data);
    const payloadWithMetadata = responsePayload
      ? withPlaidSimulationMetadata(responsePayload, params.configService)
      : error;
    const providerPayload = Slatrap.sanitize(payloadWithMetadata);

    void Slatrap.emit({
      provider: 'plaid',
      endpoint: params.endpoint,
      latency: Date.now() - params.startedAt,
      providerPayload,
      statusCode: axiosError?.response?.status ?? null,
    });

    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  };
}

function extractProviderPayload(
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
