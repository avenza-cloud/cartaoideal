import facetsFile from "@/data/cards_brazil_ai_comparison_facets.json";
import { DEFAULT_VALUE_ASSUMPTIONS } from "@/lib/card-value";
import { scoreCards } from "@/lib/scoring";
import type { CardFacet, CardScore, FacetsFile, UserProfile } from "@/types/cards";

const data = facetsFile as FacetsFile;

function uniqueByStableId(cards: CardFacet[]): CardFacet[] {
  const byId = new Map<string, CardFacet>();
  for (const card of cards) {
    if (!byId.has(card.card_stable_id)) {
      byId.set(card.card_stable_id, card);
    }
  }
  return [...byId.values()];
}

const FALLBACK_CARDS: CardFacet[] = uniqueByStableId(
  data.cards.filter(
    (card) =>
      !card.facets_boolean.generic_article_not_single_product &&
      !card.facets_boolean.issuer_multi_entity_row
  )
);

export function getClientFallbackRecommendations(
  profile: UserProfile,
  limit = 10
): CardScore[] {
  return scoreCards(FALLBACK_CARDS, profile, DEFAULT_VALUE_ASSUMPTIONS).slice(
    0,
    limit
  );
}

/** Pontua um único cartão do catálogo cliente (ex.: cartão atual fora do top-N da API). */
export function scoreSingleClientCard(profile: UserProfile, stableId: string): CardScore | null {
  const card = FALLBACK_CARDS.find((c) => c.card_stable_id === stableId);
  if (!card) return null;
  const scored = scoreCards([card], profile, DEFAULT_VALUE_ASSUMPTIONS);
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
