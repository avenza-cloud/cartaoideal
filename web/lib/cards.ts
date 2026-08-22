import "server-only";
import facetsFile from "@/data/generated/cards.json";
import {
  normalizeSearchText,
  tokenizeSearchText,
  getCardSearchScore,
  getCardFeeWaiver,
  filterCards as clientFilterCards,
} from "@/lib/filter-cards";
import { FacetsFileSchema } from "@/lib/card-schema";
import type { CardFacet, CardFilters, FacetsFile, MarketSegment } from "@/types/cards";

// In prod the cast is safe: CI parses the whole catalog against the schema on
// every PR (lib/__tests__/card-data.test.ts). Dev/test parse eagerly so a bad
// local data edit fails at boot, not at render.
const data =
  process.env.NODE_ENV === "production"
    ? (facetsFile as FacetsFile)
    : FacetsFileSchema.parse(facetsFile);

function uniqueByStableId(cards: CardFacet[]): CardFacet[] {
  const byId = new Map<string, CardFacet>();
  for (const card of cards) {
    if (!byId.has(card.card_stable_id)) byId.set(card.card_stable_id, card);
  }
  return [...byId.values()];
}

const ALL_CARDS: CardFacet[] = uniqueByStableId(
  data.cards.filter(
    (c) =>
      !c.facets_boolean.generic_article_not_single_product &&
      !c.facets_boolean.issuer_multi_entity_row
  )
);

const BY_ID = new Map(ALL_CARDS.map((c) => [c.card_stable_id, c]));

export { getCardFeeWaiver };

export function getAllCards(): CardFacet[] {
  return ALL_CARDS;
}

export function getCardById(id: string): CardFacet | undefined {
  return BY_ID.get(id);
}

export function getCardsByIds(ids: string[]): CardFacet[] {
  return ids.flatMap((id) => {
    const c = BY_ID.get(id);
    return c ? [c] : [];
  });
}

export function findCardsByName(query: string, limit = 6): CardFacet[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const tokens = tokenizeSearchText(query);

  return ALL_CARDS.map((card) => {
    const haystack = normalizeSearchText(
      `${card.display_name} ${card.issuer_raw} ${card.network_primary}`
    );
    const exactName = normalizeSearchText(card.display_name) === q;
    const searchScore = getCardSearchScore(card, tokens);
    const includes = haystack.includes(q);
    const tokenHits = tokens.filter((token) => haystack.includes(token)).length;
    const score =
      searchScore +
      (exactName ? 100 : 0) +
      (includes ? 40 : 0) +
      tokenHits * 8 -
      Math.abs(normalizeSearchText(card.display_name).length - q.length) / 20;
    return { card, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ card }) => card);
}

export function resolveCardByName(query: string): CardFacet | undefined {
  return findCardsByName(query, 1)[0];
}

export function filterCards(filters: CardFilters): CardFacet[] {
  return clientFilterCards(ALL_CARDS, filters);
}

export function groupCardsByInvestment(
  cards: CardFacet[],
  userInvestedBrl: number,
  extractThreshold: (texto: string) => number | null
): {
  accessible: CardFacet[];
  needsMore: Array<{ card: CardFacet; threshold: number; shortfall: number }>;
} {
  const accessible: CardFacet[] = [];
  const needsMore: Array<{ card: CardFacet; threshold: number; shortfall: number }> = [];
  for (const card of cards) {
    const waiver = getCardFeeWaiver(card);
    const structuredThresholds =
      waiver?.rules
        .filter((rule) => rule.category === "investment" && typeof rule.threshold_brl === "number")
        .map((rule) => rule.threshold_brl as number) ?? [];
    const t =
      structuredThresholds.length > 0
        ? Math.min(...structuredThresholds)
        : extractThreshold(waiver?.texto ?? "");
    if (t === null || userInvestedBrl >= t) {
      accessible.push(card);
    } else {
      needsMore.push({ card, threshold: t, shortfall: t - userInvestedBrl });
    }
  }
  return { accessible, needsMore };
}

export function getSegments(): MarketSegment[] {
  return ["mass_or_general", "upper_mass", "premium", "ultra_premium"];
}

export function getNetworks(): string[] {
  return [...new Set(ALL_CARDS.map((c) => c.network_primary))].sort();
}
