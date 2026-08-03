import { getStripeSimulation, STRIPE_SIMULATIONS } from './stripe-simulator.definitions';

describe('stripe-simulator.definitions', () => {
  it('keys scenarios by HTTP route segment', () => {
    expect(Object.keys(STRIPE_SIMULATIONS)).toEqual(
      expect.arrayContaining([
        'insufficient-funds',
        'timeout',
        'fraudulent',
      ]),
    );
    expect(getStripeSimulation('insufficient-funds')?.kind).toBe('decline');
    expect(getStripeSimulation('timeout')?.kind).toBe('timeout');
    expect(getStripeSimulation('missing')).toBeUndefined();
  });
});
