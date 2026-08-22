import type { CardValueScore, LoungeAccess, MarketSegment, RewardReturn, TravelFrequency } from "@/types/cards";

export function formatFee(
  fee: number | string | "variable_pricing_claim" | null
): string {
  if (fee === null || fee === "unknown") return "Consulte";
  if (fee === "variable_pricing_claim") return "Variável";
  if (fee === 0) return "Grátis";
  if (typeof fee === "number")
    return `R$ ${fee.toLocaleString("pt-BR")}`;
  return "Consulte";
}

export function segmentLabel(segment: MarketSegment): string {
  const labels: Record<MarketSegment, string> = {
    mass_or_general: "Geral",
    upper_mass: "Intermediário",
    premium: "Premium",
    ultra_premium: "Ultra Premium",
  };
  return labels[segment];
}

export function confidenceLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 0.8) return { label: "Alta confiança", color: "text-green-400" };
  if (score >= 0.4) return { label: "Média confiança", color: "text-yellow-400" };
  return { label: "Baixa confiança", color: "text-red-400" };
}

export function networkColor(network: string): string {
  const map: Record<string, string> = {
    Visa: "text-blue-400",
    Mastercard: "text-orange-400",
    "American Express": "text-green-400",
    Elo: "text-yellow-400",
    Hipercard: "text-red-400",
  };
  return map[network] ?? "text-muted-foreground";
}

export function rewardReturnLabel(reward: RewardReturn): string {
  const subtypes = reward.subtypes ?? [];
  if (subtypes.includes("cashback") || subtypes.includes("investback")) return "Cashback";
  if (subtypes.includes("statement_credit")) return "Crédito na fatura";
  return reward.earning_summary === "unknown" ? "Sem retorno financeiro" : reward.earning_summary;
}

/** Perfil “viaja às vezes” ou “frequente”: mostramos faixa venda–utilização no valor líquido. */
export function travelFrequencyUsesUtilizationRange(tf: TravelFrequency): boolean {
  return tf === "occasional" || tf === "frequent";
}

function signedMoneyPerMonth(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}/mês`;
}

/** Retorno bruto/mês: faixa venda–utilização quando o perfil pondera viagens e há spread. */
export function formatGrossRewardMonthlyDisplay(
  score: CardValueScore,
  travelFrequency: TravelFrequency,
  minSpreadBrl = 1
): string {
  const low = score.grossRewardMonthlyBrl;
  const high = score.grossRewardMonthlyRangeHighBrl;
  const spread = Math.abs(high - low);
  if (!travelFrequencyUsesUtilizationRange(travelFrequency) || spread < minSpreadBrl) {
    return signedMoneyPerMonth(low);
  }
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  const fmt = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? "-" : ""}R$${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  return `${fmt(lo)} – ${fmt(hi)}/mês`;
}

/** Valor líquido/mês: faixa quando há spread venda–utilização e o perfil pondera viagens. */
export function formatNetMonthlyDisplay(
  score: CardValueScore,
  travelFrequency: TravelFrequency,
  minSpreadBrl = 1
): string {
  const low = score.netMonthlyValueBrl;
  const high = score.netMonthlyValueRangeHighBrl;
  const spread = Math.abs(high - low);
  if (!travelFrequencyUsesUtilizationRange(travelFrequency) || spread < minSpreadBrl) {
    return signedMoneyPerMonth(low);
  }
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  const fmt = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? "-" : ""}R$${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  return `${fmt(lo)} – ${fmt(hi)}/mês`;
}

export function loungeSummary(lounge: LoungeAccess): string {
  if (!lounge.has_lounge_access) return "Sem sala VIP";
  if (lounge.policy_varies_by_issuer) return "Lounge com política variável";
  const conditional = /(mediante|gasto|fatura|compras|invest|necessário|necessario|acima|partir)/i.test(
    lounge.summary ?? ""
  );
  if (typeof lounge.annual_visits === "number") {
    const suffix = conditional ? " cond." : "";
    return lounge.unlimited
      ? `${lounge.annual_visits} acesso${lounge.annual_visits === 1 ? "" : "s"} + GRU`
      : `${lounge.annual_visits} acesso${lounge.annual_visits === 1 ? "" : "s"}${suffix}`;
  }
  if (lounge.unlimited) return "Acessos ilimitados";
  return "Acesso a sala VIP";
}
