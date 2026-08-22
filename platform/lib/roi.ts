import type { CardFacet } from "@/types/cards";

export type FeeTier = "free" | "optimal" | "good" | "consider" | "heavy" | "unknown";

/** Anuidade efetiva quando o score já aplicou isenções (ex.: CAIXA Ícone); senão a nominal. */
function resolveEffectiveFee(
  card: CardFacet,
  effectiveAnnualFeeBrl?: number | null
): CardFacet["facets_numeric_or_special"]["annual_fee_brl_best_estimate"] {
  return typeof effectiveAnnualFeeBrl === "number" && Number.isFinite(effectiveAnnualFeeBrl)
    ? effectiveAnnualFeeBrl
    : card.facets_numeric_or_special.annual_fee_brl_best_estimate;
}

export function feeShareOfSpend(
  card: CardFacet,
  monthlySpend: number,
  effectiveAnnualFeeBrl?: number | null
): number | null {
  const fee = resolveEffectiveFee(card, effectiveAnnualFeeBrl);
  if (typeof fee !== "number" || monthlySpend <= 0) return null;
  if (fee === 0) return 0;
  return fee / (monthlySpend * 12);
}

export function feeTier(
  card: CardFacet,
  monthlySpend: number,
  effectiveAnnualFeeBrl?: number | null
): FeeTier {
  const fee = resolveEffectiveFee(card, effectiveAnnualFeeBrl);
  if (fee === "unknown") return "unknown";
  if (typeof fee === "number" && fee === 0) return "free";
  const share = feeShareOfSpend(card, monthlySpend, effectiveAnnualFeeBrl);
  if (share === null) return "unknown";
  if (share < 0.01) return "optimal";
  if (share < 0.02) return "good";
  if (share < 0.04) return "consider";
  return "heavy";
}

export function feeNote(
  card: CardFacet,
  monthlySpend: number,
  effectiveAnnualFeeBrl?: number | null
): string {
  const fee = resolveEffectiveFee(card, effectiveAnnualFeeBrl);
  const tier = feeTier(card, monthlySpend, effectiveAnnualFeeBrl);

  if (tier === "free") return "Sem anuidade — todo retorno é ganho líquido";
  if (tier === "unknown") return "Anuidade não informada";

  const annualSpend = monthlySpend * 12;
  const feeNum = fee as number;
  const sharePct = ((feeNum / annualSpend) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const feeFormatted = feeNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (tier === "optimal") return `Anuidade = ${sharePct}% do seu gasto anual — muito acessível`;
  if (tier === "good")
    return `Anuidade ${feeFormatted}/ano (${sharePct}% do gasto anual) — acessível para seu perfil`;
  if (tier === "consider")
    return `Anuidade ${feeFormatted}/ano (${sharePct}% do gasto anual) — avalie se os benefícios compensam`;
  return `Anuidade ${feeFormatted}/ano (${sharePct}% do gasto anual) — elevada para seu volume de gastos`;
}

export const FEE_TIER_COLOR: Record<FeeTier, string> = {
  free: "text-green-400",
  optimal: "text-green-400",
  good: "text-blue-400",
  consider: "text-yellow-400",
  heavy: "text-red-400",
  unknown: "text-muted-foreground",
};

export const FEE_TIER_LABEL: Record<FeeTier, string> = {
  free: "Grátis",
  optimal: "Ótimo",
  good: "Bom",
  consider: "Avaliar",
  heavy: "Alto",
  unknown: "—",
};
