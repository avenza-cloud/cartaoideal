import type { MarketSegment } from "@/types/cards";
import type { LoungeAccess, RewardReturn } from "@/types/cards";

export function formatFee(
  fee: number | string | "variable_pricing_claim"
): string {
  if (fee === "unknown") return "Consulte";
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
