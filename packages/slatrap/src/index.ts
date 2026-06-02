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
      const sanitizedPayload = sanitizeBeforeEmit(
        payload,
        options.redactionText,
      );
      return options.emit(sanitizedPayload);
    },
  };
}

export function createAxiosResponseErrorInterceptor(
  slatrap: SlatrapApi = Slatrap,
) {
  return (error: unknown): Promise<never> => {
    const cleanData = slatrap.sanitize(error);
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
