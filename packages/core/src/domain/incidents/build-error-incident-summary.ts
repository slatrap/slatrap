import { type CapturedProviderError } from '../errors/provider-error.types';
import { classifyErrorSeverity } from './error-severity.classifier';
import { type ErrorIncidentSummary } from './incident.types';

export type BuildErrorIncidentSummaryInput = {
  captured: CapturedProviderError;
  latency?: number;
};

export function buildErrorIncidentSummary(
  input: BuildErrorIncidentSummaryInput,
): ErrorIncidentSummary {
  const severity = classifyErrorSeverity({
    provider: input.captured.normalizedProvider,
    errorCode: input.captured.errorCode,
    errorType: input.captured.errorType,
    statusCode: input.captured.statusCode,
  });

  return {
    provider: input.captured.normalizedProvider ?? 'unknown',
    errorCode: input.captured.errorCode ?? '',
    errorType: input.captured.errorType ?? '',
    errorMessage: input.captured.errorMessage ?? '',
    endpoint: input.captured.endpoint ?? '',
    statusCode: input.captured.statusCode ?? 0,
    severity,
    requestId: input.captured.requestId,
    latency: input.latency,
    metadata: { ...input.captured.metadata },
  };
}
