import type { CardFacet, FeeWaiverRule, FeeWaiverRuleCategory, UserProfile } from "@/types/cards";

export type AnnualFeeHint = CardFacet["facets_numeric_or_special"]["annual_fee_brl_best_estimate"];

export interface FeeWaiverBadge {
  key: FeeWaiverRuleCategory;
  label: string;
  /** Cobrança de anuidade por padrão (isenção só ao cumprir meta) vs benefício de isenção */
  variant: "paid_fee_default" | "waiver_benefit";
}

const BADGE_LABELS: Record<FeeWaiverRuleCategory, string> = {
  monthly_spend: "Isento por gasto",
  investment: "Isento por investimento",
  subscription: "Isento por assinatura",
  cashback: "Isento por cashback",
  miles: "Isento por milhas",
  general: "Sem anuidade",
  pix_key: "Isento por chave Pix",
  promotional_period: "Promoção",
};

function hasPositiveAnnualFee(annualFeeBrl: AnnualFeeHint | undefined): annualFeeBrl is number {
  return typeof annualFeeBrl === "number" && annualFeeBrl > 0;
}

/**
 * Isenção por gasto com meta alta (ex.: C6 Black R$ 5k): a anuidade nominal existe e a isenção
 * integral exige fatura relevante — badge "Anuidade se paga" deixa claro que não é isenção trivial.
 * Metas baixas (ex.: RecargaPay R$ 1k) continuam como "Isento por gasto".
 */
const FULL_WAIVER_HIGH_MONTHLY_SPEND_BRL = 4000;

function minFullWaiverMonthlySpendThreshold(rules: FeeWaiverRule[]): number | undefined {
  const vals = rules
    .filter(
      (r) =>
        r.category === "monthly_spend" &&
        r.full_waiver === true &&
        typeof r.threshold_brl === "number"
    )
    .map((r) => r.threshold_brl!);
  return vals.length > 0 ? Math.min(...vals) : undefined;
}

function shouldShowPaidFeeDefaultForSpendWaiver(
  rules: FeeWaiverRule[],
  annualFeeBrl: AnnualFeeHint | undefined
): boolean {
  if (!hasPositiveAnnualFee(annualFeeBrl)) return false;
  const minSpend = minFullWaiverMonthlySpendThreshold(rules);
  return minSpend !== undefined && minSpend >= FULL_WAIVER_HIGH_MONTHLY_SPEND_BRL;
}

function profileQualifiesFullInvestmentWaiver(rules: FeeWaiverRule[], profile: UserProfile): boolean {
  const invested = profile.avgInvestedBrl ?? 0;
  return rules.some(
    (r) =>
      r.category === "investment" &&
      r.full_waiver === true &&
      typeof r.threshold_brl === "number" &&
      invested >= r.threshold_brl
  );
}

/** Quem já isenta por investimento não está "pagando anuidade com fatura" — omitimos a badge âmbar de gasto alto. */
function shouldOmitMonthlySpendBadgeForInvestmentWaiver(
  rules: FeeWaiverRule[],
  annualFeeBrl: AnnualFeeHint | undefined,
  profile: UserProfile | undefined
): boolean {
  if (!profile) return false;
  if (!profileQualifiesFullInvestmentWaiver(rules, profile)) return false;
  return shouldShowPaidFeeDefaultForSpendWaiver(rules, annualFeeBrl);
}

/**
 * Label for a single waiver rule in UI chips (chat, etc.).
 * When the card charges anuidade and isenção integral exige gasto mensal alto, "Isento por gasto"
 * soa como benefício garantido — usamos "Anuidade se paga" só nesse caso.
 */
export function feeWaiverRuleDisplayLabel(rule: FeeWaiverRule, annualFeeBrl?: AnnualFeeHint): string {
  if (
    rule.category === "monthly_spend" &&
    rule.full_waiver &&
    hasPositiveAnnualFee(annualFeeBrl) &&
    typeof rule.threshold_brl === "number" &&
    rule.threshold_brl >= FULL_WAIVER_HIGH_MONTHLY_SPEND_BRL
  ) {
    return "Anuidade se paga";
  }
  return BADGE_LABELS[rule.category] ?? "Sem anuidade";
}

export function feeWaiverBadgeClassName(variant: FeeWaiverBadge["variant"]): string {
  if (variant === "paid_fee_default") {
    return "rounded-md border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400";
  }
  return "rounded-md border border-emerald-500/25 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] font-medium text-emerald-500";
}

export function feeWaiverRuleBadgeVariant(
  rule: FeeWaiverRule,
  annualFeeBrl?: AnnualFeeHint
): FeeWaiverBadge["variant"] {
  if (
    rule.category === "monthly_spend" &&
    rule.full_waiver &&
    hasPositiveAnnualFee(annualFeeBrl) &&
    typeof rule.threshold_brl === "number" &&
    rule.threshold_brl >= FULL_WAIVER_HIGH_MONTHLY_SPEND_BRL
  ) {
    return "paid_fee_default";
  }
  return "waiver_benefit";
}

export function feeWaiverBadgesFromRules(
  rules: FeeWaiverRule[] = [],
  annualFeeBrl?: AnnualFeeHint,
  profile?: UserProfile
): FeeWaiverBadge[] {
  const order: FeeWaiverRuleCategory[] = [
    "investment",
    "monthly_spend",
    "subscription",
    "cashback",
    "miles",
  ];
  const categories = new Set(rules.filter((rule) => rule.full_waiver).map((rule) => rule.category));
  /** `general` costuma duplicar "sem anuidade" já mostrado no preço da linha; não exibimos chip. */
  return order
    .filter((category) => categories.has(category))
    .flatMap((category): FeeWaiverBadge[] => {
      if (
        category === "monthly_spend" &&
        shouldOmitMonthlySpendBadgeForInvestmentWaiver(rules, annualFeeBrl, profile)
      ) {
        return [];
      }
      if (category === "monthly_spend" && shouldShowPaidFeeDefaultForSpendWaiver(rules, annualFeeBrl)) {
        return [
          {
            key: "monthly_spend",
            label: "Anuidade se paga",
            variant: "paid_fee_default" as const,
          },
        ];
      }
      return [
        {
          key: category,
          label: BADGE_LABELS[category],
          variant: "waiver_benefit" as const,
        },
      ];
    });
}

export function feeWaiverBadgesForCard(card: CardFacet, profile?: UserProfile | null): FeeWaiverBadge[] {
  return feeWaiverBadgesFromRules(
    card.fee_waiver_rules,
    card.facets_numeric_or_special.annual_fee_brl_best_estimate,
    profile ?? undefined
  );
}
