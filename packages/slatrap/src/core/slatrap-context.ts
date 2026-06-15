import { sanitizeBeforeEmit } from './slatrap-emit-guard';
import { resolveEmitLatency } from './resolve-emit-latency';
import {
  type ConfigurableSlatrap,
  type ConfigureSlatrapForCoreInspectorOptions,
  type ConfigureSlatrapForProviderErrorsOptions,
  type SlatrapEmitter,
  type SlatrapOptions,
} from './slatrap.types';
import {
  sanitizeErrorData,
  type SanitizedValue,
  type SanitizerOptions,
} from '../sanitization/sanitizer';

type SlatrapContextHandlers = {
  configureProviderErrors: (
    options: ConfigureSlatrapForProviderErrorsOptions,
  ) => void;
  configureForCoreInspector: (
    options: ConfigureSlatrapForCoreInspectorOptions,
  ) => void;
};

export class SlatrapContext implements ConfigurableSlatrap {
  private configuredEmitter: SlatrapEmitter = () => undefined;
  private configuredRedactionText: string | undefined;

  constructor(private readonly handlers: SlatrapContextHandlers) {}

  configure(options: SlatrapOptions): void {
    this.configuredEmitter = options.emit;
    this.configuredRedactionText = options.redactionText;
  }

  configureProviderErrors(
    options: ConfigureSlatrapForProviderErrorsOptions,
  ): void {
    this.handlers.configureProviderErrors(options);
  }

  configureForCoreInspector(
    options: ConfigureSlatrapForCoreInspectorOptions,
  ): void {
    this.handlers.configureForCoreInspector(options);
  }

  sanitize<T = unknown>(value: T, options?: SanitizerOptions): SanitizedValue {
    return sanitizeErrorData(value, {
      redactionText: options?.redactionText ?? this.configuredRedactionText,
    });
  }

  emit(payload: SanitizedValue): void | Promise<void> {
    const payloadWithLatency = resolveEmitLatency(payload);
    const sanitizedPayload = sanitizeBeforeEmit(
      payloadWithLatency,
      this.configuredRedactionText,
    );
    return this.configuredEmitter(sanitizedPayload);
  }
}
