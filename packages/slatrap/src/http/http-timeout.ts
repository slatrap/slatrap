import { type StructuredValue } from '../sanitization/sanitizer';

export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
export const HTTP_TIMEOUT_STATUS_CODE = 504;

export type HttpTimeoutEmitInput = {
  provider: string;
  endpoint?: string;
  timeoutMs: number;
  startedAt?: number;
};

export type HttpTimeoutTransportError = Error & {
  response: {
    status: number;
    data: unknown;
    headers: Record<string, string>;
  };
};

export type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number;
  formatTimeoutError?: (
    timeoutMs: number,
    cause: unknown,
  ) => HttpTimeoutTransportError;
};

export type AxiosErrorInterceptorOptions = {
  defaultProvider?: string;
  resolveEndpoint?: (error: unknown) => string | undefined;
  resolveTimeoutMs?: (error: unknown) => number | undefined;
  resolveStartedAt?: (error: unknown) => number | undefined;
  mapResponseData?: (responseData: unknown, error: unknown) => unknown;
};

export function parseHttpTimeoutMs(
  value: string | number | undefined | null,
  fallback = DEFAULT_HTTP_TIMEOUT_MS,
): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

export function isHttpTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    // fetch + AbortSignal.timeout() rejects with TimeoutError in Node 20+.
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }
  }

  const code = (error as { code?: string })?.code;
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT';
}

export function buildHttpTimeoutMessage(timeoutMs: number): string {
  return `HTTP request timed out after ${timeoutMs}ms`;
}

/** Builds timeout fields for sanitize + emit (envelope defaults applied inside emit). */
export function buildHttpTimeoutEmitPayload(
  input: HttpTimeoutEmitInput,
): StructuredValue {
  const payload: Record<string, StructuredValue> = {
    provider: input.provider,
    statusCode: HTTP_TIMEOUT_STATUS_CODE,
    providerPayload: {
      error_type: 'timeout',
      code: 'timeout',
      message: buildHttpTimeoutMessage(input.timeoutMs),
    },
  };

  if (input.endpoint !== undefined) {
    payload.endpoint = input.endpoint;
  }

  if (input.startedAt !== undefined) {
    payload.startedAt = input.startedAt;
  }

  return payload;
}

export function buildHttpTimeoutTransportError(options: {
  timeoutMs: number;
  cause?: unknown;
  statusCode?: number;
  data?: unknown;
  headers?: Record<string, string>;
}): HttpTimeoutTransportError {
  const message = buildHttpTimeoutMessage(options.timeoutMs);
  const error = new Error(message) as HttpTimeoutTransportError;

  if (options.cause !== undefined) {
    error.cause = options.cause;
  }

  error.response = {
    status: options.statusCode ?? HTTP_TIMEOUT_STATUS_CODE,
    data: options.data ?? {
      error_type: 'timeout',
      code: 'timeout',
      message,
    },
    headers: options.headers ?? {},
  };

  return error;
}

export function resolveAxiosTimeoutMs(error: unknown): number | undefined {
  const config = (error as { config?: { timeout?: number } })?.config;
  if (typeof config?.timeout === 'number' && config.timeout > 0) {
    return config.timeout;
  }

  return undefined;
}

export function resolveEmitPayloadForHttpError(
  error: unknown,
  options: AxiosErrorInterceptorOptions | undefined,
): StructuredValue {
  const startedAt = options?.resolveStartedAt?.(error);

  if (isHttpTimeoutError(error)) {
    const timeoutMs =
      options?.resolveTimeoutMs?.(error) ??
      resolveAxiosTimeoutMs(error) ??
      DEFAULT_HTTP_TIMEOUT_MS;

    return buildHttpTimeoutEmitPayload({
      provider: options?.defaultProvider ?? 'unknown',
      endpoint: options?.resolveEndpoint?.(error),
      timeoutMs,
      startedAt,
    });
  }

  if (options?.defaultProvider) {
    return buildAxiosProviderErrorEmitPayload(error, options, startedAt);
  }

  return error as StructuredValue;
}

function buildAxiosProviderErrorEmitPayload(
  error: unknown,
  options: AxiosErrorInterceptorOptions,
  startedAt: number | undefined,
): StructuredValue {
  const response = readAxiosResponse(error);
  const responseData = response?.data;
  const mappedData = options.mapResponseData
    ? options.mapResponseData(responseData, error)
    : responseData;
  const endpoint = options.resolveEndpoint?.(error);

  return {
    provider: options.defaultProvider ?? 'unknown',
    statusCode: readResponseStatus(response),
    providerPayload: (mappedData ?? error) as StructuredValue,
    ...(endpoint !== undefined ? { endpoint } : {}),
    ...(startedAt !== undefined ? { startedAt } : {}),
  };
}

function readAxiosResponse(error: unknown):
  | { status?: unknown; data?: unknown }
  | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) {
    return undefined;
  }

  return response as { status?: unknown; data?: unknown };
}

function readResponseStatus(
  response: { status?: unknown } | undefined,
): number | null {
  if (typeof response?.status === 'number' && Number.isFinite(response.status)) {
    return response.status;
  }

  return null;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
    formatTimeoutError,
    ...fetchInit
  } = init;

  try {
    return await fetch(input, {
      ...fetchInit,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    if (isHttpTimeoutError(error)) {
      throw (
        formatTimeoutError?.(timeoutMs, error) ??
        buildHttpTimeoutTransportError({ timeoutMs, cause: error })
      );
    }

    throw error;
  }
}
