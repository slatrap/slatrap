import { type CapturedProviderError } from '../errors/provider-error.types';
import { classifyErrorSeverity } from './error-severity.classifier';
import { buildErrorIncidentFingerprint } from './incident-fingerprint';
import { type ErrorIncidentSummary } from './incident.types';

export type BuildErrorIncidentSummaryInput = {
  captured: CapturedProviderError;
  latency?: number;
  environment?: string;
};

export function buildErrorIncidentSummary(
  input: BuildErrorIncidentSummaryInput,
): ErrorIncidentSummary {
  const provider = input.captured.normalizedProvider ?? 'unknown';
  const errorCode = input.captured.errorCode ?? '';
  const errorType = input.captured.errorType ?? '';
  const endpoint = input.captured.endpoint ?? '';

  const severity = classifyErrorSeverity({
    provider,
    errorCode,
    errorType,
    statusCode: input.captured.statusCode,
  });

  const fingerprint = buildErrorIncidentFingerprint({
    provider,
    errorCode,
    errorType,
    endpoint,
    environment: input.environment,
  });

  return {
    provider,
    errorCode,
    errorType,
    errorMessage: input.captured.errorMessage ?? '',
    endpoint,
    statusCode: input.captured.statusCode ?? 0,
    severity,
    requestId: input.captured.requestId,
    latency: input.latency,
    metadata: { ...input.captured.metadata },
    fingerprint,
  };
}
