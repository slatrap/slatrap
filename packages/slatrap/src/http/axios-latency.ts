import axios, { type AxiosResponse } from 'axios';
import { type Slatrap as SlatrapApi } from '../core/slatrap.types';
import {
  buildProviderLatencyEmitPayload,
  type ProviderLatencyEmitFromStartInput,
} from '../core/provider-latency-emit';

export type AxiosLatencyHooksOptions = {
  provider: string;
  endpoint: string;
  startedAt: number;
  onError?: (error: unknown) => Promise<never>;
};

export function emitProviderLatency(
  slatrap: SlatrapApi,
  input: ProviderLatencyEmitFromStartInput,
): void {
  void slatrap.emit(
    buildProviderLatencyEmitPayload({
      ...input,
      latencyMs: Date.now() - input.startedAt,
    }),
  );
}

export function resolveAxiosResponseStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  return error.response?.status ?? null;
}

export function createAxiosLatencyHooks(
  slatrap: SlatrapApi,
  options: AxiosLatencyHooksOptions,
) {
  const emit = (success: boolean, statusCode: number | null) => {
    emitProviderLatency(slatrap, {
      provider: options.provider,
      endpoint: options.endpoint,
      startedAt: options.startedAt,
      success,
      statusCode,
    });
  };

  return {
    onSuccess: <T>(response: AxiosResponse<T>) => {
      emit(true, response.status);
      return response;
    },
    onError: (error: unknown) => {
      emit(false, resolveAxiosResponseStatus(error));

      if (options.onError) {
        return options.onError(error);
      }

      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    },
  };
}
