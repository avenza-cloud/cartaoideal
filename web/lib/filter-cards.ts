import { extractFeeWaiverRules } from "@/lib/fee-waiver";
import type { CardFacet, CardFilters, FeeWaiverRule } from "@/types/cards";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

export function getCardSearchScore(card: CardFacet, queryTokens: string[]): number {
  const identityTokens = tokenizeSearchText(`${card.display_name} ${card.issuer_raw}`);
  const displayNameTokens = tokenizeSearchText(card.display_name);
  const secondaryTokens = tokenizeSearchText(`${card.network_primary} ${card.variant_band}`);
  const identityText = normalizeSearchText(`${card.display_name} ${card.issuer_raw}`);

  if (queryTokens.every((token) => displayNameTokens.includes(token))) return 120;
  if (queryTokens.every((token) => identityTokens.includes(token))) return 100;
  if (queryTokens.every((token) => identityTokens.some((t) => t.startsWith(token)))) return 80;
  if (queryTokens.every((token) => secondaryTokens.includes(token))) return 30;
  if (queryTokens.every((token) => secondaryTokens.some((t) => t.startsWith(token)))) return 20;
  if (queryTokens.every((token) => identityText.includes(token))) return 10;
  return 0;
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
  if (texto.startsWith("Não há") && rules.length === 0 && !lower.includes("investimento"))
    return null;
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

export function filterCards(allCards: CardFacet[], filters: CardFilters): CardFacet[] {
  let cards = allCards;

  if (filters.segment) {
    cards = cards.filter((c) => c.market_segment_guess === filters.segment);
  }

  if (filters.network) {
    const net = filters.network.toLowerCase();
    cards = cards.filter((c) =>
      c.network_primary
        .toLowerCase()
        .split(/\s*[/,]\s*/)
        .some((n) => n === net)
    );
  }

  if (filters.lounge === true) {
    cards = cards.filter((c) => c.lounge_access.has_lounge_access);
  }

  if (filters.points === true) {
    cards = cards.filter((c) => c.facets_boolean.earn_points_or_miles);
  }

  if (filters.rewardReturn === true || filters.cashback === true || filters.investback === true) {
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
      return typeof fee === "number" && fee <= max;
    });
  }

  if (filters.feeWaiverByInvestment === true) {
    cards = cards.filter((c) => getCardFeeWaiver(c)?.viaInvestimento === true);
    cards = [...cards].sort((a, b) => {
      const fa = a.facets_numeric_or_special.annual_fee_brl_best_estimate;
      const fb = b.facets_numeric_or_special.annual_fee_brl_best_estimate;
      const na = typeof fa === "number" ? fa : 999999;
      const nb = typeof fb === "number" ? fb : 999999;
      return na - nb;
    });
  }

  if (filters.search) {
    const tokens = tokenizeSearchText(filters.search);
    const scored = cards
      .map((card) => ({ card, score: getCardSearchScore(card, tokens) }))
      .filter(({ score }) => score > 0);
    const hasExact = scored.some(({ score }) => score >= 100);
    cards = scored
      .filter(({ score }) => !hasExact || score >= 100)
      .sort((a, b) => b.score - a.score)
      .map(({ card }) => card);
  }

  return cards;
}
