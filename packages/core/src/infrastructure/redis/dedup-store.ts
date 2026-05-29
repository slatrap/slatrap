export interface DedupStore {
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
}

export class InMemoryDedupStore implements DedupStore {
  private readonly entries = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

export class RedisDedupStore implements DedupStore {
  constructor(
    private readonly redis: {
      get(key: string): Promise<string | null>;
      setex(key: string, ttl: number, value: string): Promise<unknown>;
    },
  ) {}

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
  }
}
