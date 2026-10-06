/**
 * Token-bucket rate limiter — framework agnostic, no external deps.
 *
 * Usage (e.g. in a Next.js API route):
 *   const limiter = new RateLimiter({ limit: 10, windowMs: 60_000 });
 *   const { allowed, remaining } = limiter.check(ip);
 *   if (!allowed) return new Response("Too many requests", { status: 429 });
 */

interface RateLimiterOptions {
  /** Max requests per window. */
  limit: number;
  /** Window size in milliseconds. Default: 60 000 (1 min). */
  windowMs?: number;
}

interface CheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs ?? 60_000;
  }

  check(key: string): CheckResult {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count++;
    const allowed = bucket.count <= this.limit;
    const remaining = Math.max(0, this.limit - bucket.count);

    return { allowed, remaining, resetAt: bucket.resetAt };
  }

  /** Remove stale buckets to prevent memory leaks. */
  purge(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}

/** Default API rate limiter: 60 req/min per IP. */
export const apiLimiter = new RateLimiter({ limit: 60, windowMs: 60_000 });

/** Stricter limiter for auth endpoints: 5 req/min. */
export const authLimiter = new RateLimiter({ limit: 5, windowMs: 60_000 });
