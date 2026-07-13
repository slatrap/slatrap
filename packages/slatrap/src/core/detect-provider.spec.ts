import { detectProvider } from './detect-provider';

describe('detectProvider', () => {
  it.each([
    ['plaid error_code', { error_code: 'ITEM_LOGIN_REQUIRED' }, 'plaid'],
    ['plaid error_type', { error_type: 'ITEM_ERROR' }, 'plaid'],
    ['stripe type', { type: 'card_error' }, 'stripe'],
    ['stripe code', { code: 'card_declined' }, 'stripe'],
    ['message only', { message: 'Your card was declined.' }, undefined],
    ['unknown payload', { details: 'something went wrong' }, undefined],
    ['null payload', null, undefined],
    ['non-object payload', 'error', undefined],
  ] as const)(
    'detects %s',
    (_label, payload, expected) => {
      expect(detectProvider(payload)).toBe(expected);
    },
  );

  it('prefers plaid when both plaid and stripe shape fields are present', () => {
    expect(
      detectProvider({
        error_code: 'ITEM_LOGIN_REQUIRED',
        message: 'Re-auth required',
      }),
    ).toBe('plaid');
  });
});
