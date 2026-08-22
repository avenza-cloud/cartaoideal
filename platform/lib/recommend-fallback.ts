import { getAllCards } from "@/lib/cards";
import { DEFAULT_VALUE_ASSUMPTIONS } from "@/lib/card-value";
import { scoreCards } from "@/lib/scoring";
import type { CardScore, CardValueAssumptions, UserProfile } from "@/types/cards";

async function getLiveAssumptions(): Promise<CardValueAssumptions> {
  try {
    const res = await fetch("/api/exchange-rate", { cache: "no-store" });
    if (!res.ok) return DEFAULT_VALUE_ASSUMPTIONS;
    const data = await res.json();
    const usdBrl = Number(data?.usdBrl);
    if (!Number.isFinite(usdBrl) || usdBrl <= 0) return DEFAULT_VALUE_ASSUMPTIONS;
    return { ...DEFAULT_VALUE_ASSUMPTIONS, ptaxBrlPerUsd: usdBrl };
  } catch {
    return DEFAULT_VALUE_ASSUMPTIONS;
  }
}

export async function getClientFallbackRecommendations(
  profile: UserProfile,
  limit = 10
): Promise<CardScore[]> {
  const assumptions = await getLiveAssumptions();
  return scoreCards(getAllCards(), profile, assumptions).slice(0, limit);
}

/** Pontua um único cartão do catálogo cliente (ex.: cartão atual fora do top-N da API). */
export async function scoreSingleClientCard(
  profile: UserProfile,
  stableId: string
): Promise<CardScore | null> {
  const card = getAllCards().find((c) => c.card_stable_id === stableId);
  if (!card) return null;
  const assumptions = await getLiveAssumptions();
  const scored = scoreCards([card], profile, assumptions);
  return scored[0] ?? null;
}

export async function fetchRecommendationsWithFallback(
  profile: UserProfile,
  limit = 10
): Promise<CardScore[]> {
  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    if (!res.ok) throw new Error(`recommend status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("recommend payload is not array");
    return (data as CardScore[]).slice(0, limit);
  } catch {
    return getClientFallbackRecommendations(profile, limit);
  }
}
