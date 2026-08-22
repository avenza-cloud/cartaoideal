/**
 * Per-IP token-bucket rate limiting for the API routes.
 *
 * The default store is in-memory: good enough locally and as best-effort abuse
 * friction on Vercel, but serverless instances each get their own Map, so the
 * effective fleet-wide limit is (limit × instances) and resets on cold starts.
 * For real enforcement plug a shared store (e.g. Upstash Redis) into
 * `RateLimitStore` — the interface is async precisely so a network-backed
 * implementation can drop in without touching the routes.
 */

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number, max: number): Promise<RateLimitDecision>;
}

class InMemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitDecision> {
    const now = Date.now();
    // Opportunistic pruning keeps the map from growing unbounded.
    if (this.buckets.size > 10_000) {
      for (const [k, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(k);
      }
    }
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= max,
      remaining: Math.max(0, max - bucket.count),
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
}

const sharedStore: RateLimitStore = new InMemoryStore();

export interface RateLimiter {
  check(req: Request): Promise<RateLimitDecision>;
  limit: number;
}

export function createRateLimiter({
  windowMs,
  max,
  keyPrefix,
  store = sharedStore,
}: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  store?: RateLimitStore;
}): RateLimiter {
  return {
    limit: max,
    check: (req) => store.hit(`${keyPrefix}:${getClientIp(req)}`, windowMs, max),
  };
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Standard 429 with Retry-After / X-RateLimit headers. */
export function tooManyRequests(decision: RateLimitDecision, limit: number): Response {
  return Response.json(
    { error: "Muitas requisições. Tente novamente em instantes." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, decision.retryAfterSeconds)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(decision.remaining),
      },
    }
  );
}
