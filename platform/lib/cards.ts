import "server-only";
import facetsFile from "@/data/cards_brazil_ai_comparison_facets.json";
import type {
  CardFacet,
  CardFilters,
  FacetsFile,
  MarketSegment,
} from "@/types/cards";

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

// Real cards only (skip generic articles / multi-issuer aggregates)
const ALL_CARDS: CardFacet[] = uniqueByStableId(data.cards.filter(
  (c) =>
    !c.facets_boolean.generic_article_not_single_product &&
    !c.facets_boolean.issuer_multi_entity_row
));

const BY_ID = new Map(ALL_CARDS.map((c) => [c.card_stable_id, c]));

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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
  const tokens = q.split(/\s+/).filter(Boolean);

  return ALL_CARDS.map((card) => {
    const haystack = normalizeSearchText(
      `${card.display_name} ${card.issuer_raw} ${card.network_primary}`
    );
    const exactName = normalizeSearchText(card.display_name) === q;
    const includes = haystack.includes(q);
    const tokenHits = tokens.filter((token) => haystack.includes(token)).length;
    const score =
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

export function getCardFeeWaiver(card: CardFacet): {
  texto: string;
  viaInvestimento: boolean;
  viaGasto: boolean;
  isGratuito: boolean;
} | null {
  const char = card.characteristics?.find((x) => x.key === "fee_waiver");
  if (!char || !char.value || char.value === "unknown") return null;
  const texto = String(char.value);
  const lower = texto.toLowerCase();
  const isGratuito =
    lower.startsWith("sem anuidade") ||
    lower.startsWith("todos os clientes são isentos") ||
    lower.startsWith("anuidade isenta para todos") ||
    lower.startsWith("não há anuidade");
  if (texto.startsWith("Não há") && !lower.includes("investimento")) return null;
  return {
    texto,
    viaInvestimento: lower.includes("investimento") || lower.includes("investidos"),
    viaGasto: lower.includes("gasto") || lower.includes("fatura") || lower.includes("compras"),
    isGratuito,
  };
}

export function filterCards(filters: CardFilters): CardFacet[] {
  let cards = ALL_CARDS;

  if (filters.segment) {
    cards = cards.filter((c) => c.market_segment_guess === filters.segment);
  }

  if (filters.network) {
    const net = filters.network.toLowerCase();
    cards = cards.filter((c) => c.network_primary.toLowerCase() === net);
  }

  if (filters.lounge === true) {
    cards = cards.filter((c) => c.lounge_access.has_lounge_access);
  }

  if (filters.points === true) {
    cards = cards.filter((c) => c.facets_boolean.earn_points_or_miles);
  }

  if (
    filters.rewardReturn === true ||
    filters.cashback === true ||
    filters.investback === true
  ) {
    cards = cards.filter((c) => c.reward_return.has_cashlike_return);
  }

  if (filters.zeroFee === true) {
    cards = cards.filter(
      (c) =>
        c.facets_numeric_or_special.annual_fee_brl_best_estimate === 0 ||
        c.facets_numeric_or_special.annual_fee_brl_best_estimate === "unknown"
    );
  }

  if (typeof filters.maxFee === "number") {
    const max = filters.maxFee;
    cards = cards.filter((c) => {
      const fee = c.facets_numeric_or_special.annual_fee_brl_best_estimate;
      if (typeof fee === "number") return fee <= max;
      return false;
    });
  }

  if (filters.feeWaiverByInvestment === true) {
    cards = cards.filter((c) => getCardFeeWaiver(c)?.viaInvestimento === true);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    cards = cards.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.issuer_raw.toLowerCase().includes(q) ||
        c.network_primary.toLowerCase().includes(q)
    );
  }

  return cards;
}

export function getSegments(): MarketSegment[] {
  return ["mass_or_general", "upper_mass", "premium", "ultra_premium"];
}

export function getNetworks(): string[] {
  return [...new Set(ALL_CARDS.map((c) => c.network_primary))].sort();
}
