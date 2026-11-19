import { getUsdBrlExchangeRate } from "@/lib/exchange-rate";
import { createRateLimiter, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const limiter = createRateLimiter({ windowMs: 60_000, max: 60, keyPrefix: "exchange-rate" });

export async function GET(req: Request) {
  const decision = await limiter.check(req);
  if (!decision.allowed) return tooManyRequests(decision, limiter.limit);

  // getUsdBrlExchangeRate never throws: it tries a multi-provider chain cached
  // for 1 hour (3600s) and degrades to the fallback constant only if all fail.
  const rate = await getUsdBrlExchangeRate();
  const cacheControl =
    rate.source === "fallback" ? "no-store" : "public, s-maxage=3600, stale-while-revalidate=7200";
  return Response.json(rate, {
    headers: { "Cache-Control": cacheControl },
  });
}
