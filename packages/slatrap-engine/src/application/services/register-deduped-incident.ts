import { type DedupStore } from '../../infrastructure/redis/dedup-store';

export type DedupBranchOutcome<TResult, TCache> = {
  result: TResult;
  cacheValue: TCache;
};

export type RegisterDedupedIncidentParams<TResult, TCache, TExisting> = {
  key: string;
  windowSeconds: number;
  dedupStore: DedupStore;
  parseCache: (raw: string) => TCache;
  serializeCache?: (value: TCache) => string;
  onCacheHit: (
    cached: TCache,
    now: Date,
  ) => Promise<DedupBranchOutcome<TResult, TCache>>;
  findInDb: (now: Date) => Promise<TExisting | null>;
  onDbHit: (
    existing: TExisting,
    now: Date,
  ) => Promise<DedupBranchOutcome<TResult, TCache>>;
  onCreate: (now: Date) => Promise<DedupBranchOutcome<TResult, TCache>>;
};

/**
 * Shared dedup scaffolding: cache → DB recent match → create, then refresh cache.
 * Domain rules stay in the branch callbacks.
 */
export async function registerDedupedIncident<TResult, TCache, TExisting>(
  params: RegisterDedupedIncidentParams<TResult, TCache, TExisting>,
): Promise<TResult> {
  const now = new Date();
  const cachedRaw = await params.dedupStore.get(params.key);
  const serialize = params.serializeCache ?? JSON.stringify;

  let outcome: DedupBranchOutcome<TResult, TCache>;

  if (cachedRaw) {
    outcome = await params.onCacheHit(params.parseCache(cachedRaw), now);
  } else {
    const existing = await params.findInDb(now);
    outcome = existing
      ? await params.onDbHit(existing, now)
      : await params.onCreate(now);
  }

  await params.dedupStore.setex(
    params.key,
    params.windowSeconds,
    serialize(outcome.cacheValue),
  );

  return outcome.result;
}
