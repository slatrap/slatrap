import { normalizeEndpointForFingerprint } from './incident-endpoint-normalizer';

describe('normalizeEndpointForFingerprint', () => {
  it('replaces stripe object ids with a placeholder', () => {
    expect(normalizeEndpointForFingerprint('/v1/charges/ch_3NabcXYZ')).toBe(
      '/v1/charges/:id',
    );
    expect(
      normalizeEndpointForFingerprint('/v1/payment_intents/pi_1Q2w3e'),
    ).toBe('/v1/payment_intents/:id');
  });

  it('replaces refund, payout, and other stripe ids with a placeholder', () => {
    expect(
      normalizeEndpointForFingerprint('/v1/refunds/re_3NabcXYZ/cancel'),
    ).toBe('/v1/refunds/:id/cancel');
    expect(normalizeEndpointForFingerprint('/v1/payouts/po_1Q2w3e')).toBe(
      '/v1/payouts/:id',
    );
    expect(
      normalizeEndpointForFingerprint('/v1/disputes/dp_1Q2w3e/close'),
    ).toBe('/v1/disputes/:id/close');
  });

  it('keeps stripe resource names that contain underscores unchanged', () => {
    expect(normalizeEndpointForFingerprint('/v1/payment_intents')).toBe(
      '/v1/payment_intents',
    );
    expect(normalizeEndpointForFingerprint('/v1/setup_intents')).toBe(
      '/v1/setup_intents',
    );
  });

  it('replaces long numeric and uuid segments', () => {
    expect(normalizeEndpointForFingerprint('/orders/123456/items')).toBe(
      '/orders/:id/items',
    );
    expect(
      normalizeEndpointForFingerprint(
        '/users/3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      ),
    ).toBe('/users/:id');
  });

  it('keeps fixed path segments unchanged', () => {
    expect(normalizeEndpointForFingerprint('/v1/charges')).toBe('/v1/charges');
    expect(normalizeEndpointForFingerprint('/plaid/transactions/get')).toBe(
      '/plaid/transactions/get',
    );
    expect(normalizeEndpointForFingerprint('stripe/timeout')).toBe(
      'stripe/timeout',
    );
  });

  it('removes query strings and fragments', () => {
    expect(normalizeEndpointForFingerprint('/v1/customers?limit=10#top')).toBe(
      '/v1/customers',
    );
  });

  it('returns an empty string for an empty endpoint', () => {
    expect(normalizeEndpointForFingerprint('')).toBe('');
  });
});
