import { z } from "zod";
import { getAllCards, getCardById, resolveCardByName } from "@/lib/cards";
import { scoreCards } from "@/lib/scoring";
import { scoreCardValue, scoreCardValues } from "@/lib/card-value";
import { getValueAssumptionsWithLiveUsd } from "@/lib/exchange-rate";
import { profileSchema } from "@/lib/profile-schema";
import { apiError } from "@/lib/api-error";
import { createRateLimiter, tooManyRequests } from "@/lib/rate-limit";
import { logEvent } from "@/lib/log";
import type { CardValueScore, UserProfile } from "@/types/cards";

export const runtime = "nodejs";

// Full-catalog scoring per request: rate-limited to keep the unauthenticated
// endpoint from becoming a CPU amplification vector.
const limiter = createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: "recommend" });

const bodySchema = z.object({
  profile: profileSchema,
  limit: z.number().int().min(1).max(30).default(10),
});

interface CurrentCardResult {
  rank: number | null;
  score: CardValueScore;
}

export async function POST(req: Request) {
  const start = Date.now();

  const decision = await limiter.check(req);
  if (!decision.allowed) return tooManyRequests(decision, limiter.limit);

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError("invalid_input", "Perfil inválido");
  const profile = parsed.data.profile as UserProfile;

  const cards = getAllCards();
  const assumptions = await getValueAssumptionsWithLiveUsd();
  const scores = scoreCards(cards, profile, assumptions).slice(0, parsed.data.limit);

  // Resolve the user's current card server-side so clients don't need the
  // catalog: rank among eligible cards + its value score.
  let currentCard: CurrentCardResult | null = null;
  const current = profile.currentPrimaryCardId
    ? getCardById(profile.currentPrimaryCardId)
    : profile.currentPrimaryCardName
      ? resolveCardByName(profile.currentPrimaryCardName)
      : undefined;
  if (current) {
    const valueScores = scoreCardValues(cards, profile, "profile", assumptions);
    const eligible = valueScores.filter((score) => score.eligible);
    const index = eligible.findIndex(
      (score) => score.card.card_stable_id === current.card_stable_id
    );
    const score =
      valueScores.find((s) => s.card.card_stable_id === current.card_stable_id) ??
      scoreCardValue(current, profile, "profile", assumptions);
    currentCard = { rank: index >= 0 ? index + 1 : null, score };
  }

  logEvent("/api/recommend", { count: scores.length, ms: Date.now() - start });

  return Response.json({ scores, currentCard });
}
