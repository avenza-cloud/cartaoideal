import { getUsdBrlExchangeRate } from "@/lib/exchange-rate";
import { createRateLimiter, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const limiter = createRateLimiter({ windowMs: 60_000, max: 60, keyPrefix: "exchange-rate" });

export async function GET(req: Request) {
  const decision = await limiter.check(req);
  if (!decision.allowed) return tooManyRequests(decision, limiter.limit);

  // getUsdBrlExchangeRate never throws: it degrades to the PTAX fallback and
  // its upstream fetch is cached for 30min (next.revalidate).
  const rate = await getUsdBrlExchangeRate();
  return Response.json(rate, {
    headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
  });
}
