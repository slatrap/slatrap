import { resolveEmitLatency } from './resolve-emit-latency';
import { normalizeProviderErrorEmitPayload } from './provider-error-emit';
import {
  type ConfigurableSlatrap,
  type ConfigureSlatrapForCoreInspectorOptions,
  type SlatrapEmitter,
  type SlatrapOptions,
} from './slatrap.types';
import {
  sanitizeErrorData,
  type SanitizedValue,
  type SanitizerOptions,
} from '../sanitization/sanitizer';

type SlatrapContextHandlers = {
  configureForCoreInspector: (
    options: ConfigureSlatrapForCoreInspectorOptions,
  ) => void;
};

export class SlatrapContext implements ConfigurableSlatrap {
  private configuredEmitter: SlatrapEmitter = () => undefined;
  private configuredRedactionText: string | undefined;

  constructor(
    private readonly handlers: SlatrapContextHandlers = {
      configureForCoreInspector: () => undefined,
    },
  ) {}

  configure(options: SlatrapOptions): void {
    this.configuredEmitter = options.emit;
    this.configuredRedactionText = options.redactionText;
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

  /**
   * Emits a previously sanitized payload.
   * Call `sanitize` first — emit does not sanitize again.
   */
  emit(payload: SanitizedValue): void | Promise<void> {
    const normalizedPayload = normalizeProviderErrorEmitPayload(payload);
    const payloadWithLatency = resolveEmitLatency(normalizedPayload);
    return this.configuredEmitter(payloadWithLatency);
  }
}
