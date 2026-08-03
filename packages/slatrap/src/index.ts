import { SlatrapContext } from './core/slatrap-context';
import {
  type ConfigurableSlatrap,
  type ConfigureSlatrapForCoreInspectorOptions,
  type Slatrap as SlatrapApi,
  type SlatrapOptions,
} from './core/slatrap.types';
import {
  toCoreEventEnvelope,
  toProviderErrorEvent,
} from './core/slatrap-event-mappers';
import {
  type AxiosErrorInterceptorOptions,
  resolveEmitPayloadForHttpError,
} from './http/http-timeout';

export type {
  ConfigurableSlatrap,
  ConfigureSlatrapForCoreInspectorOptions,
  SlatrapCoreEventEnvelope,
  SlatrapEmitter,
  SlatrapOptions,
  SlatrapProviderErrorEvent,
} from './core/slatrap.types';

export type Slatrap = SlatrapApi;

export const Slatrap: ConfigurableSlatrap = new SlatrapContext({
  configureForCoreInspector: (options) =>
    configureSlatrapForCoreInspector(options),
});

export function configureSlatrap(options: SlatrapOptions): void {
  Slatrap.configure(options);
}

export function createSlatrap(options: SlatrapOptions): SlatrapApi {
  const instance = new SlatrapContext();
  instance.configure(options);
  return instance;
}

export function createAxiosResponseErrorInterceptor(
  slatrap: SlatrapApi = Slatrap,
  options?: AxiosErrorInterceptorOptions,
) {
  return (error: unknown): Promise<never> => {
    const payload = resolveEmitPayloadForHttpError(error, options);
    void slatrap.emit(slatrap.sanitize(payload));

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

export {
  DEFAULT_REDACTION_TEXT,
  SENSITIVE_KEY_PATTERNS,
  sanitizeErrorData,
  type SanitizedValue,
  type SanitizerOptions,
  type StructuredValue,
} from './sanitization/sanitizer';

export type {
  AxiosErrorInterceptorOptions,
  FetchWithTimeoutInit,
  HttpTimeoutEmitInput,
  HttpTimeoutTransportError,
} from './http/http-timeout';

export {
  buildHttpTimeoutEmitPayload,
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
  PROVIDER_LATENCY_EVENT_NAME,
} from './core/provider-latency-emit';

export type { ProviderErrorEmitInput } from './core/provider-error-emit';

export { detectProvider, type DetectedProvider } from './core/detect-provider';

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

