import { isRecord, toRecord } from './is-record';

describe('isRecord / toRecord', () => {
  it('accepts plain objects', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(toRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it('rejects arrays (documented edge case)', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([{ error_code: 'X' }])).toBe(false);
    expect(toRecord([{ error_code: 'X' }])).toBeNull();
  });

  it('rejects null, primitives, and functions', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(1)).toBe(false);
    expect(isRecord(() => undefined)).toBe(false);
    expect(toRecord(null)).toBeNull();
  });
});
