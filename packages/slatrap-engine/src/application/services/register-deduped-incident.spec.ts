import { InMemoryDedupStore } from '../../infrastructure/redis/dedup-store';
import { registerDedupedIncident } from './register-deduped-incident';

describe('registerDedupedIncident', () => {
  it('creates when cache and DB miss', async () => {
    const dedupStore = new InMemoryDedupStore();
    const findInDb = jest.fn().mockResolvedValue(null);
    const onCreate = jest.fn().mockResolvedValue({
      result: { id: 1, isDuplicate: false },
      cacheValue: { id: 1, count: 1 },
    });

    const result = await registerDedupedIncident({
      key: 'k1',
      windowSeconds: 60,
      dedupStore,
      parseCache: (raw) => JSON.parse(raw) as { id: number; count: number },
      findInDb,
      onCacheHit: jest.fn(),
      onDbHit: jest.fn(),
      onCreate,
    });

    expect(result).toEqual({ id: 1, isDuplicate: false });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(await dedupStore.get('k1')).toBe(JSON.stringify({ id: 1, count: 1 }));
  });

  it('uses cache hit branch when key exists', async () => {
    const dedupStore = new InMemoryDedupStore();
    await dedupStore.setex('k1', 60, JSON.stringify({ id: 7, count: 2 }));

    const onCacheHit = jest.fn().mockResolvedValue({
      result: { id: 7, isDuplicate: true, count: 3 },
      cacheValue: { id: 7, count: 3 },
    });

    const result = await registerDedupedIncident({
      key: 'k1',
      windowSeconds: 60,
      dedupStore,
      parseCache: (raw) => JSON.parse(raw) as { id: number; count: number },
      onCacheHit,
      findInDb: jest.fn(),
      onDbHit: jest.fn(),
      onCreate: jest.fn(),
    });

    expect(result).toEqual({ id: 7, isDuplicate: true, count: 3 });
    expect(onCacheHit).toHaveBeenCalledTimes(1);
    expect(await dedupStore.get('k1')).toBe(JSON.stringify({ id: 7, count: 3 }));
  });

  it('uses DB hit branch when cache misses', async () => {
    const dedupStore = new InMemoryDedupStore();
    const existing = { id: 9, count: 4 };
    const onDbHit = jest.fn().mockResolvedValue({
      result: { id: 9, isDuplicate: true, count: 5 },
      cacheValue: { id: 9, count: 5 },
    });

    const result = await registerDedupedIncident({
      key: 'k1',
      windowSeconds: 60,
      dedupStore,
      parseCache: (raw) => JSON.parse(raw) as { id: number; count: number },
      onCacheHit: jest.fn(),
      findInDb: jest.fn().mockResolvedValue(existing),
      onDbHit,
      onCreate: jest.fn(),
    });

    expect(result).toEqual({ id: 9, isDuplicate: true, count: 5 });
    expect(onDbHit).toHaveBeenCalledWith(existing, expect.any(Date));
    expect(await dedupStore.get('k1')).toBe(JSON.stringify({ id: 9, count: 5 }));
  });
});
