export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * In-memory TTL cache. Swap for Redis / SQLite later behind the same interface.
 */
export interface ExtractionCache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryCache implements ExtractionCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export function cacheKeyForInput(
  extractorId: string,
  input: { kind: string } & Record<string, unknown>,
): string {
  return `${extractorId}:${JSON.stringify(input)}`;
}
