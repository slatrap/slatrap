import {
  type SanitizedValue,
  type SanitizerOptions,
} from '../sanitization/sanitizer';

export type SlatrapEmitter = (payload: SanitizedValue) => void | Promise<void>;

export type Slatrap = {
  sanitize<T = unknown>(value: T, options?: SanitizerOptions): SanitizedValue;
  emit(payload: SanitizedValue): void | Promise<void>;
};

export type SlatrapOptions = {
  emit: SlatrapEmitter;
  redactionText?: string;
};

export type SlatrapProviderErrorEvent = {
  provider: string;
  endpoint?: string;
  statusCode?: number | null;
  providerPayload: unknown;
  latency?: number;
};

export type SlatrapCoreEventEnvelope = {
  eventName: string;
  payload: unknown;
};

export type ConfigureSlatrapForProviderErrorsOptions = {
  emitProviderError: (event: SlatrapProviderErrorEvent) => void | Promise<void>;
  defaultProvider?: string;
  redactionText?: string;
};

export type ConfigureSlatrapForCoreInspectorOptions = {
  emitter: {
    emit(eventName: string, payload: unknown): void | Promise<void>;
  };
  providerErrorEventName?: string;
  defaultProvider?: string;
  redactionText?: string;
};

export type ConfigurableSlatrap = Slatrap & {
  configure(options: SlatrapOptions): void;
  configureProviderErrors(
    options: ConfigureSlatrapForProviderErrorsOptions,
  ): void;
  configureForCoreInspector(
    options: ConfigureSlatrapForCoreInspectorOptions,
  ): void;
};
