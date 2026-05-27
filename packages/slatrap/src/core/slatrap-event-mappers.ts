import {
  type SlatrapCoreEventEnvelope,
  type SlatrapProviderErrorEvent,
} from './slatrap.types';
import { type SanitizedValue } from '../sanitization/sanitizer';

export function toProviderErrorEvent(
  payload: SanitizedValue,
  defaultProvider?: string,
): SlatrapProviderErrorEvent {
  const envelope = toRecord(payload);
  const provider = readString(envelope?.provider) ?? defaultProvider ?? 'plaid';
  const endpoint = readString(envelope?.endpoint);
  const statusCode = readNumberOrNull(envelope?.statusCode);
  const latency = readNumber(envelope?.latency);
  const providerPayload = envelope?.providerPayload ?? payload;

  return {
    provider,
    endpoint,
    statusCode,
    providerPayload,
    latency,
  };
}

export function toCoreEventEnvelope(
  payload: SanitizedValue,
): SlatrapCoreEventEnvelope | null {
  const envelope = toRecord(payload);
  const eventName = readString(envelope?.eventName);

  if (!eventName) {
    return null;
  }

  return {
    eventName,
    payload: envelope?.payload ?? {},
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function readNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }

  return readNumber(value);
}
