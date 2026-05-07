import type { CardFacet, FeeWaiverRule, FeeWaiverRuleCategory } from "@/types/cards";

export interface FeeWaiverBadge {
  key: FeeWaiverRuleCategory;
  label: string;
}

const BADGE_LABELS: Record<FeeWaiverRuleCategory, string> = {
  monthly_spend: "Isento por gasto",
  investment: "Isento por investimento",
  cashback: "Isento por cashback",
  miles: "Isento por milhas",
  general: "Sem anuidade",
};

export function feeWaiverBadgesFromRules(rules: FeeWaiverRule[] = []): FeeWaiverBadge[] {
  const order: FeeWaiverRuleCategory[] = [
    "monthly_spend",
    "investment",
    "cashback",
    "miles",
    "general",
  ];
  const categories = new Set(rules.map((rule) => rule.category));
  return order
    .filter((category) => categories.has(category))
    .map((category) => ({ key: category, label: BADGE_LABELS[category] }));
}

export function feeWaiverBadgesForCard(card: CardFacet): FeeWaiverBadge[] {
  return feeWaiverBadgesFromRules(card.fee_waiver_rules);
}
