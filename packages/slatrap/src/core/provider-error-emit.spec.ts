import {
  buildProviderErrorEmitPayload,
  normalizeProviderErrorEmitPayload,
} from './provider-error-emit';
import { type SanitizedValue } from '../sanitization/sanitizer';
import { PROVIDER_LATENCY_EVENT_NAME } from './provider-latency-emit';

describe('buildProviderErrorEmitPayload', () => {
  it('builds the standard error envelope', () => {
    expect(
      buildProviderErrorEmitPayload({
        provider: 'plaid',
        endpoint: '/plaid/item-login-required',
        statusCode: 400,
        providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
        startedAt: 1_000,
      }),
    ).toEqual({
      provider: 'plaid',
      endpoint: '/plaid/item-login-required',
      statusCode: 400,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
      startedAt: 1_000,
    });
  });

  it('omits optional fields when not provided', () => {
    expect(
      buildProviderErrorEmitPayload({
        provider: 'stripe',
        providerPayload: { code: 'card_declined' },
      }),
    ).toEqual({
      provider: 'stripe',
      statusCode: null,
      providerPayload: { code: 'card_declined' },
    });
  });
});

describe('normalizeProviderErrorEmitPayload', () => {
  it('normalizes provider-error shaped payloads', () => {
    expect(
      normalizeProviderErrorEmitPayload({
        provider: 'stripe',
        providerPayload: { code: 'card_declined' },
      } as SanitizedValue),
    ).toEqual({
      provider: 'stripe',
      statusCode: null,
      providerPayload: { code: 'card_declined' },
    });
  });

  it('leaves core event envelopes unchanged', () => {
    const coreEvent = {
      eventName: PROVIDER_LATENCY_EVENT_NAME,
      payload: {
        provider: 'plaid',
        providerPayload: { ignored: true },
        startedAt: 1_000,
      },
    } as SanitizedValue;

    expect(normalizeProviderErrorEmitPayload(coreEvent)).toBe(coreEvent);
  });

  it('leaves non-provider-error payloads unchanged', () => {
    const raw = { message: 'boom', access_token: 'secret' } as SanitizedValue;
    expect(normalizeProviderErrorEmitPayload(raw)).toBe(raw);
  });
});
