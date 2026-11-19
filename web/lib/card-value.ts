import { parseBrlNumber } from "@/lib/brl";
import {
  ANNUAL_TRIPS_BY_TRAVEL_FREQUENCY,
  COOPERATIVE_SPREAD,
  DEFAULT_SPREAD,
  DEFAULT_VALUE_ASSUMPTIONS,
  FALLBACK_LOUNGE_VISITS_PREMIUM,
  FALLBACK_LOUNGE_VISITS_STANDARD,
  MAX_FX_SPREAD,
  NOMAD_CARD_ID,
  NOMAD_TIERS,
  NON_TRAVELER_DEFAULT_POINT_SALE_VALUE_PER_THOUSAND_BRL,
  RETAIL_BANK_SPREAD,
  TRAVEL_REDEMPTION_WEIGHT,
  UNKNOWN_PROGRAM_POINT_TRAVEL_VALUE_PER_THOUSAND_BRL,
  UNSTRUCTURED_CASHBACK_FALLBACK_RATE,
} from "@/lib/assumptions";
import {
  GOL_SMILES_INFINITE_STABLE_IDS,
  SMILES_CLUB_ENTRY_MONTHLY_BRL,
} from "@/lib/card-overrides";
import {
  describeFeeWaiverCondition,
  evaluateFeeWaiver,
  feeWaiverRulesForCard,
} from "@/lib/fee-waiver";
import type {
  CardCharacteristic,
  CardFacet,
  CardScoreMode,
  CardValueAssumptions,
  CardValueComponent,
  CardValueScore,
  TravelFrequency,
  UserProfile,
} from "@/types/cards";

/**
 * Frequência de viagem do modelo de valor: sempre a declarada pelo perfil.
 * Preferências (pontos, sala VIP) não mudam o comportamento de viagem modelado.
 */
export function travelFrequencyForValueModeling(profile: UserProfile): TravelFrequency {
  return profile.travelFrequency ?? "none";
}

/** Peso do valor de utilização (viagem) no valor de decisão, pela frequência de viagem do perfil. */
export function travelRedemptionWeight(profile: UserProfile): number {
  return TRAVEL_REDEMPTION_WEIGHT[travelFrequencyForValueModeling(profile)];
}

/** Valor de decisão: venda + p × (utilização − venda). */
export function decisionMonthlyValue(low: number, high: number, profile: UserProfile): number {
  return low + travelRedemptionWeight(profile) * (Math.max(high, low) - low);
}

/**
 * Valor usado para ordenar o ranking. É sempre o valor de decisão, o mesmo
 * número mostrado no cartão, usado no veredito e na comparação.
 */
export function netMonthlyValueForRanking(score: CardValueScore, _profile?: UserProfile): number {
  return score.decisionMonthlyValueBrl;
}

/** Ordem canônica: elegíveis, depois anuidade conhecida, depois valor de decisão. */
export function compareCardValueScores(a: CardValueScore, b: CardValueScore): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.feeKnown !== b.feeKnown) return a.feeKnown ? -1 : 1;
  return b.decisionMonthlyValueBrl - a.decisionMonthlyValueBrl;
}

/**
 * Score 0–100 = percentil do valor de decisão entre os cartões elegíveis do
 * conjunto. Segue sempre a ordem do ranking; inelegíveis recebem 0.
 * Espera a lista já ordenada por `compareCardValueScores`.
 */
export function applyPercentileScores(sorted: CardValueScore[]): CardValueScore[] {
  const eligible = sorted.filter((s) => s.eligible);
  const n = eligible.length;
  return sorted.map((s) => {
    if (!s.eligible) return { ...s, score0To100: 0 };
    if (n <= 1) return { ...s, score0To100: 100 };
    // Empates recebem o mesmo percentil (o do primeiro com aquele valor).
    const firstIndex = eligible.findIndex(
      (e) => e.feeKnown === s.feeKnown && e.decisionMonthlyValueBrl === s.decisionMonthlyValueBrl
    );
    return { ...s, score0To100: Math.round(100 * (1 - firstIndex / (n - 1))) };
  });
}

export {
  DEFAULT_VALUE_ASSUMPTIONS,
  RETAIL_BANK_SPREAD,
  DEFAULT_SPREAD,
  COOPERATIVE_SPREAD,
  NON_TRAVELER_DEFAULT_POINT_SALE_VALUE_PER_THOUSAND_BRL,
  NOMAD_CARD_ID,
  NOMAD_TIERS,
} from "@/lib/assumptions";

export const DEFAULT_SCORING_PROFILE: UserProfile = {
  monthlySalaryBrl: 8000,
  avgMonthlySpendBrl: 3000,
  avgInvestedBrl: 0,
  monthlyInternationalSpendBrl: 0,
  travelFrequency: "occasional",
  spendingCategories: [],
  preferences: {
    wantsLounge: false,
    prefersCashback: false,
    prefersPoints: true,
    prefersInvestback: false,
  },
};

function isMembershipRewardsCard(card: CardFacet): boolean {
  return (card.characteristics ?? []).some(
    (x) => x.key === "loyalty_program" && /membership rewards/i.test(String(x.value))
  );
}

function hasLiveloOrEsferaProgram(card: CardFacet): boolean {
  return (card.characteristics ?? []).some(
    (x) => x.key === "loyalty_program" && /(livelo|esfera)/i.test(String(x.value))
  );
}

function hasDirectAirlineProgram(card: CardFacet): boolean {
  return (card.characteristics ?? []).some(
    (x) =>
      x.key === "loyalty_program" &&
      /(smiles|latam pass|azul fidelidade|tudoazul|aadvantage)/i.test(String(x.value))
  );
}

interface PointValuation {
  saleValuePerThousandBrl: number;
  travelValuePerThousandBrl: number;
  saleLabel: string;
  travelLabel: string;
  note: string;
}

function pointValuationForCard(
  card: CardFacet,
  profile: UserProfile,
  assumptions: CardValueAssumptions
): PointValuation {
  // Quem não viaja só vende pontos/milhas: teto de venda vale para todo programa.
  const nonTraveler = travelFrequencyForValueModeling(profile) === "none";
  const capSale = (value: number) =>
    nonTraveler ? Math.min(value, NON_TRAVELER_DEFAULT_POINT_SALE_VALUE_PER_THOUSAND_BRL) : value;
  const capNote = (raw: number, capped: number) =>
    capped < raw
      ? ` Venda limitada a R$${capped}/1k porque o perfil não viaja (sem utilização em viagem).`
      : "";

  if (isMembershipRewardsCard(card)) {
    const raw = assumptions.membershipRewardsPointSaleValuePerThousandBrl;
    const sale = capSale(raw);
    const travel = assumptions.membershipRewardsPointTravelValuePerThousandBrl;
    return {
      saleValuePerThousandBrl: sale,
      travelValuePerThousandBrl: travel,
      saleLabel: `Membership Rewards a R$${sale}/1k pts (venda)`,
      travelLabel: `Membership Rewards a R$${travel}/1k pts (utilização)`,
      note: `Membership Rewards: retorno realizável de venda em R$${sale} por 1.000 pontos; potencial de utilização em R$${travel} por 1.000 pontos.${capNote(raw, sale)}`,
    };
  }

  if (hasLiveloOrEsferaProgram(card)) {
    const raw = assumptions.liveloPointSaleValuePerThousandBrl;
    const sale = capSale(raw);
    const travel = assumptions.liveloPointTravelValuePerThousandBrl;
    return {
      saleValuePerThousandBrl: sale,
      travelValuePerThousandBrl: travel,
      saleLabel: `Livelo/Esfera a R$${sale}/1k pts (venda)`,
      travelLabel: `Livelo/Esfera a R$${travel}/1k pts (utilização)`,
      note: `Livelo/Esfera: retorno realizável de venda em R$${sale} por 1.000 pontos; potencial de utilização em R$${travel} por 1.000 pontos.${capNote(raw, sale)}`,
    };
  }

  if (hasDirectAirlineProgram(card)) {
    const raw = assumptions.mileValuePerThousandBrl;
    const sale = capSale(raw);
    const travel = Math.max(raw, assumptions.liveloPointTravelValuePerThousandBrl);
    return {
      saleValuePerThousandBrl: sale,
      travelValuePerThousandBrl: travel,
      saleLabel: `milhas a R$${sale}/1k (venda)`,
      travelLabel: `milhas a R$${travel}/1k (utilização)`,
      note: `Programa aéreo direto: retorno realizável em R$${sale} por 1.000 milhas; potencial de utilização em R$${travel} por 1.000 milhas.${capNote(raw, sale)}`,
    };
  }

  const raw = assumptions.defaultPointValuePerThousandBrl;
  const sale = capSale(raw);
  // Programa não identificado nunca vale mais em viagem que a Livelo.
  const travel = Math.max(
    sale,
    Math.min(
      UNKNOWN_PROGRAM_POINT_TRAVEL_VALUE_PER_THOUSAND_BRL,
      assumptions.liveloPointTravelValuePerThousandBrl
    )
  );
  return {
    saleValuePerThousandBrl: sale,
    travelValuePerThousandBrl: travel,
    saleLabel: `pontos a R$${sale}/1k pts (venda)`,
    travelLabel: `pontos a R$${travel}/1k pts (utilização)`,
    note: `Programa de pontos não identificado; usado retorno conservador de R$${sale} por 1.000 pontos e potencial de utilização de R$${travel} por 1.000 pontos (limitado ao da Livelo).${capNote(raw, sale)}`,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function characteristicsByKey(card: CardFacet, key: string): CardCharacteristic[] {
  return (card.characteristics ?? []).filter((item) => item.key === key);
}

function parsePercent(text: string): number | null {
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*%/);
  if (!match) return null;
  return Number(match[1].replace(",", ".")) / 100;
}

/** "até" como palavra (texto já normalizado): não casa com "categoria". */
const CEILING_WORD = /\bate\b/;

function parseBrlAmounts(text: string): number[] {
  return [...text.matchAll(/R\$\s*([\d.]+(?:,\d+)?)/gi)]
    .map((match) => Number(match[1].replace(/\./g, "").replace(",", ".")))
    .filter((value) => Number.isFinite(value));
}

function parsePointsRates(card: CardFacet): {
  domesticRate: number | null;
  internationalRate: number | null;
  domesticRatePerBrl: number | null;
  internationalRatePerBrl: number | null;
  fallbackRate: number | null;
  fallbackRatePerBrl: number | null;
  note?: string;
} {
  const candidates = [
    card.reward_return.earning_summary,
    ...characteristicsByKey(card, "earning_rate").map((item) => String(item.value)),
    ...characteristicsByKey(card, "earning_detail").map((item) => String(item.value)),
  ];

  const domestic: number[] = [];
  const international: number[] = [];
  const generic: number[] = [];
  const domesticPerBrl: number[] = [];
  const internationalPerBrl: number[] = [];
  const genericPerBrl: number[] = [];
  const ignoredGenericCeilings: string[] = [];
  const ceilingRates: number[] = [];

  for (const text of candidates) {
    const raw = String(text);
    const segments = raw
      .split(/;/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const segmentList = segments.length > 0 ? segments : [raw];

    for (const segment of segmentList) {
      const segNorm = normalizeText(segment);
      for (const match of segment.matchAll(
        /(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?|milhas?)(?:\s*(?:por|\/)\s*(?:d[oó]lar|usd)|\/usd)/gi
      )) {
        const rate = Number(match[1].replace(",", "."));
        if (!Number.isFinite(rate) || rate <= 0) continue;
        if (/exterior|internacion/.test(segNorm)) {
          international.push(rate);
        } else if (/brasil|nacion/.test(segNorm)) {
          domestic.push(rate);
        } else if (CEILING_WORD.test(segNorm)) {
          ceilingRates.push(rate);
          ignoredGenericCeilings.push(segment);
        } else {
          generic.push(rate);
        }
      }

      for (const match of segment.matchAll(
        /(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?|milhas?)(?:\s*(?:por|\/)\s*(?:real|r\$)|\/r\$)/gi
      )) {
        const rate = Number(match[1].replace(",", "."));
        if (!Number.isFinite(rate) || rate <= 0) continue;
        if (/exterior|internacion/.test(segNorm)) {
          internationalPerBrl.push(rate);
        } else if (/brasil|nacion/.test(segNorm)) {
          domesticPerBrl.push(rate);
        } else {
          genericPerBrl.push(rate);
        }
      }
    }
  }

  const maxOrNull = (values: number[]) => (values.length > 0 ? Math.max(...values) : null);

  // When only ceiling ("até X pts/USD") rates are found, use the max as a conservative
  // fallback rather than zeroing out the return entirely.
  const noStructuredRates =
    domestic.length === 0 && international.length === 0 && generic.length === 0;
  if (noStructuredRates && ceilingRates.length > 0) {
    generic.push(Math.max(...ceilingRates));
    ignoredGenericCeilings.length = 0;
  }

  const fallbackRate = maxOrNull(generic);
  const fallbackRatePerBrl = maxOrNull(genericPerBrl);
  const note =
    ignoredGenericCeilings.length > 0 && domestic.length === 0 && international.length === 0
      ? "Pontuação informada apenas como teto ('até X pontos/USD'); retorno em pontos não aplicado sem regra efetiva estruturada."
      : noStructuredRates && ceilingRates.length > 0
        ? "Taxa de pontos informada como teto máximo; retorno calculado com taxa máxima declarada de forma conservadora."
        : undefined;
  return {
    domesticRate: maxOrNull(domestic) ?? fallbackRate,
    internationalRate: maxOrNull(international) ?? fallbackRate,
    domesticRatePerBrl: maxOrNull(domesticPerBrl) ?? fallbackRatePerBrl,
    internationalRatePerBrl: maxOrNull(internationalPerBrl) ?? fallbackRatePerBrl,
    fallbackRate,
    fallbackRatePerBrl,
    note,
  };
}

function cashlikeTextCandidates(card: CardFacet): string[] {
  return [
    card.reward_return.earning_summary,
    ...characteristicsByKey(card, "earning_rate").map(
      (item) => `${item.value} ${item.details ?? ""}`
    ),
    ...characteristicsByKey(card, "earning_detail").map(
      (item) => `${item.value} ${item.details ?? ""}`
    ),
  ].flatMap((text) => String(text).split(/[.;|]/));
}

function parseCashlikeRates(card: CardFacet): {
  generalRate: number;
  domesticRate: number | null;
  internationalRate: number | null;
  ignoredCategorySpecific: string[];
  note?: string;
} {
  const rewardConditionText = normalizeText(
    characteristicsByKey(card, "reward_condition")
      .map((item) => `${item.value} ${item.details ?? ""}`)
      .join(" ")
  );
  if (/meli\+|assinatura meli|assinante meli/.test(rewardConditionText)) {
    return {
      generalRate: 0,
      domesticRate: null,
      internationalRate: null,
      ignoredCategorySpecific: [],
      note: "Cashback exige assinatura Meli+; retorno não aplicado ao score sem esse dado no perfil.",
    };
  }

  const rates = {
    general: [] as number[],
    domestic: [] as number[],
    international: [] as number[],
  };
  const ignoredCategorySpecific: string[] = [];

  const partnerOnlyCashlike =
    /(magalu|magazine luiza|amazon|mercado livre|extra|pao de acucar|pão de açúcar|nu viagens|passagens?|hoteis|hot[eé]is|hotel|companhia aerea|vivo|em apps|em aplicativos|pacote de prefer[eê]ncias|pacote escolhido|categoria escolhida|digio\s*loja|shopping\s+\w+)/;

  for (const raw of cashlikeTextCandidates(card)) {
    const text = normalizeText(raw);
    if (!/(cashback|investback|credito na fatura|dinheiro de volta)/.test(text)) continue;

    const rate = parsePercent(text);
    if (rate === null || rate <= 0 || rate > 0.08) {
      if (/(digio\s*loja|shopping\s+\w+)/.test(text)) {
        ignoredCategorySpecific.push(String(raw).trim());
      }
      continue;
    }

    const categorySpecific = partnerOnlyCashlike.test(text);
    if (categorySpecific) {
      ignoredCategorySpecific.push(String(raw).trim());
      continue;
    }

    if (/exterior|internacion/.test(text)) {
      rates.international.push(rate);
      continue;
    }
    if (/brasil|nacion/.test(text)) {
      rates.domestic.push(rate);
      continue;
    }
    if (/por dolar|\/usd/.test(text) && CEILING_WORD.test(text) && rate >= 0.03) {
      ignoredCategorySpecific.push(String(raw).trim());
      continue;
    }
    rates.general.push(rate);
  }

  const maxOrNull = (values: number[]) => (values.length > 0 ? Math.max(...values) : null);
  const generalRate = maxOrNull(rates.general) ?? 0;
  const domesticRate = maxOrNull(rates.domestic);
  const internationalRate = maxOrNull(rates.international);

  if (generalRate > 0 || domesticRate !== null || internationalRate !== null) {
    return {
      generalRate,
      domesticRate,
      internationalRate,
      ignoredCategorySpecific,
      note:
        ignoredCategorySpecific.length > 0
          ? "Bônus/cashback específico de categoria não aplicado ao gasto geral."
          : undefined,
    };
  }

  if (card.reward_return.has_cashlike_return) {
    if (ignoredCategorySpecific.length > 0) {
      return {
        generalRate: 0,
        domesticRate: null,
        internationalRate: null,
        ignoredCategorySpecific,
        note: "Cashback identificado apenas como bônus/categoria específica; não aplicado ao gasto geral.",
      };
    }
    return {
      generalRate: UNSTRUCTURED_CASHBACK_FALLBACK_RATE,
      domesticRate: null,
      internationalRate: null,
      ignoredCategorySpecific,
      note: `Taxa exata de cashback não estruturada; usado retorno conservador de ${(UNSTRUCTURED_CASHBACK_FALLBACK_RATE * 100).toLocaleString("pt-BR")}%.`,
    };
  }
  return { generalRate: 0, domesticRate: null, internationalRate: null, ignoredCategorySpecific };
}

function formatBrl(value: number): string {
  return `R$${value.toLocaleString("pt-BR")}`;
}

// Returns tiered cashback rates keyed by minimum monthly spend.
// If a card has spend-threshold cashback (e.g. 0.5% for R$1500–R$2999,
// 1% for R$3000+), returns those tiers sorted ascending by minSpend.
// Returns [] when no spend thresholds are found (use parseCashlikeRates instead).
function parseSpendTieredRates(card: CardFacet): Array<{
  rate: number;
  minSpend: number;
  maxSpend: number;
}> {
  const tiers: Array<{ rate: number; minSpend: number; maxSpend: number }> = [];

  for (const item of characteristicsByKey(card, "earning_detail")) {
    const details = normalizeText(String(item.details ?? ""));
    const rate = parsePercent(normalizeText(String(item.value)));
    if (rate === null || rate <= 0 || rate > 0.2) continue;

    // "de r$ 1.500 a r$ 2.999,99" or "entre r$ 1.500 e r$ 2.999"
    const rangeMatch = details.match(/(?:de|entre)\s+r\$\s*([\d.,]+)\s+(?:a|e)\s+r\$\s*([\d.,]+)/);
    if (rangeMatch) {
      const minSpend = parseBrlNumber(rangeMatch[1]);
      const maxSpend = parseBrlNumber(rangeMatch[2]);
      if (minSpend !== null && maxSpend !== null) {
        tiers.push({ rate, minSpend, maxSpend });
        continue;
      }
    }

    // "acima de r$ 3.000" or "a partir de r$ 3.000"
    const aboveMatch = details.match(/(?:acima|partir)\s+de\s+r\$\s*([\d.,]+)/);
    if (aboveMatch) {
      const minSpend = parseBrlNumber(aboveMatch[1]);
      if (minSpend !== null) {
        tiers.push({ rate, minSpend, maxSpend: Infinity });
      }
    }
  }

  // Fallback: inline spend tiers in earning_summary (e.g. BV Único, BV Mais, PagBank)
  if (tiers.length === 0) {
    const summaryNorm = normalizeText(String(card.reward_return.earning_summary ?? ""));
    const parseCompactSpend = (numStr: string, suffix?: string): number | null => {
      const base = parseBrlNumber(numStr);
      if (base === null) return null;
      if (suffix === "k" || suffix === "mil") return base * 1000;
      return base;
    };

    // "0,3% até r$ 3k" or "0,5% de cashback para faturas de até r$ 2.999,99"
    for (const m of summaryNorm.matchAll(
      /(\d+(?:[,.]\d+)?)\s*%(?:\s*de\s*cashback)?(?:\s*para\s*faturas?\s*(?:de)?)?\s*at[eé]\s*r\$\s*([\d.,]+)\s*(k|mil)?/g
    )) {
      const rate = Number(m[1].replace(",", ".")) / 100;
      const maxSpend = parseCompactSpend(m[2], m[3]);
      if (rate > 0 && rate <= 0.2 && maxSpend !== null) {
        tiers.push({ rate, minSpend: 0, maxSpend });
      }
    }

    // "0,5% de r$ 3k a 6k" or "0,8% de r$ 6k a 10k"
    for (const m of summaryNorm.matchAll(
      /(\d+(?:[,.]\d+)?)\s*%\s*(?:de|entre)\s*r\$\s*([\d.,]+)\s*(k|mil)?\s*(?:a|e)\s*(?:r\$\s*)?([\d.,]+)\s*(k|mil)?/g
    )) {
      const rate = Number(m[1].replace(",", ".")) / 100;
      const minSpend = parseCompactSpend(m[2], m[3]);
      const maxSpend = parseCompactSpend(m[4], m[5] ?? m[3]);
      if (rate > 0 && rate <= 0.2 && minSpend !== null && maxSpend !== null) {
        tiers.push({ rate, minSpend, maxSpend });
      }
    }

    // "1,5% acima de r$ 10k" or "1% de cashback para faturas a partir de r$ 3.000"
    for (const m of summaryNorm.matchAll(
      /(\d+(?:[,.]\d+)?)\s*%(?:\s*de\s*cashback)?(?:\s*para\s*faturas?)?\s*(?:acima|a\s*partir)\s*de\s*r\$\s*([\d.,]+)\s*(k|mil)?/g
    )) {
      const rate = Number(m[1].replace(",", ".")) / 100;
      const minSpend = parseCompactSpend(m[2], m[3]);
      if (rate > 0 && rate <= 0.2 && minSpend !== null) {
        tiers.push({ rate, minSpend, maxSpend: Infinity });
      }
    }
  }

  return tiers.sort((a, b) => a.minSpend - b.minSpend);
}

function effectiveCashlikeRate(card: CardFacet, totalMonthlySpendBrl: number): number {
  const tiers = parseSpendTieredRates(card);
  if (tiers.length > 0) {
    // Find the highest tier whose minSpend the user meets
    const applicable = [...tiers]
      .reverse()
      .find((t) => totalMonthlySpendBrl >= t.minSpend && totalMonthlySpendBrl <= t.maxSpend);
    return applicable?.rate ?? 0;
  }
  return parseCashlikeRates(card).generalRate;
}

function getMinimumInvestment(card: CardFacet): number | "unknown" {
  const facet = card.facets_numeric_or_special.minimum_investment_brl_best_estimate;
  if (typeof facet === "number") return facet;
  return card.eligibility?.minimum_investment_brl_best_estimate ?? "unknown";
}

function getMinimumIncome(card: CardFacet): number | "unknown" {
  const facet = card.facets_numeric_or_special.minimum_income_brl_best_estimate;
  if (typeof facet === "number") return facet;
  return card.eligibility?.minimum_income_brl_best_estimate ?? "unknown";
}

function evaluateEligibility(
  card: CardFacet,
  profile: UserProfile
): { eligible: boolean; reasons: string[]; notes: string[] } {
  const reasons: string[] = [];
  const notes: string[] = [];
  const minInvestment = getMinimumInvestment(card);
  const minIncome = getMinimumIncome(card);
  const availability = card.eligibility?.availability_status ?? "unknown";

  if (typeof minInvestment === "number" && profile.avgInvestedBrl < minInvestment) {
    reasons.push(`Exige investimento mínimo de ${formatBrl(minInvestment)}.`);
  }

  if (typeof minIncome === "number" && profile.monthlySalaryBrl < minIncome) {
    reasons.push(`Exige renda mensal mínima de ${formatBrl(minIncome)}.`);
  }

  if (availability === "unavailable") {
    reasons.push("Produto marcado como indisponível/descontinuado.");
  } else if (availability === "invite_only") {
    notes.push(
      "Produto disponível apenas por convite; sugerido como referência, não como elegibilidade garantida."
    );
  } else if (availability === "private_or_segment_restricted") {
    const hasStructuredGate = typeof minInvestment === "number" || typeof minIncome === "number";
    const meetsStructuredGate =
      (typeof minInvestment !== "number" || profile.avgInvestedBrl >= minInvestment) &&
      (typeof minIncome !== "number" || profile.monthlySalaryBrl >= minIncome);
    if (!hasStructuredGate || !meetsStructuredGate) {
      reasons.push("Produto marcado como restrito a segmento/private banking.");
    } else {
      notes.push(
        "Produto restrito a segmento/private banking; elegibilidade final pode depender de convite/análise do emissor."
      );
    }
  }

  const blocksOnUnknown =
    card.eligibility?.recommendation_blocking_unknowns === true &&
    minInvestment === "unknown" &&
    minIncome === "unknown";
  if (blocksOnUnknown) {
    if (availability === "invite_only" || availability === "private_or_segment_restricted") {
      notes.push(
        "Elegibilidade crítica não estruturada; mantenha como sugestão restrita para análise manual."
      );
    } else {
      reasons.push("Elegibilidade crítica não estruturada; removido de recomendações automáticas.");
    }
  }

  if (card.eligibility?.requires_bank_account_claim === true) {
    notes.push("Exige conta/correntista no emissor; o perfil atual não coleta esse dado.");
  }

  return { eligible: reasons.length === 0, reasons, notes };
}

function parseConditionalAmount(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(normalizeText(text));
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/\./g, "").replace(",", "."));
  const suffix = match[2] ?? "";
  const multiplier = /milh/.test(suffix) ? 1_000_000 : /mil/.test(suffix) ? 1_000 : 1;
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function parseSpendThreshold(text: string): number | null {
  const value = parseConditionalAmount(
    text,
    /(?:gasto|fatura|compras|despesas)[^\d]*(?:mensal|mes|m[eê]s)?[^\d]*(\d[\d.]*,\d{2}|\d[\d.]*)(?:\s*(milhoes|milhao|mil))?/
  );
  return value === null ? null : value;
}

function parseInvestmentThreshold(text: string): number | null {
  return parseConditionalAmount(
    text,
    /(?:invest|patrimonio|aplicac)[^\d]*(\d[\d.]*,\d{2}|\d[\d.]*)(?:\s*(milhoes|milhao|mil))?/
  );
}

function parseAmountBeforeKeyword(text: string, keywordPattern: string): number | null {
  const normalized = normalizeText(text);
  const match = new RegExp(
    `r\\$\\s*(\\d[\\d.]*,\\d{2}|\\d[\\d.]*)(?:\\s*(milhoes|milhao|mil))?[^.;|]{0,80}${keywordPattern}`
  ).exec(normalized);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/\./g, "").replace(",", "."));
  const suffix = match[2] ?? "";
  const multiplier = /milh/.test(suffix) ? 1_000_000 : /mil/.test(suffix) ? 1_000 : 1;
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function parseSpendThresholdAnyOrder(text: string): number | null {
  return (
    parseAmountBeforeKeyword(text, "(?:gasto|fatura|compras|despesas)") ?? parseSpendThreshold(text)
  );
}

function parseInvestmentThresholdAnyOrder(text: string): number | null {
  return (
    parseAmountBeforeKeyword(text, "(?:invest|patrimonio|aplicac)") ??
    parseInvestmentThreshold(text)
  );
}

// ─── Anuidade ──────────────────────────────────────────────────────────────

export interface AnnualFeeBase {
  /** Anuidade nominal anual usada como base do cálculo (0 quando desconhecida). */
  baseAnnualFeeBrl: number;
  /** Verdadeiro quando há valor numérico ou um valor lido com segurança do texto da anuidade. */
  known: boolean;
  note?: string;
}

function annualFeeTexts(card: CardFacet): string[] {
  return [
    ...characteristicsByKey(card, "annual_fee"),
    ...characteristicsByKey(card, "annual_fee_detail"),
  ].map((item) => `${item.value} ${item.details ?? ""}`);
}

/** Lê "R$ 1.155/ano" ou "12x de R$ 96,25" do texto da anuidade. Mensal sem anual vira ×12. */
function annualFeeFromText(card: CardFacet): number | null {
  const texts = annualFeeTexts(card);
  const amounts = texts.flatMap((text) => parseBrlAmounts(text)).filter((n) => n > 0);
  if (amounts.length === 0) return null;
  const joined = normalizeText(texts.join(" "));
  const monthlyOnly = /\/\s*mes|por mes|mensal/.test(joined) && !/ano|anual|\d+x/.test(joined);
  const max = Math.max(...amounts);
  return monthlyOnly ? max * 12 : max;
}

/**
 * Anuidade base do cartão e se ela é conhecida. `null`, "unknown" e
 * "variable_pricing_claim" só viram anuidade conhecida quando o texto da
 * anuidade traz o valor; senão `known` é falso e o cartão nunca é "grátis".
 */
export function resolveAnnualFeeBase(card: CardFacet): AnnualFeeBase {
  const raw = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  if (typeof raw === "number" && raw > 0) return { baseAnnualFeeBrl: raw, known: true };

  const fromText = annualFeeFromText(card);
  if (typeof raw === "number") {
    // Facet R$0 com isenção por gasto: a anuidade cobrada está no texto.
    const hasSpendWaiver = feeWaiverRulesForCard(card).some(
      (rule) => rule.category === "monthly_spend" && typeof rule.threshold_brl === "number"
    );
    if (hasSpendWaiver && fromText !== null) {
      return {
        baseAnnualFeeBrl: fromText,
        known: true,
        note: "Anuidade base inferida dos campos textuais (facet numérico inconsistente com regra de isenção por gasto).",
      };
    }
    return { baseAnnualFeeBrl: 0, known: true };
  }

  if (fromText !== null) {
    return {
      baseAnnualFeeBrl: fromText,
      known: true,
      note: `Anuidade não estruturada; usado o valor do texto da anuidade (${formatBrl(roundMoney(fromText))}/ano).`,
    };
  }
  const monthlyHint = card.facets_numeric_or_special.monthly_fee_brl_after_intro_official_hint;
  if (typeof monthlyHint === "number" && monthlyHint > 0) {
    return {
      baseAnnualFeeBrl: monthlyHint * 12,
      known: true,
      note: `Anuidade não estruturada; usada a mensalidade oficial (${formatBrl(monthlyHint)} × 12).`,
    };
  }
  return {
    baseAnnualFeeBrl: 0,
    known: false,
    note: "Anuidade não informada: o cálculo usa R$0, o cartão não é tratado como gratuito e fica abaixo dos cartões com anuidade conhecida.",
  };
}

/** Clube Smiles plano entrada — custo além da anuidade do cartão para modelar 5,5 milhas/USD no gasto geral (Diamante). Ids e valor em data/card_overrides.json. */
const GOL_SMILES_CLUB_ENTRY_MONTHLY_BRL = SMILES_CLUB_ENTRY_MONTHLY_BRL;

function bundledSmilesClubAnnualAddonBrl(card: CardFacet): number {
  if (!GOL_SMILES_INFINITE_STABLE_IDS.has(card.card_stable_id)) return 0;
  return GOL_SMILES_CLUB_ENTRY_MONTHLY_BRL * 12;
}

function uniqueConditions(rules: Parameters<typeof describeFeeWaiverCondition>[0][]): string {
  return [...new Set(rules.map(describeFeeWaiverCondition))].join(" ou ");
}

function computeEffectiveAnnualFee(
  card: CardFacet,
  profile: UserProfile
): { annualFee: number; feeKnown: boolean; reason: string; notes: string[] } {
  const base = resolveAnnualFeeBase(card);
  const notes: string[] = base.note ? [base.note] : [];
  if (!base.known) {
    return {
      annualFee: 0,
      feeKnown: false,
      reason: "Anuidade não informada pelo emissor; não tratada como gratuita.",
      notes,
    };
  }
  if (base.baseAnnualFeeBrl <= 0) {
    return { annualFee: 0, feeKnown: true, reason: "Sem anuidade.", notes };
  }

  let nominalFee = base.baseAnnualFeeBrl;
  const conditionalAnnualFee = characteristicsByKey(card, "annual_fee_condition")
    .map((item) => `${item.value} ${item.details ?? ""}`)
    .find((text) => /correntista/i.test(text));
  if (conditionalAnnualFee && card.eligibility?.requires_bank_account_claim === true) {
    const accountHolderFee = Math.min(...parseBrlAmounts(conditionalAnnualFee));
    if (
      Number.isFinite(accountHolderFee) &&
      accountHolderFee > 0 &&
      accountHolderFee < nominalFee
    ) {
      nominalFee = accountHolderFee;
      notes.push("Anuidade de correntista aplicada por condição estruturada.");
    }
  }

  // Mesma avaliação usada pelas badges e pelo chat (lib/fee-waiver.ts).
  const rules = feeWaiverRulesForCard(card);
  const waiver = evaluateFeeWaiver(rules, nominalFee, profile);
  let effectiveFee = waiver.effectiveAnnualFee;
  if (waiver.appliedRules.length > 0) {
    const conditions = waiver.appliedRules.map(describeFeeWaiverCondition).join(" e ");
    notes.push(
      effectiveFee === 0
        ? `Isenção de anuidade aplicada: o perfil atende ${conditions}.`
        : `Desconto de anuidade aplicado: o perfil atende ${conditions}.`
    );
  } else if (waiver.unmetRules.length > 0) {
    const grouped = waiver.unmetRules.some((rule) => (rule.min_conditions ?? 1) > 1);
    notes.push(
      grouped
        ? `Isenção exige cumprir ${Math.max(...rules.map((r) => r.min_conditions ?? 1))} critérios (${uniqueConditions(rules.filter((r) => (r.min_conditions ?? 1) > 1))}); o perfil não atende, anuidade cheia aplicada.`
        : `Isenção/desconto exige ${uniqueConditions(waiver.unmetRules)}; o perfil não atende, anuidade cheia aplicada.`
    );
  } else if (waiver.notEvaluableRules.length > 0 || waiver.unknownEffectRules.length > 0) {
    notes.push(
      "Há condição de isenção que o perfil não permite avaliar (assinatura, chave Pix, limite ou desconto sem valor); anuidade cheia aplicada."
    );
  }

  const feeBeforeSmilesClub = effectiveFee;
  const smilesClubAnnual = bundledSmilesClubAnnualAddonBrl(card);
  if (smilesClubAnnual > 0) {
    effectiveFee += smilesClubAnnual;
    notes.push(
      `Clube Smiles: somado ao cartão o plano mínimo (~R$${GOL_SMILES_CLUB_ENTRY_MONTHLY_BRL.toFixed(2).replace(".", ",")}/mês × 12) para modelar 5,5 milhas/USD no dia a dia; planos maiores chegam a ~R$819/mês.`
    );
  }

  const reason =
    smilesClubAnnual > 0
      ? `Custo anual modelado R$${roundMoney(effectiveFee).toLocaleString("pt-BR")} (cartão R$${roundMoney(feeBeforeSmilesClub).toLocaleString("pt-BR")} + Clube Smiles R$${roundMoney(smilesClubAnnual).toLocaleString("pt-BR")}).`
      : effectiveFee === 0
        ? `Anuidade de R$${roundMoney(base.baseAnnualFeeBrl).toLocaleString("pt-BR")} isenta pela condição que o perfil atende.`
        : effectiveFee < base.baseAnnualFeeBrl
          ? `Anuidade efetiva de R$${roundMoney(effectiveFee).toLocaleString("pt-BR")} após regra estruturada.`
          : "Sem regra de isenção atendida por este perfil; anuidade cheia aplicada.";

  return { annualFee: effectiveFee, feeKnown: true, reason, notes };
}

// ─── Câmbio ────────────────────────────────────────────────────────────────

function issuerSpreadFallback(card: CardFacet): number {
  const issuer = normalizeText(card.issuer_raw);
  if (/(sicredi|sicoob|unicred|uniprime|sisprime|cresol)/.test(issuer)) {
    return COOPERATIVE_SPREAD;
  }
  if (/(bradesco|itau|santander|banco do brasil|caixa)/.test(issuer)) {
    return RETAIL_BANK_SPREAD;
  }
  return DEFAULT_SPREAD;
}

/** Textos que falam de câmbio: a nota de IOF/câmbio e a característica `forex_spread`. */
function forexTexts(card: CardFacet): string[] {
  return [
    card.facets_numeric_or_special.official_forex_or_iof_note,
    ...characteristicsByKey(card, "forex_spread").map(
      (item) => `${item.label} ${item.value} ${item.details ?? ""}`
    ),
  ].filter((text) => text.trim() !== "" && text.trim() !== "unknown");
}

// A palavra spread/ágio colada ao percentual: "spread internacional 0%", "0% de spread".
const EXPLICIT_SPREAD_PATTERNS = [
  /(?:spread|[aá]gio)\b[^\d%.;|]{0,30}?(\d+(?:[,.]\d+)?)\s*%/i,
  /(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s+)?(?:spread|[aá]gio)\b/i,
];

/**
 * Spread cambial do cartão, em fração (0,04 = 4%), sempre em [0, MAX_FX_SPREAD].
 * Ordem: `fx_spread_pct` nos dados → frase explícita de spread → fallback do emissor.
 */
export function fxSpreadForCard(card: CardFacet): {
  spread: number;
  source: "facet" | "text" | "issuer_fallback";
  note?: string;
} {
  const facet = card.facets_numeric_or_special.fx_spread_pct;
  if (typeof facet === "number" && Number.isFinite(facet)) {
    return { spread: clamp(facet / 100, 0, MAX_FX_SPREAD), source: "facet" };
  }
  for (const text of forexTexts(card)) {
    for (const pattern of EXPLICIT_SPREAD_PATTERNS) {
      const match = pattern.exec(text);
      if (!match) continue;
      const value = Number(match[1].replace(",", ".")) / 100;
      if (Number.isFinite(value) && value >= 0 && value <= MAX_FX_SPREAD) {
        return { spread: value, source: "text" };
      }
    }
  }
  return {
    spread: issuerSpreadFallback(card),
    source: "issuer_fallback",
    note: "Spread cambial não informado; usado valor típico do tipo de emissor.",
  };
}

function effectiveIofRate(card: CardFacet, assumptions: CardValueAssumptions): number {
  const text = normalizeText(forexTexts(card).join(" "));
  if (/iof\s*zero|zero\s*(?:de\s*)?iof|\b0\s*%\s*(?:de\s*)?iof|sem\s+iof/.test(text)) return 0;
  return assumptions.iof;
}

// ─── Benefícios de viagem ──────────────────────────────────────────────────

/** Viagens/ano pela frequência declarada; "não viajo" = 0. */
function estimateAnnualTravelDemand(profile: UserProfile): number {
  return ANNUAL_TRIPS_BY_TRAVEL_FREQUENCY[travelFrequencyForValueModeling(profile)];
}

function fallbackAnnualLoungeCap(card: CardFacet): { visits: number; note: string } {
  const variant = normalizeText(card.variant_band);
  const segment = card.market_segment_guess;
  const visits =
    /black|infinite|centurion/.test(variant) || segment === "ultra_premium" || segment === "premium"
      ? FALLBACK_LOUNGE_VISITS_PREMIUM
      : FALLBACK_LOUNGE_VISITS_STANDARD;
  return {
    visits,
    note: `Acessos VIP sem limite anual estruturado; usado fallback conservador de ${visits} acesso${visits === 1 ? "" : "s"}/ano para ${card.variant_band}.`,
  };
}

function estimateAnnualLoungeVisits(
  profile: UserProfile,
  card: CardFacet
): { visits: number; note?: string } {
  if (!card.lounge_access.has_lounge_access) return { visits: 0 };

  const demand = estimateAnnualTravelDemand(profile);
  if (demand <= 0) return { visits: 0 };
  if (typeof card.lounge_access.annual_visits === "number") {
    return { visits: Math.min(demand, card.lounge_access.annual_visits) };
  }

  if (card.lounge_access.unlimited) {
    const programsNorm = normalizeText((card.lounge_access.programs ?? []).join(" "));
    const hasGlobalNetwork =
      /(loungekey|priority pass|visa airport companion|dragon\s*pass|mastercard airport|centurion|brb vip)/.test(
        programsNorm
      );
    const isTopBand = /black|infinite|centurion|nanquim/.test(normalizeText(card.variant_band));
    if (!hasGlobalNetwork && !isTopBand) {
      return {
        visits: Math.min(demand, FALLBACK_LOUNGE_VISITS_STANDARD),
        note: "Sala VIP própria de companhia aérea em variante não-Black/Infinite; limitado a 2 usos/ano.",
      };
    }
    return { visits: demand };
  }

  const fallback = fallbackAnnualLoungeCap(card);
  return {
    visits: Math.min(demand, fallback.visits),
    note: fallback.note,
  };
}

function travelBenefitDemandFactor(profile: UserProfile): number {
  return estimateAnnualTravelDemand(profile) / ANNUAL_TRIPS_BY_TRAVEL_FREQUENCY.frequent;
}

function loungeConditionText(card: CardFacet): string {
  return [
    card.lounge_access.summary,
    ...characteristicsByKey(card, "lounge_visits").map(
      (item) => `${item.value} ${item.details ?? ""}`
    ),
  ].join(" ");
}

function hasLoungeGate(card: CardFacet, profile: UserProfile): { allowed: boolean; note?: string } {
  if (!card.lounge_access.has_lounge_access) return { allowed: false };

  const la = card.lounge_access;
  const spendThreshold =
    la.condition_monthly_spend_brl ?? parseSpendThresholdAnyOrder(loungeConditionText(card));
  const investmentThreshold =
    la.condition_investment_brl ?? parseInvestmentThresholdAnyOrder(loungeConditionText(card));
  const isOr = la.condition_logic === "or";
  const hasGate = spendThreshold !== null || investmentThreshold !== null;
  if (!hasGate) return { allowed: true };

  const passesSpend = spendThreshold === null || profile.avgMonthlySpendBrl >= spendThreshold;
  const passesInvestment =
    investmentThreshold === null || profile.avgInvestedBrl >= investmentThreshold;

  const passes = isOr ? passesSpend || passesInvestment : passesSpend && passesInvestment;
  if (passes) return { allowed: true };

  if (isOr) {
    return {
      allowed: false,
      note: `Benefício de sala VIP não valorizado porque exige ${spendThreshold !== null ? `gasto mensal de ${formatBrl(spendThreshold)}` : ""}${spendThreshold !== null && investmentThreshold !== null ? " ou " : ""}${investmentThreshold !== null ? `investimento de ${formatBrl(investmentThreshold)}` : ""}.`,
    };
  }

  const missing = [
    spendThreshold !== null && !passesSpend ? `gasto mensal de ${formatBrl(spendThreshold)}` : null,
    investmentThreshold !== null && !passesInvestment
      ? `investimento de ${formatBrl(investmentThreshold)}`
      : null,
  ].filter(Boolean);

  return {
    allowed: false,
    note: `Benefício de sala VIP não valorizado porque exige ${missing.join(" e ")}.`,
  };
}

function makeComponent(
  key: string,
  label: string,
  valueBrl: number,
  explanation: string,
  dataQualityNote?: string
): CardValueComponent {
  return {
    key,
    label,
    valueBrl: roundMoney(valueBrl),
    normalizedContribution: clamp(valueBrl / 300, -1, 1),
    explanation,
    dataQualityNote,
  };
}

/** "R$1.234,5" / "-R$13,17": sinal fora do símbolo. */
function signedBrl(value: number): string {
  const rounded = roundMoney(value);
  return `${rounded < 0 ? "-" : ""}R$${Math.abs(rounded).toLocaleString("pt-BR")}`;
}

/**
 * Valor de um cartão para o perfil. O número que decide é
 * `decisionMonthlyValueBrl`; `netMonthlyValueBrl` e `netMonthlyValueRangeHighBrl`
 * são a faixa exibida (pontos vendidos → usados em viagem).
 *
 * `score0To100` aqui é o percentil num conjunto de um cartão (100 se elegível,
 * 0 se não). Para o score exibido use `scoreCardValues` ou `scoreCardInContext`.
 */
export function scoreCardValue(
  card: CardFacet,
  profile: UserProfile = DEFAULT_SCORING_PROFILE,
  mode: CardScoreMode = "profile",
  assumptions: CardValueAssumptions = DEFAULT_VALUE_ASSUMPTIONS
): CardValueScore {
  const eligibility = evaluateEligibility(card, profile);
  const eligibilityReasons = eligibility.reasons;
  const travelFrequency = travelFrequencyForValueModeling(profile);
  const redemptionWeight = travelRedemptionWeight(profile);

  const {
    annualFee: effectiveAnnualFee,
    feeKnown,
    reason: feeAppliedReason,
    notes: feeNotes,
  } = computeEffectiveAnnualFee(card, profile);
  const effectiveMonthlyFee = effectiveAnnualFee / 12;

  const pointsRates = parsePointsRates(card);
  const totalSpend = Math.max(0, profile.avgMonthlySpendBrl);

  // Nomad Explorer: tiered earning rate based on user's USD investment balance
  if (card.card_stable_id === NOMAD_CARD_ID) {
    const investedUsd = (profile.avgInvestedBrl ?? 0) / assumptions.ptaxBrlPerUsd;
    const tier = NOMAD_TIERS.find((t) => investedUsd >= t.minUsd);
    const nomadRate = tier?.rate ?? 0;
    pointsRates.domesticRate = nomadRate;
    pointsRates.internationalRate = nomadRate;
    pointsRates.domesticRatePerBrl = null;
    pointsRates.internationalRatePerBrl = null;
    pointsRates.fallbackRate = nomadRate;
    pointsRates.fallbackRatePerBrl = null;
    if (!tier) {
      pointsRates.note =
        "Nomad Explorer: investimento abaixo de US$ 1.000 — pontuação não aplicada. A taxa sobe para 1,6–3,0 pts/USD com saldo a partir de US$ 1 mil.";
    } else {
      pointsRates.note = `Nomad Explorer: taxa ${nomadRate} pts/USD aplicada com US$${investedUsd.toFixed(0)} investidos (faixa ≥ US$${tier.minUsd.toLocaleString()}).`;
    }
  } else if (
    card.card_stable_id === "porto-bank-porto-bank-mastercard-black-f201dd088d" ||
    card.card_stable_id === "porto-bank-porto-bank-visa-infinite-35c693cb81"
  ) {
    const portoRate = totalSpend > 20_000 ? 3.5 : 2.5;
    pointsRates.domesticRate = portoRate;
    pointsRates.internationalRate = portoRate;
    pointsRates.fallbackRate = portoRate;
    pointsRates.note = `PortoPlus: taxa de ${portoRate.toLocaleString("pt-BR")} pts/USD aplicada para fatura mensal de ${formatBrl(totalSpend)} (3,5 pts/USD acima de R$20.000).`;
  } else if (card.card_stable_id === "itau-itau-uniclass-visa-infinite-53e9a1b8c2") {
    const uniclassRate = totalSpend >= 4_000 ? 2.5 : 2.0;
    pointsRates.domesticRate = uniclassRate;
    pointsRates.internationalRate = uniclassRate;
    pointsRates.fallbackRate = uniclassRate;
  } else if (card.card_stable_id === "banco-do-brasil-banco-do-brasil-visa-altus-liv-0ba9e1e5c9") {
    const altusLivDomestic = totalSpend > 25_000 ? 4.0 : totalSpend >= 15_000 ? 3.5 : 3.0;
    pointsRates.domesticRate = altusLivDomestic;
    pointsRates.internationalRate = 4.0;
    pointsRates.fallbackRate = altusLivDomestic;
  } else if (
    card.card_stable_id === "itau-itau-personnalite-the-essential-mastercard-black-41c89f23ea"
  ) {
    const inv = profile.avgInvestedBrl ?? 0;
    const essentialRate =
      inv >= 1_000_000 ? 3.5 : inv >= 500_000 ? 3.0 : inv >= 150_000 ? 2.5 : 2.0;
    pointsRates.domesticRate = essentialRate;
    pointsRates.internationalRate = essentialRate;
    pointsRates.fallbackRate = essentialRate;
  }

  const pointValuation = pointValuationForCard(card, profile, assumptions);

  // O gasto internacional é parte do gasto total: nunca maior que ele.
  const declaredInternationalSpend = Math.max(0, profile.monthlyInternationalSpendBrl ?? 0);
  const internationalSpend = Math.min(declaredInternationalSpend, totalSpend);
  const domesticSpend = totalSpend - internationalSpend;
  const usesUsdRates = pointsRates.domesticRate !== null || pointsRates.internationalRate !== null;
  const hasPointRate =
    usesUsdRates ||
    pointsRates.domesticRatePerBrl !== null ||
    pointsRates.internationalRatePerBrl !== null;
  const earnsPoints = card.facets_boolean.earn_points_or_miles && hasPointRate;
  const pointsEarnedMonthly = earnsPoints
    ? domesticSpend * (pointsRates.domesticRatePerBrl ?? 0) +
      (domesticSpend / assumptions.ptaxBrlPerUsd) * (pointsRates.domesticRate ?? 0) +
      internationalSpend *
        (pointsRates.internationalRatePerBrl ?? pointsRates.domesticRatePerBrl ?? 0) +
      (internationalSpend / assumptions.ptaxBrlPerUsd) *
        (pointsRates.internationalRate ?? pointsRates.domesticRate ?? 0)
    : 0;
  const pointsRewardMonthlySale = earnsPoints
    ? (pointsEarnedMonthly * pointValuation.saleValuePerThousandBrl) / 1000
    : 0;
  const pointsRewardMonthlyTravel = earnsPoints
    ? (pointsEarnedMonthly * pointValuation.travelValuePerThousandBrl) / 1000
    : 0;

  const cashlike = parseCashlikeRates(card);
  const spendTiers = parseSpendTieredRates(card);
  // Use tiered rate when spend thresholds exist; otherwise fall back to parsed rates
  const hasTiers = spendTiers.length > 0;
  const tieredRate = hasTiers ? effectiveCashlikeRate(card, totalSpend) : 0;
  const cashlikeDomesticRate = hasTiers
    ? tieredRate
    : (cashlike.domesticRate ?? cashlike.generalRate);
  const cashlikeInternationalRate = hasTiers
    ? tieredRate
    : (cashlike.internationalRate ?? cashlike.generalRate);
  let cashlikeRewardMonthly =
    domesticSpend * cashlikeDomesticRate + internationalSpend * cashlikeInternationalRate;

  // Bradesco Like Visa: category-restricted and hard-capped cashback (5% apps up to R$15/mo,
  // 3% on 1 chosen lifestyle package up to R$500/mo, 0% on general spend outside those categories).
  if (card.card_stable_id === "bradesco-bradesco-like-visa-bb515842d5") {
    const appsCashback = Math.min(15, totalSpend * 0.1 * 0.05);
    const packageCashback = Math.min(500, totalSpend * 0.25 * 0.03);
    cashlikeRewardMonthly = appsCashback + packageCashback;
    cashlike.note =
      "Bradesco Like: cashback restrito a apps (5%, teto de R$15/mês) e 1 pacote de categoria (3%, teto de R$500/mês), com 0% no gasto geral fora das categorias; estimado sobre 10% do gasto em apps e 25% no pacote.";
  }
  const grossRewardMonthlyAtSaleValuation = Math.max(
    pointsRewardMonthlySale,
    cashlikeRewardMonthly
  );
  const grossRewardMonthlyAtTravelValuation = Math.max(
    pointsRewardMonthlyTravel,
    grossRewardMonthlyAtSaleValuation
  );
  // Retorno bruto esperado: mesma ponderação venda→viagem do valor de decisão.
  const grossRewardMonthlyDecision =
    grossRewardMonthlyAtSaleValuation +
    redemptionWeight * (grossRewardMonthlyAtTravelValuation - grossRewardMonthlyAtSaleValuation);
  const grossRewardMonthly = grossRewardMonthlyAtSaleValuation;
  const rewardChoice =
    pointsRewardMonthlySale >= cashlikeRewardMonthly ? "milhas/pontos" : "retorno financeiro";

  // Benefícios de viagem: zero para quem declara que não viaja.
  const annualTrips = estimateAnnualTravelDemand(profile);
  const loungeGate =
    annualTrips > 0 ? hasLoungeGate(card, profile) : { allowed: false as const, note: undefined };
  const annualLounge = loungeGate.allowed
    ? estimateAnnualLoungeVisits(profile, card)
    : { visits: 0, note: undefined };
  const loungeValue = (annualLounge.visits * assumptions.loungeVisitValueBrl) / 12;
  const travelDemandFactor = travelBenefitDemandFactor(profile);
  const insuranceValue = card.facets_boolean.mentions_travel_insurance
    ? assumptions.travelInsuranceMonthlyValueBrl * travelDemandFactor
    : 0;
  const conciergeValue = card.facets_boolean.mentions_concierge
    ? assumptions.conciergeMonthlyValueBrl * travelDemandFactor
    : 0;
  const intangibleMonthlyValue = loungeValue + insuranceValue + conciergeValue;
  const hasTravelPerks =
    card.lounge_access.has_lounge_access ||
    card.facets_boolean.mentions_travel_insurance ||
    card.facets_boolean.mentions_concierge;

  const spread = fxSpreadForCard(card);
  const iofRate = effectiveIofRate(card, assumptions);
  const internationalMonthlyCost = internationalSpend * ((1 + spread.spread) * (1 + iofRate) - 1);

  const netMonthlyValue =
    grossRewardMonthlyAtSaleValuation +
    intangibleMonthlyValue -
    effectiveMonthlyFee -
    internationalMonthlyCost;
  const netMonthlyValueRangeHigh =
    grossRewardMonthlyAtTravelValuation +
    intangibleMonthlyValue -
    effectiveMonthlyFee -
    internationalMonthlyCost;
  const decisionValue = decisionMonthlyValue(netMonthlyValue, netMonthlyValueRangeHigh, profile);

  // Ponto de equilíbrio: gasto mensal em que o valor de decisão zera. Benefícios
  // e anuidade são fixos; só retorno e custo internacional escalam com o gasto.
  const rewardRateOverSpend =
    totalSpend > 0 ? (grossRewardMonthlyDecision - internationalMonthlyCost) / totalSpend : 0;
  const fixedGapMonthly = effectiveMonthlyFee - intangibleMonthlyValue;
  const breakEvenMonthlySpend = !feeKnown
    ? null
    : fixedGapMonthly <= 0
      ? 0
      : rewardRateOverSpend > 0
        ? fixedGapMonthly / rewardRateOverSpend
        : null;
  const breakEvenByRewardsOnlyMonthlySpend =
    feeKnown && grossRewardMonthlyDecision > 0 && totalSpend > 0
      ? (effectiveMonthlyFee / grossRewardMonthlyDecision) * totalSpend
      : null;

  const pointsValuationNote = earnsPoints ? pointValuation.note : undefined;

  const tieredSpendNote = (() => {
    if (spendTiers.length === 0) return undefined;
    const minRequired = Math.min(...spendTiers.map((t) => t.minSpend));
    if (totalSpend < minRequired)
      return `Cashback requer gasto mínimo de ${formatBrl(minRequired)}/mês; seu perfil (${formatBrl(totalSpend)}) não atinge o limite — cashback zero aplicado.`;
    return undefined;
  })();

  const internationalCapNote =
    declaredInternationalSpend > internationalSpend
      ? `Gasto internacional informado (${formatBrl(declaredInternationalSpend)}) maior que o gasto total; limitado a ${formatBrl(internationalSpend)}.`
      : undefined;

  const dataQualityNotes = [
    ...eligibility.notes,
    ...feeNotes,
    ...(pointsRates.note ? [pointsRates.note] : []),
    ...(pointsValuationNote ? [pointsValuationNote] : []),
    ...(tieredSpendNote ? [tieredSpendNote] : []),
    ...(cashlike.note && !tieredSpendNote ? [cashlike.note] : []),
    ...(loungeGate.note ? [loungeGate.note] : []),
    ...(annualLounge.note ? [annualLounge.note] : []),
    ...(internationalCapNote ? [internationalCapNote] : []),
    ...(spread.note && internationalSpend > 0 ? [spread.note] : []),
  ];

  const rate = assumptions.ptaxBrlPerUsd.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  const components = [
    makeComponent(
      "rewards",
      "Retorno estimado",
      grossRewardMonthly,
      `Retorno realizável entre pontos/cashback: ${rewardChoice}. ${
        pointsEarnedMonthly > 0
          ? `${pointsEarnedMonthly.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} pts/mês${usesUsdRates ? ` (gasto convertido pelo dólar comercial a R$${rate})` : ""} × ${pointValuation.saleLabel}. Potencial de utilização: R$${roundMoney(pointsRewardMonthlyTravel).toLocaleString("pt-BR")}/mês com ${pointValuation.travelLabel}.`
          : ""
      }`,
      pointsRates.note ??
        (pointsRates.fallbackRate === null &&
        pointsRates.fallbackRatePerBrl === null &&
        cashlike.generalRate === 0 &&
        cashlike.domesticRate === null &&
        cashlike.internationalRate === null
          ? "Sem taxa de retorno estruturada."
          : undefined)
    ),
    makeComponent(
      "intangibles",
      "Benefícios de viagem",
      intangibleMonthlyValue,
      annualTrips === 0
        ? hasTravelPerks
          ? "Perfil declara que não viaja: sala VIP, seguro viagem e concierge não entram no valor."
          : "Sem benefícios de viagem valorizados."
        : `Sala VIP (${annualLounge.visits.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} acessos/ano × R$${assumptions.loungeVisitValueBrl} ÷ 12), seguro viagem (R$${roundMoney(insuranceValue)}/mês) e concierge (R$${roundMoney(conciergeValue)}/mês) ponderados por ${annualTrips} viagens/ano.`,
      loungeGate.note ?? annualLounge.note
    ),
    makeComponent(
      "fee",
      "Mensalidade efetiva",
      -effectiveMonthlyFee,
      feeKnown
        ? "Anuidade dividida por 12 após isenções estruturadas."
        : "Anuidade não informada: considerada R$0 no cálculo, pode ser maior.",
      feeKnown ? undefined : "Anuidade não informada pelo emissor."
    ),
    makeComponent(
      "international",
      "Custo internacional",
      -internationalMonthlyCost,
      "Custo adicional estimado de IOF e spread sobre gasto internacional.",
      internationalSpend > 0 ? spread.note : undefined
    ),
  ];

  const roundedNetMonthly = roundMoney(netMonthlyValue);
  const roundedNetRangeHigh = roundMoney(netMonthlyValueRangeHigh);
  const roundedDecision = roundMoney(decisionValue);
  const showsRange =
    travelFrequency !== "none" && Math.abs(roundedNetRangeHigh - roundedNetMonthly) >= 1;
  const rangeText = `entre ${signedBrl(roundedNetMonthly)} (pontos vendidos) e ${signedBrl(roundedNetRangeHigh)} (pontos usados em viagem)`;
  const netAnnualValue = netMonthlyValue * 12;
  const feeBurden = totalSpend > 0 ? effectiveAnnualFee / (totalSpend * 12) : null;
  const roiMultiple = effectiveAnnualFee > 0 ? (decisionValue * 12) / effectiveAnnualFee : null;

  const scoreDrivers = [
    `Valor esperado: ${signedBrl(roundedDecision)}/mês${showsRange ? ` (${rangeText})` : ""}`,
    feeKnown
      ? `Anuidade efetiva: R$${roundMoney(effectiveAnnualFee).toLocaleString("pt-BR")}/ano`
      : "Anuidade: não informada (calculada como R$0, pode ser maior)",
    showsRange
      ? `Retorno bruto: R$${roundMoney(grossRewardMonthlyAtSaleValuation).toLocaleString("pt-BR")}–R$${roundMoney(grossRewardMonthlyAtTravelValuation).toLocaleString("pt-BR")}/mês`
      : `Retorno bruto: R$${roundMoney(grossRewardMonthly).toLocaleString("pt-BR")}/mês`,
    annualTrips === 0 && hasTravelPerks
      ? "Benefícios de viagem: R$0/mês (perfil não viaja)"
      : `Benefícios de viagem: R$${roundMoney(intangibleMonthlyValue).toLocaleString("pt-BR")}/mês`,
  ];
  if (internationalMonthlyCost > 0) {
    scoreDrivers.push(
      `Custo internacional: -R$${roundMoney(internationalMonthlyCost).toLocaleString("pt-BR")}/mês`
    );
  }

  const rankReason = !eligibility.eligible
    ? `Bloqueado por elegibilidade: ${eligibilityReasons.join(" ")}`
    : !feeKnown
      ? `Anuidade não informada: listado depois dos cartões com anuidade conhecida. Sem contar a anuidade, valor esperado de ${signedBrl(roundedDecision)}/mês.`
      : roundedDecision >= 0
        ? `Valor esperado de ${signedBrl(roundedDecision)}/mês após anuidade e custos${showsRange ? ` (${rangeText})` : ""}.`
        : `Custa ${signedBrl(Math.abs(roundedDecision))}/mês a mais do que devolve, após anuidade e custos${showsRange ? ` (${rangeText})` : ""}.`;
  const verdict = !eligibility.eligible
    ? "Não elegível com o perfil informado."
    : !feeKnown
      ? "Anuidade não informada: confirme o custo com o emissor antes de decidir."
      : roundedDecision > 100
        ? "Forte candidato para este perfil."
        : roundedDecision >= 0
          ? "Pode compensar, dependendo do uso real."
          : "Tende a destruir valor neste perfil.";

  return {
    card,
    mode,
    eligible: eligibility.eligible,
    eligibilityReasons,
    // Percentil num conjunto de um cartão; o score exibido vem de scoreCardValues.
    score0To100: eligibility.eligible ? 100 : 0,
    rankReason,
    feeAppliedReason,
    roiMultiple: roiMultiple === null ? null : roundMoney(roiMultiple),
    feeBurdenPctOfAnnualSpend: feeBurden === null ? null : roundMoney(feeBurden * 100),
    scoreDrivers,
    decisionMonthlyValueBrl: roundedDecision,
    feeKnown,
    netMonthlyValueBrl: roundedNetMonthly,
    netMonthlyValueRangeHighBrl: roundedNetRangeHigh,
    netAnnualValueBrl: roundMoney(netAnnualValue),
    effectiveMonthlyFeeBrl: roundMoney(effectiveMonthlyFee),
    effectiveAnnualFeeBrl: roundMoney(effectiveAnnualFee),
    grossRewardMonthlyBrl: roundMoney(grossRewardMonthly),
    grossRewardMonthlyRangeHighBrl: roundMoney(grossRewardMonthlyAtTravelValuation),
    pointsRewardMonthlyBrl: roundMoney(pointsRewardMonthlySale),
    pointsRewardMonthlySaleBrl: roundMoney(pointsRewardMonthlySale),
    pointsRewardMonthlyTravelBrl: roundMoney(pointsRewardMonthlyTravel),
    cashlikeRewardMonthlyBrl: roundMoney(cashlikeRewardMonthly),
    intangibleMonthlyValueBrl: roundMoney(intangibleMonthlyValue),
    internationalMonthlyCostBrl: roundMoney(internationalMonthlyCost),
    breakEvenMonthlySpendBrl:
      breakEvenMonthlySpend === null ? null : roundMoney(breakEvenMonthlySpend),
    breakEvenByRewardsOnlyMonthlySpendBrl:
      breakEvenByRewardsOnlyMonthlySpend === null
        ? null
        : roundMoney(breakEvenByRewardsOnlyMonthlySpend),
    verdict,
    components,
    assumptions,
    dataQualityNotes,
  };
}

/** Pontua, ordena (`compareCardValueScores`) e aplica o score percentil. */
export function scoreCardValues(
  cards: CardFacet[],
  profile: UserProfile = DEFAULT_SCORING_PROFILE,
  mode: CardScoreMode = "profile",
  assumptions: CardValueAssumptions = DEFAULT_VALUE_ASSUMPTIONS
): CardValueScore[] {
  return applyPercentileScores(
    cards
      .map((card) => scoreCardValue(card, profile, mode, assumptions))
      .sort(compareCardValueScores)
  );
}

/**
 * Score de um cartão no contexto de um catálogo: mesmo percentil, valor e
 * ordem que o cartão tem em `scoreCardValues(allCards, …)`. Use em telas de
 * detalhe, comparação e chat para o cartão mostrar o mesmo score em todo lugar.
 */
export function scoreCardInContext(
  card: CardFacet,
  allCards: CardFacet[],
  profile: UserProfile = DEFAULT_SCORING_PROFILE,
  assumptions: CardValueAssumptions = DEFAULT_VALUE_ASSUMPTIONS,
  mode: CardScoreMode = "profile"
): CardValueScore {
  const inCatalog = allCards.some((c) => c.card_stable_id === card.card_stable_id);
  const pool = inCatalog ? allCards : [...allCards, card];
  const scored = scoreCardValues(pool, profile, mode, assumptions);
  return scored.find((s) => s.card.card_stable_id === card.card_stable_id) as CardValueScore;
}
