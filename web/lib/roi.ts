import { resolveAnnualFeeBase } from "@/lib/card-value";
import type { CardFacet } from "@/types/cards";

export type FeeTier = "free" | "optimal" | "good" | "consider" | "heavy" | "unknown";

/**
 * Anuidade nominal (base) e efetiva. A efetiva vem do score quando ele já
 * aplicou isenções (ex.: CAIXA Ícone); senão é a nominal. Anuidade
 * desconhecida (`null`, "unknown", preço variável sem valor no texto) fica
 * desconhecida mesmo que o score tenha calculado com R$0.
 */
function resolveFees(
  card: CardFacet,
  effectiveAnnualFeeBrl?: number | null
): { known: boolean; nominal: number; effective: number } {
  const base = resolveAnnualFeeBase(card);
  const effective =
    typeof effectiveAnnualFeeBrl === "number" && Number.isFinite(effectiveAnnualFeeBrl)
      ? effectiveAnnualFeeBrl
      : base.baseAnnualFeeBrl;
  return { known: base.known, nominal: base.baseAnnualFeeBrl, effective };
}

export function feeShareOfSpend(
  card: CardFacet,
  monthlySpend: number,
  effectiveAnnualFeeBrl?: number | null
): number | null {
  const fee = resolveFees(card, effectiveAnnualFeeBrl);
  if (!fee.known || monthlySpend <= 0) return null;
  if (fee.effective === 0) return 0;
  return fee.effective / (monthlySpend * 12);
}

export function feeTier(
  card: CardFacet,
  monthlySpend: number,
  effectiveAnnualFeeBrl?: number | null
): FeeTier {
  const fee = resolveFees(card, effectiveAnnualFeeBrl);
  if (!fee.known) return "unknown";
  if (fee.effective === 0) return "free";
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
  const fee = resolveFees(card, effectiveAnnualFeeBrl);
  const tier = feeTier(card, monthlySpend, effectiveAnnualFeeBrl);
  const brl = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (tier === "unknown") return "Anuidade não informada";
  if (tier === "free") {
    return fee.nominal > 0
      ? `Anuidade de ${brl(fee.nominal)}/ano isenta pela condição que você atende`
      : "Sem anuidade — todo retorno é ganho líquido";
  }

  const annualSpend = monthlySpend * 12;
  const sharePct = ((fee.effective / annualSpend) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const feeFormatted = brl(fee.effective);

  if (tier === "optimal") return `Anuidade = ${sharePct}% do seu gasto anual — muito acessível`;
  if (tier === "good")
    return `Anuidade ${feeFormatted}/ano (${sharePct}% do gasto anual) — acessível para seu perfil`;
  if (tier === "consider")
    return `Anuidade ${feeFormatted}/ano (${sharePct}% do gasto anual) — avalie se os benefícios compensam`;
  return `Anuidade ${feeFormatted}/ano (${sharePct}% do gasto anual) — elevada para seu volume de gastos`;
}

export const FEE_TIER_COLOR: Record<FeeTier, string> = {
  free: "text-positive",
  optimal: "text-positive",
  good: "text-foreground",
  consider: "text-foreground",
  heavy: "text-negative",
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
