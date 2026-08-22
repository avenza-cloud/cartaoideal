import { z } from "zod";
import { getAllCards } from "@/lib/cards";
import { scoreCardValues, DEFAULT_SCORING_PROFILE } from "@/lib/card-value";
import { getValueAssumptionsWithLiveUsd } from "@/lib/exchange-rate";
import { feeNote, feeTier } from "@/lib/roi";
import { feeWaiverBadgesForCard } from "@/lib/fee-waiver-badges";
import { createRateLimiter, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const limiter = createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: "cards-top" });

// UI-driven GET: clamp instead of erroring ("?limit=abc" → default).
const limitSchema = z.coerce.number().int().min(1).max(30).catch(10);

export async function GET(req: Request) {
  const decision = await limiter.check(req);
  if (!decision.allowed) return tooManyRequests(decision, limiter.limit);

  const url = new URL(req.url);
  const limit = limitSchema.parse(url.searchParams.get("limit") ?? "10");

  const assumptions = await getValueAssumptionsWithLiveUsd();
  const scored = scoreCardValues(
    getAllCards(),
    DEFAULT_SCORING_PROFILE,
    "default",
    assumptions
  ).slice(0, limit);

  const defaultSpend = DEFAULT_SCORING_PROFILE.avgMonthlySpendBrl;

  return Response.json(
    scored.map((score) => {
      const c = score.card;
      // Fee note/tier/badges are computed here so the response can stay slim:
      // no card object, no assumptions — just display data + the value score.
      const { card: _card, assumptions: _assumptions, ...slimScore } = score;
      return {
        id: c.card_stable_id,
        nome: c.display_name,
        emissor: c.issuer_raw,
        bandeira: c.network_primary,
        segmento: c.market_segment_guess,
        anuidade: c.facets_numeric_or_special.annual_fee_brl_best_estimate,
        rankingPosition: c.ranking_position,
        rankingScore: c.ranking_score,
        score: slimScore,
        note: feeNote(c, defaultSpend, score.effectiveAnnualFeeBrl),
        tier: feeTier(c, defaultSpend, score.effectiveAnnualFeeBrl),
        badges: feeWaiverBadgesForCard(c),
        lounge: c.lounge_access,
        retornoFinanceiro: c.reward_return,
        pontos: c.facets_boolean.earn_points_or_miles,
        cardArtUrl: c.media.card_art_url,
        altText: c.media.alt_text,
      };
    })
  );
}
