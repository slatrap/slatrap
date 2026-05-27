import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Slatrap } from '../../../packages/slatrap/src';
import { withPlaidSimulationMetadata } from './plaid-simulation-metadata.util';

export function createSlatrapAxiosInterceptor(params: {
  configService: ConfigService;
  endpoint: string;
  startedAt: number;
}) {
  return (error: unknown) => {
    const axiosError = axios.isAxiosError(error) ? error : null;
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
