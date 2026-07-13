import { detectProvider } from '@slatrap/slatrap';
import { type FintechErrorContext } from './provider-error.types';

type ErrorPayloadRecord = Record<string, unknown>;

export { type FintechErrorContext } from './provider-error.types';

function normalizeFintechPayload(
  payload: unknown,
  provider?: string,
): FintechErrorContext {
  const nestedPayload = extractNestedProviderPayload(payload);
  const payloadValue = nestedPayload?.payload ?? payload;
  const payloadRecord = isRecord(payloadValue) ? payloadValue : undefined;

  return {
    provider:
      provider ?? nestedPayload?.provider ?? detectProvider(payloadRecord),
    payload: payloadValue,
    errorCode: readString(payloadRecord, [
      'error_code',
      'decline_code',
      'code',
    ]),
    errorType: readString(payloadRecord, ['error_type', 'type']),
    errorMessage: readString(payloadRecord, ['error_message', 'message']),
    requestId: readString(payloadRecord, ['request_id', 'requestId']),
    userId: readString(payloadRecord, ['user_id', 'userId']),
    itemId: readString(payloadRecord, ['item_id', 'itemId']),
    institutionId: readString(payloadRecord, [
      'institution_id',
      'institutionId',
    ]),
    institutionName: readString(payloadRecord, [
      'institution_name',
      'institutionName',
    ]),
  };
}

export { normalizeFintechPayload };

function extractNestedProviderPayload(payload: unknown): {
  provider?: string;
  payload: unknown;
} | null {
  if (!isRecord(payload)) {
    return null;
  }

  const response = payload.response;
  if (isRecord(response) && 'data' in response) {
    return {
      provider: detectProvider(
        isRecord(response.data) ? response.data : undefined,
      ),
      payload: response.data,
    };
  }

  for (const provider of ['plaid', 'stripe'] as const) {
    if (payload[provider] !== undefined) {
      return {
        provider,
        payload: payload[provider],
      };
    }
  }

  return null;
}

function readString(
  payload: ErrorPayloadRecord | undefined,
  keys: string[],
): string | undefined {
  if (!payload) {
    return undefined;
  }

  for (const key of keys) {
    if (typeof payload[key] === 'string') {
      return payload[key];
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is ErrorPayloadRecord {
  return typeof value === 'object' && value !== null;
}
