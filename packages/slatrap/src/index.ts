import {
  sanitizeErrorData,
  type SanitizedValue,
  type SanitizerOptions,
} from './sanitization/sanitizer';
import { SlatrapContext } from './core/slatrap-context';
import {
  type ConfigurableSlatrap,
  type ConfigureSlatrapForCoreInspectorOptions,
  type ConfigureSlatrapForProviderErrorsOptions,
  type Slatrap as SlatrapApi,
  type SlatrapOptions,
} from './core/slatrap.types';
import {
  toCoreEventEnvelope,
  toProviderErrorEvent,
} from './core/slatrap-event-mappers';
import { sanitizeBeforeEmit } from './core/slatrap-emit-guard';
import { resolveEmitLatency } from './core/resolve-emit-latency';
import {
  type AxiosErrorInterceptorOptions,
  resolveEmitPayloadForHttpError,
} from './http/http-timeout';

export type {
  ConfigurableSlatrap,
  ConfigureSlatrapForCoreInspectorOptions,
  ConfigureSlatrapForProviderErrorsOptions,
  SlatrapCoreEventEnvelope,
  SlatrapEmitter,
  SlatrapOptions,
  SlatrapProviderErrorEvent,
} from './core/slatrap.types';

export type Slatrap = SlatrapApi;

export const Slatrap: ConfigurableSlatrap = new SlatrapContext({
  configureProviderErrors: (options) =>
    configureSlatrapForProviderErrors(options),
  configureForCoreInspector: (options) =>
    configureSlatrapForCoreInspector(options),
});

export function configureSlatrap(options: SlatrapOptions): void {
  Slatrap.configure(options);
}

export function configureSlatrapForProviderErrors(
  options: ConfigureSlatrapForProviderErrorsOptions,
): void {
  configureSlatrap({
    redactionText: options.redactionText,
    emit: (payload) =>
      options.emitProviderError(
        toProviderErrorEvent(payload, options.defaultProvider),
      ),
  });
}

export function createSlatrap(options: SlatrapOptions): SlatrapApi {
  return {
    sanitize<T = unknown>(value: T, sanitizeOptions?: SanitizerOptions) {
      return sanitizeWithRedaction(
        value,
        sanitizeOptions?.redactionText ?? options.redactionText,
      );
    },
    emit(payload: SanitizedValue) {
      const payloadWithLatency = resolveEmitLatency(payload);
      const sanitizedPayload = sanitizeBeforeEmit(
        payloadWithLatency,
        options.redactionText,
      );
      return options.emit(sanitizedPayload);
    },
  };
}

export function createAxiosResponseErrorInterceptor(
  slatrap: SlatrapApi = Slatrap,
  options?: AxiosErrorInterceptorOptions,
) {
  return (error: unknown): Promise<never> => {
    const payload = resolveEmitPayloadForHttpError(error, options);
    const cleanData = slatrap.sanitize(payload);
    void slatrap.emit(cleanData);

    if (error instanceof Error) {
      return Promise.reject(error);
    }

    const message =
      typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);

    return Promise.reject(new Error(message));
  };
}

export function configureSlatrapForCoreInspector(
  options: ConfigureSlatrapForCoreInspectorOptions,
): void {
  configureSlatrap({
    redactionText: options.redactionText,
    emit: (payload) => {
      const coreEvent = toCoreEventEnvelope(payload);
      if (coreEvent) {
        void options.emitter.emit(coreEvent.eventName, coreEvent.payload);
        return;
      }

      void options.emitter.emit(
        options.providerErrorEventName ?? 'provider.error',
        toProviderErrorEvent(payload, options.defaultProvider),
      );
    },
  });
}

function sanitizeWithRedaction<T = unknown>(
  value: T,
  redactionText?: string,
): SanitizedValue {
  return sanitizeErrorData(value, { redactionText });
}

export {
  DEFAULT_REDACTION_TEXT,
  SENSITIVE_KEY_PATTERNS,
  sanitizeErrorData,
  type SanitizedValue,
  type SanitizerOptions,
} from './sanitization/sanitizer';

export type {
  AxiosErrorInterceptorOptions,
  FetchWithTimeoutInit,
  HttpTimeoutEmitInput,
  HttpTimeoutTransportError,
} from './http/http-timeout';

export {
  buildHttpTimeoutEmitPayload,
  buildHttpTimeoutMessage,
  buildHttpTimeoutTransportError,
  DEFAULT_HTTP_TIMEOUT_MS,
  fetchWithTimeout,
  HTTP_TIMEOUT_STATUS_CODE,
  isHttpTimeoutError,
  parseHttpTimeoutMs,
  resolveAxiosTimeoutMs,
  resolveEmitPayloadForHttpError,
} from './http/http-timeout';

export type { ProviderLatencyEmitInput } from './core/provider-latency-emit';

export {
  buildProviderLatencyEmitPayload,
  PROVIDER_LATENCY_EVENT_NAME,
} from './core/provider-latency-emit';

export type { AxiosLatencyHooksOptions } from './http/axios-latency';

import {
  createAxiosLatencyHooks as createAxiosLatencyHooksFor,
  emitProviderLatency as emitProviderLatencyFor,
  type AxiosLatencyHooksOptions,
} from './http/axios-latency';
import { type ProviderLatencyEmitInput } from './core/provider-latency-emit';

export function emitProviderLatency(input: ProviderLatencyEmitInput): void {
  emitProviderLatencyFor(Slatrap, input);
}

export function createAxiosLatencyHooks(options: AxiosLatencyHooksOptions) {
  return createAxiosLatencyHooksFor(Slatrap, options);
}

export { resolveAxiosResponseStatus } from './http/axios-latency';
