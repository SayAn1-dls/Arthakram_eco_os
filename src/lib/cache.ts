/**
 * Lightweight in-memory LRU cache with TTL support.
 *
 * Useful for memoising expensive DB reads, permission checks,
 * and scoring results without spinning up Redis.
 *
 * Usage:
 *   const cache = new LRUCache<string, UserProfile>({ maxSize: 256, ttlMs: 60_000 });
 *   cache.set("user:42", profile);
 *   const hit = cache.get("user:42");  // undefined after TTL expires
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  /** Position in the doubly-linked access list (newest = head). */
  prev: string | null;
  next: string | null;
}

interface LRUCacheOptions {
  /** Maximum number of entries before oldest are evicted. Default: 512. */
  maxSize?: number;
  /** Time-to-live in milliseconds. Default: 5 minutes. */
  ttlMs?: number;
}

export class LRUCache<K extends string, V> {
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly store = new Map<K, CacheEntry<V>>();

  /** Doubly-linked list pointers — head is most recently used. */
  private head: K | null = null;
  private tail: K | null = null;

  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 512;
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }

    this.promote(key);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.store.has(key)) {
      const entry = this.store.get(key)!;
      entry.value = value;
      entry.expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
      this.promote(key);
      return;
    }

    if (this.store.size >= this.maxSize) this.evict();

    const entry: CacheEntry<V> = {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
      prev: null,
      next: this.head,
    };

    if (this.head) this.store.get(this.head)!.prev = key;
    this.head = key;
    if (!this.tail) this.tail = key;

    this.store.set(key, entry);
  }

  has(key: K): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    if (!this.store.has(key)) return false;
    this.unlink(key);
    this.store.delete(key);
    return true;
  }

  clear(): void {
    this.store.clear();
    this.head = null;
    this.tail = null;
  }

  /** Evict all entries whose TTL has already elapsed. */
  purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  get size(): number {
    return this.store.size;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /** Move key to the head (most recently used). */
  private promote(key: K): void {
    if (this.head === key) return;
    this.unlink(key);
    const entry = this.store.get(key)!;
    entry.prev = null;
    entry.next = this.head;
    if (this.head) this.store.get(this.head)!.prev = key;
    this.head = key;
  }

  /** Remove a key from the linked list without deleting from store. */
  private unlink(key: K): void {
    const entry = this.store.get(key);
    if (!entry) return;

    if (entry.prev) this.store.get(entry.prev as K)!.next = entry.next;
    else this.head = entry.next as K | null;

    if (entry.next) this.store.get(entry.next as K)!.prev = entry.prev;
    else this.tail = entry.prev as K | null;

    entry.prev = null;
    entry.next = null;
  }

  /** Evict the least recently used entry (tail). */
  private evict(): void {
    if (!this.tail) return;
    this.delete(this.tail);
  }
}

// ─── Singleton caches for common hot paths ────────────────────────────────────

/** Short-lived cache for permission / role lookups (30 s). */
export const permissionCache = new LRUCache<string, boolean>({
  maxSize: 1024,
  ttlMs: 30_000,
});

/** Medium-lived cache for scoring results (2 min). */
export const scoringCache = new LRUCache<string, number>({
  maxSize: 512,
  ttlMs: 2 * 60_000,
});

/** Long-lived cache for static recommendation data (10 min). */
export const recommendCache = new LRUCache<string, unknown>({
  maxSize: 256,
  ttlMs: 10 * 60_000,
});
