import { type SanitizedValue } from '../sanitization/sanitizer';

export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
export const HTTP_TIMEOUT_STATUS_CODE = 504;

export type HttpTimeoutEmitInput = {
  provider: string;
  endpoint?: string;
  timeoutMs: number;
  latency?: number;
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

export function buildHttpTimeoutEmitPayload(
  input: HttpTimeoutEmitInput,
): SanitizedValue {
  const payload: Record<string, SanitizedValue> = {
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

  if (input.latency !== undefined) {
    payload.latency = input.latency;
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
): SanitizedValue {
  if (!isHttpTimeoutError(error)) {
    return error as SanitizedValue;
  }

  const timeoutMs =
    options?.resolveTimeoutMs?.(error) ??
    resolveAxiosTimeoutMs(error) ??
    DEFAULT_HTTP_TIMEOUT_MS;

  return buildHttpTimeoutEmitPayload({
    provider: options?.defaultProvider ?? 'unknown',
    endpoint: options?.resolveEndpoint?.(error),
    timeoutMs,
  });
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
