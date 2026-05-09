import type { CardFacet, FeeWaiverRule, FeeWaiverRuleCategory } from "@/types/cards";

export interface FeeWaiverBadge {
  key: FeeWaiverRuleCategory;
  label: string;
}

const BADGE_LABELS: Record<FeeWaiverRuleCategory, string> = {
  monthly_spend: "Isento por gasto",
  investment: "Isento por investimento",
  pix_key: "Isento por Pix",
  bank_relationship: "Isento por relacionamento",
  subscription: "Isento por assinatura",
  cashback: "Isento por cashback",
  miles: "Isento por milhas",
  promotional_period: "Promoção de anuidade",
  general: "Sem anuidade",
};

export function feeWaiverBadgesFromRules(rules: FeeWaiverRule[] = []): FeeWaiverBadge[] {
  const order: FeeWaiverRuleCategory[] = [
    "monthly_spend",
    "investment",
    "pix_key",
    "bank_relationship",
    "subscription",
    "cashback",
    "miles",
    "promotional_period",
    "general",
  ];
  const categories = new Set(rules.filter((rule) => rule.full_waiver).map((rule) => rule.category));
  return order
    .filter((category) => categories.has(category))
    .map((category) => ({ key: category, label: BADGE_LABELS[category] }));
}

export function feeWaiverBadgesForCard(card: CardFacet): FeeWaiverBadge[] {
  return feeWaiverBadgesFromRules(card.fee_waiver_rules);
}
