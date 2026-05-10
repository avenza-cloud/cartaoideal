import "server-only";
import facetsFile from "@/data/cards_brazil_ai_comparison_facets.json";
import { extractFeeWaiverRules } from "@/lib/fee-waiver";
import type {
  CardFacet,
  CardFilters,
  FeeWaiverRule,
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
const ALL_CARDS: CardFacet[] = uniqueByStableId(
  data.cards.filter(
    (c) =>
      !c.facets_boolean.generic_article_not_single_product &&
      !c.facets_boolean.issuer_multi_entity_row
  )
);

const BY_ID = new Map(ALL_CARDS.map((c) => [c.card_stable_id, c]));

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function getCardSearchScore(card: CardFacet, queryTokens: string[]): number {
  const identityTokens = tokenizeSearchText(`${card.display_name} ${card.issuer_raw}`);
  const displayNameTokens = tokenizeSearchText(card.display_name);
  const secondaryTokens = tokenizeSearchText(`${card.network_primary} ${card.variant_band}`);
  const identityText = normalizeSearchText(`${card.display_name} ${card.issuer_raw}`);

  if (queryTokens.every((token) => displayNameTokens.includes(token))) return 120;
  if (queryTokens.every((token) => identityTokens.includes(token))) return 100;
  if (
    queryTokens.every((token) =>
      identityTokens.some((identityToken) => identityToken.startsWith(token))
    )
  ) {
    return 80;
  }
  if (queryTokens.every((token) => secondaryTokens.includes(token))) return 30;
  if (
    queryTokens.every((token) =>
      secondaryTokens.some((secondaryToken) => secondaryToken.startsWith(token))
    )
  ) {
    return 20;
  }
  if (queryTokens.every((token) => identityText.includes(token))) return 10;
  return 0;
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

export function getCardFeeWaiver(card: CardFacet): {
  texto: string;
  rules: FeeWaiverRule[];
  viaInvestimento: boolean;
  viaGasto: boolean;
  isGratuito: boolean;
} | null {
  const char = card.characteristics?.find((x) => x.key === "fee_waiver");
  const texto = char?.value && char.value !== "unknown" ? String(char.value) : "";
  const rules = card.fee_waiver_rules?.length
    ? card.fee_waiver_rules
    : extractFeeWaiverRules(texto);
  if (!texto && rules.length === 0) return null;
  const lower = texto.toLowerCase();
  const isGratuito =
    rules.some((rule) => rule.category === "general" && rule.full_waiver) ||
    lower.startsWith("sem anuidade") ||
    lower.startsWith("todos os clientes são isentos") ||
    lower.startsWith("anuidade isenta para todos") ||
    lower.startsWith("não há anuidade");
  if (texto.startsWith("Não há") && rules.length === 0 && !lower.includes("investimento")) return null;
  return {
    texto,
    rules,
    viaInvestimento:
      rules.some((rule) => rule.category === "investment") ||
      lower.includes("investimento") ||
      lower.includes("investidos"),
    viaGasto:
      rules.some((rule) => rule.category === "monthly_spend") ||
      lower.includes("gasto") ||
      lower.includes("fatura") ||
      lower.includes("compras"),
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
    cards = cards.filter((c) =>
      c.network_primary
        .toLowerCase()
        .split(/\s*[\/,]\s*/)
        .some((n) => n === net)
    );
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
    // Sort by annual fee ascending so lower-barrier cards appear first
    cards = [...cards].sort((a, b) => {
      const fa = a.facets_numeric_or_special.annual_fee_brl_best_estimate;
      const fb = b.facets_numeric_or_special.annual_fee_brl_best_estimate;
      const na = typeof fa === "number" ? fa : 999999;
      const nb = typeof fb === "number" ? fb : 999999;
      return na - nb;
    });
  }

  if (filters.search) {
    const q = normalizeSearchText(filters.search);
    const tokens = tokenizeSearchText(q);
    const scoredCards = cards
      .map((card) => ({ card, score: getCardSearchScore(card, tokens) }))
      .filter(({ score }) => score > 0);
    const hasExactIdentityMatches = scoredCards.some(({ score }) => score >= 100);

    cards = scoredCards
      .filter(({ score }) => !hasExactIdentityMatches || score >= 100)
      .sort((a, b) => b.score - a.score)
      .map(({ card }) => card);
  }

  return cards;
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
    const t = structuredThresholds.length > 0
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
