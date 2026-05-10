import type {
  CardCharacteristic,
  CardFacet,
  CardScoreMode,
  CardValueAssumptions,
  CardValueComponent,
  CardValueScore,
  UserProfile,
} from "@/types/cards";

export const DEFAULT_VALUE_ASSUMPTIONS: CardValueAssumptions = {
  ptaxBrlPerUsd: 4.96,
  mileValuePerThousandBrl: 32,
  liveloPointSaleValuePerThousandBrl: 32,
  liveloPointTravelValuePerThousandBrl: 45,
  membershipRewardsPointTravelValuePerThousandBrl: 95,
  membershipRewardsPointSaleValuePerThousandBrl: 45,
  defaultPointValuePerThousandBrl: 22,
  iof: 0.035,
  loungeVisitValueBrl: 160,
  travelInsuranceMonthlyValueBrl: 25,
  conciergeMonthlyValueBrl: 15,
};

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

const RETAIL_BANK_SPREAD = 0.055;
const DEFAULT_SPREAD = 0.045;
const COOPERATIVE_SPREAD = 0.01;
const NON_TRAVELER_DEFAULT_POINT_SALE_VALUE_PER_THOUSAND_BRL = 20;

// Nomad Explorer earning tiers (investment in USD)
const NOMAD_CARD_ID = "nomad-nomad-explorer-visa-infinite-aae26793ed";
const NOMAD_TIERS: { minUsd: number; rate: number }[] = [
  { minUsd: 5000, rate: 3.0 },
  { minUsd: 2500, rate: 2.2 },
  { minUsd: 1000, rate: 1.6 },
];

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

function pointValuationForCard(
  card: CardFacet,
  profile: UserProfile,
  assumptions: CardValueAssumptions
): {
  saleValuePerThousandBrl: number;
  travelValuePerThousandBrl: number;
  saleLabel: string;
  travelLabel: string;
  note: string;
} {
  const nonTravelerSaleCap =
    profile.travelFrequency === "none"
      ? NON_TRAVELER_DEFAULT_POINT_SALE_VALUE_PER_THOUSAND_BRL
      : Number.POSITIVE_INFINITY;

  if (isMembershipRewardsCard(card)) {
    return {
      saleValuePerThousandBrl: assumptions.membershipRewardsPointSaleValuePerThousandBrl,
      travelValuePerThousandBrl: assumptions.membershipRewardsPointTravelValuePerThousandBrl,
      saleLabel: `Membership Rewards a R$${assumptions.membershipRewardsPointSaleValuePerThousandBrl}/1k pts (venda)`,
      travelLabel: `Membership Rewards a R$${assumptions.membershipRewardsPointTravelValuePerThousandBrl}/1k pts (utilizacao)`,
      note:
        `Membership Rewards: retorno realizável de venda em R$${assumptions.membershipRewardsPointSaleValuePerThousandBrl} por 1.000 pontos; potencial de utilizacao em R$${assumptions.membershipRewardsPointTravelValuePerThousandBrl} por 1.000 pontos.`,
    };
  }

  if (hasLiveloOrEsferaProgram(card)) {
    const liveloSaleValuePerThousandBrl = Math.min(
      assumptions.liveloPointSaleValuePerThousandBrl,
      nonTravelerSaleCap
    );

    return {
      saleValuePerThousandBrl: liveloSaleValuePerThousandBrl,
      travelValuePerThousandBrl: assumptions.liveloPointTravelValuePerThousandBrl,
      saleLabel: `Livelo/Esfera a R$${liveloSaleValuePerThousandBrl}/1k pts (venda)`,
      travelLabel: `Livelo/Esfera a R$${assumptions.liveloPointTravelValuePerThousandBrl}/1k pts (utilizacao)`,
      note:
        `Livelo/Esfera: retorno realizável de venda em R$${liveloSaleValuePerThousandBrl} por 1.000 pontos; potencial de utilizacao em R$${assumptions.liveloPointTravelValuePerThousandBrl} por 1.000 pontos.`,
    };
  }

  if (hasDirectAirlineProgram(card)) {
    return {
      saleValuePerThousandBrl: assumptions.mileValuePerThousandBrl,
      travelValuePerThousandBrl: Math.max(
        assumptions.mileValuePerThousandBrl,
        assumptions.liveloPointTravelValuePerThousandBrl
      ),
      saleLabel: `milhas a R$${assumptions.mileValuePerThousandBrl}/1k (venda)`,
      travelLabel: `milhas a R$${Math.max(
        assumptions.mileValuePerThousandBrl,
        assumptions.liveloPointTravelValuePerThousandBrl
      )}/1k (utilizacao)`,
      note:
        `Programa aéreo direto: retorno realizável em R$${assumptions.mileValuePerThousandBrl} por 1.000 milhas; potencial de utilizacao em R$${Math.max(
          assumptions.mileValuePerThousandBrl,
          assumptions.liveloPointTravelValuePerThousandBrl
        )} por 1.000 milhas.`,
    };
  }

  const defaultSaleValuePerThousandBrl =
    Math.min(assumptions.defaultPointValuePerThousandBrl, nonTravelerSaleCap);
  const defaultTravelValuePerThousandBrl = Math.max(
    defaultSaleValuePerThousandBrl,
    55
  );

  return {
    saleValuePerThousandBrl: defaultSaleValuePerThousandBrl,
    travelValuePerThousandBrl: defaultTravelValuePerThousandBrl,
    saleLabel: `pontos a R$${defaultSaleValuePerThousandBrl}/1k pts (venda)`,
    travelLabel: `pontos a R$${defaultTravelValuePerThousandBrl}/1k pts (utilizacao)`,
    note:
      `Programa de pontos não identificado; usado retorno conservador de R$${defaultSaleValuePerThousandBrl} por 1.000 pontos e potencial de utilizacao de R$${defaultTravelValuePerThousandBrl} por 1.000 pontos.`,
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

function characteristicText(card: CardFacet): string {
  return (card.characteristics ?? [])
    .map((item) => `${item.label} ${String(item.value)} ${item.details ?? ""}`)
    .join(" ");
}

function characteristicsByKey(card: CardFacet, key: string): CardCharacteristic[] {
  return (card.characteristics ?? []).filter((item) => item.key === key);
}

function parsePercent(text: string): number | null {
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*%/);
  if (!match) return null;
  return Number(match[1].replace(",", ".")) / 100;
}

function parseBrlAmount(text: string): number | null {
  const match = text.match(/R\$\s*([\d.]+(?:,\d+)?)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBrlAmounts(text: string): number[] {
  return [...text.matchAll(/R\$\s*([\d.]+(?:,\d+)?)/gi)]
    .map((match) => Number(match[1].replace(/\./g, "").replace(",", ".")))
    .filter((value) => Number.isFinite(value));
}

function parsePointsRate(card: CardFacet): number | null {
  const candidates = [
    card.reward_return.earning_summary,
    ...characteristicsByKey(card, "earning_rate").map((item) => String(item.value)),
    ...characteristicsByKey(card, "earning_detail").map((item) => String(item.value)),
  ];
  const rates = candidates.flatMap((text) =>
    [
      ...text.matchAll(
        /(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?)(?:\s*(?:por|\/)\s*(?:d[oó]lar|usd)|\/usd)/gi
      ),
    ].map((match) => Number(match[1].replace(",", ".")))
  );
  const validRates = rates.filter((rate) => Number.isFinite(rate) && rate > 0);
  return validRates.length > 0 ? Math.max(...validRates) : null;
}

function parsePointsRates(card: CardFacet): {
  domesticRate: number | null;
  internationalRate: number | null;
  fallbackRate: number | null;
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
  const ignoredGenericCeilings: string[] = [];

  for (const text of candidates) {
    const normalized = normalizeText(text);
    for (const match of text.matchAll(
      /(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?)(?:\s*(?:por|\/)\s*(?:d[oó]lar|usd)|\/usd)/gi
    )) {
      const rate = Number(match[1].replace(",", "."));
      if (!Number.isFinite(rate) || rate <= 0) continue;
      if (/exterior|internacion/.test(normalized)) {
        international.push(rate);
      } else if (/brasil|nacion/.test(normalized)) {
        domestic.push(rate);
      } else if (/ate|até/.test(normalized)) {
        ignoredGenericCeilings.push(String(text));
      } else {
        generic.push(rate);
      }
    }
  }

  const maxOrNull = (values: number[]) => (values.length > 0 ? Math.max(...values) : null);
  const fallbackRate = maxOrNull(generic);
  const note =
    ignoredGenericCeilings.length > 0 && domestic.length === 0 && international.length === 0
      ? "Pontuação informada apenas como teto ('até X pontos/USD'); retorno em pontos não aplicado sem regra efetiva estruturada."
      : undefined;
  return {
    domesticRate: maxOrNull(domestic) ?? fallbackRate,
    internationalRate: maxOrNull(international) ?? fallbackRate,
    fallbackRate,
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

  for (const raw of cashlikeTextCandidates(card)) {
    const text = normalizeText(raw);
    if (!/(cashback|investback|credito na fatura)/.test(text)) continue;
    const rate = parsePercent(text);
    if (rate === null || rate <= 0 || rate > 0.08) continue;

    const categorySpecific =
      /(amazon|mercado livre|extra|pao de acucar|pão de açúcar|nu viagens|passagens?|hoteis|hot[eé]is|hotel|companhia aerea|vivo)/.test(
        text
      );
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
    if (/por dolar|\/usd/.test(text) && /ate|até/.test(text) && rate >= 0.03) {
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
      generalRate: 0.01,
      domesticRate: null,
      internationalRate: null,
      ignoredCategorySpecific,
      note: "Taxa exata de cashback não estruturada; usado retorno conservador de 1%.",
    };
  }
  return { generalRate: 0, domesticRate: null, internationalRate: null, ignoredCategorySpecific };
}

function formatBrl(value: number): string {
  return `R$${value.toLocaleString("pt-BR")}`;
}

function parseBrlNumber(str: string): number | null {
  const val = parseFloat(str.replace(/\./g, "").replace(",", "."));
  return isNaN(val) ? null : val;
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
        continue;
      }
    }
  }

  return tiers.sort((a, b) => a.minSpend - b.minSpend);
}

function effectiveCashlikeRate(card: CardFacet, totalMonthlySpendBrl: number): number {
  const tiers = parseSpendTieredRates(card);
  if (tiers.length > 0) {
    // Find the highest tier whose minSpend the user meets
    const applicable = [...tiers].reverse().find(
      (t) => totalMonthlySpendBrl >= t.minSpend && totalMonthlySpendBrl <= t.maxSpend
    );
    return applicable?.rate ?? 0;
  }
  return parseCashlikeRates(card).generalRate;
}

function getMinimumInvestment(card: CardFacet): number | "unknown" {
  return (
    card.eligibility?.minimum_investment_brl_best_estimate ??
    card.facets_numeric_or_special.minimum_investment_brl_best_estimate
  );
}

function getMinimumIncome(card: CardFacet): number | "unknown" {
  return (
    card.eligibility?.minimum_income_brl_best_estimate ??
    card.facets_numeric_or_special.minimum_income_brl_best_estimate ??
    "unknown"
  );
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
    notes.push("Produto disponível apenas por convite; sugerido como referência, não como elegibilidade garantida.");
  } else if (availability === "private_or_segment_restricted") {
    const hasStructuredGate = typeof minInvestment === "number" || typeof minIncome === "number";
    const meetsStructuredGate =
      (typeof minInvestment !== "number" || profile.avgInvestedBrl >= minInvestment) &&
      (typeof minIncome !== "number" || profile.monthlySalaryBrl >= minIncome);
    if (!hasStructuredGate || !meetsStructuredGate) {
      reasons.push("Produto marcado como restrito a segmento/private banking.");
    } else {
      notes.push("Produto restrito a segmento/private banking; elegibilidade final pode depender de convite/análise do emissor.");
    }
  }

  const blocksOnUnknown =
    card.eligibility?.recommendation_blocking_unknowns === true &&
    minInvestment === "unknown" &&
    minIncome === "unknown";
  if (blocksOnUnknown) {
    if (availability === "invite_only" || availability === "private_or_segment_restricted") {
      notes.push("Elegibilidade crítica não estruturada; mantenha como sugestão restrita para análise manual.");
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
    parseAmountBeforeKeyword(text, "(?:gasto|fatura|compras|despesas)") ??
    parseSpendThreshold(text)
  );
}

function parseInvestmentThresholdAnyOrder(text: string): number | null {
  return (
    parseAmountBeforeKeyword(text, "(?:invest|patrimonio|aplicac)") ??
    parseInvestmentThreshold(text)
  );
}

function computeEffectiveAnnualFee(
  card: CardFacet,
  profile: UserProfile
): { annualFee: number; reason: string; notes: string[] } {
  const rawFee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  if (rawFee === "unknown" || rawFee === "variable_pricing_claim") {
    return {
      annualFee: 0,
      reason: "Anuidade não estruturada; tratada como R$0 com baixa confiança.",
      notes: ["Anuidade não estruturada; tratada como R$0 no score e marcada como incerteza."],
    };
  }

  const baseFee = typeof rawFee === "number" ? rawFee : 0;
  if (baseFee <= 0) return { annualFee: 0, reason: "Sem anuidade estruturada.", notes: [] };

  const notes: string[] = [];
  let effectiveFee = baseFee;
  const feeWaivers = characteristicsByKey(card, "fee_waiver");
  const structuredRules = card.fee_waiver_rules ?? [];
  const conditionalAnnualFee = characteristicsByKey(card, "annual_fee_condition")
    .map((item) => `${item.value} ${item.details ?? ""}`)
    .find((text) => /correntista/i.test(text));

  if (conditionalAnnualFee && card.eligibility?.requires_bank_account_claim === true) {
    const accountHolderFee = Math.min(...parseBrlAmounts(conditionalAnnualFee));
    if (Number.isFinite(accountHolderFee) && accountHolderFee > 0 && accountHolderFee < effectiveFee) {
      effectiveFee = accountHolderFee;
      notes.push("Anuidade de correntista aplicada por condição estruturada.");
    }
  }

  for (const rule of structuredRules) {
    if (!rule.full_waiver && !/50%|metade|parcial/i.test(rule.description)) continue;

    const qualifiesBySpend =
      rule.category === "monthly_spend" &&
      typeof rule.threshold_brl === "number" &&
      profile.avgMonthlySpendBrl >= rule.threshold_brl;
    const qualifiesByInvestment =
      rule.category === "investment" &&
      typeof rule.threshold_brl === "number" &&
      profile.avgInvestedBrl >= rule.threshold_brl;
    const qualifiesByGeneral = rule.category === "general" && rule.full_waiver;

    if (rule.full_waiver && (qualifiesBySpend || qualifiesByInvestment || qualifiesByGeneral)) {
      effectiveFee = 0;
      notes.push("Isenção aplicada por regra estruturada de anuidade.");
      break;
    }

    if (!rule.full_waiver && qualifiesBySpend && /50%|metade|parcial/i.test(rule.description)) {
      effectiveFee = Math.min(effectiveFee, baseFee * 0.5);
      notes.push("Desconto/cashback parcial de anuidade aplicado por regra estruturada.");
    }
  }

  for (const waiver of structuredRules.length > 0 ? [] : feeWaivers) {
    const text = `${waiver.value} ${waiver.details ?? ""}`;
    const normalized = normalizeText(text);
    const spendThreshold = parseSpendThreshold(text);
    const investmentThreshold = parseInvestmentThreshold(text);

    const qualifiesBySpend =
      spendThreshold !== null && profile.avgMonthlySpendBrl >= spendThreshold;
    const qualifiesByInvestment =
      investmentThreshold !== null && profile.avgInvestedBrl >= investmentThreshold;

    const hasExplicitCondition = spendThreshold !== null || investmentThreshold !== null;

    if (
      hasExplicitCondition &&
      (qualifiesBySpend || qualifiesByInvestment) &&
      /100%|isenc|isento|zero/.test(normalized)
    ) {
      effectiveFee = 0;
      notes.push("Isenção aplicada por regra estruturada de gasto ou investimento.");
      break;
    }

    if (
      hasExplicitCondition &&
      (qualifiesBySpend || qualifiesByInvestment) &&
      /50%|metade|parcial/.test(normalized)
    ) {
      effectiveFee = Math.min(effectiveFee, baseFee * 0.5);
      notes.push("Desconto parcial de anuidade aplicado de forma conservadora.");
    }
  }

  const monthlyFee = baseFee / 12;
  for (const rule of structuredRules) {
    if (
      rule.category !== "monthly_spend" ||
      rule.full_waiver ||
      typeof rule.threshold_brl !== "number" ||
      typeof rule.discount_brl !== "number" ||
      rule.period !== "monthly"
    ) {
      continue;
    }

    const discountSteps = Math.floor(profile.avgMonthlySpendBrl / rule.threshold_brl);
    if (discountSteps <= 0) continue;

    const discountedMonthlyFee = Math.max(0, monthlyFee - discountSteps * rule.discount_brl);
    const discountedAnnualFee = discountedMonthlyFee * 12;
    if (discountedAnnualFee < effectiveFee) {
      effectiveFee = discountedAnnualFee;
      notes.push("Desconto progressivo de mensalidade aplicado por regra estruturada de gasto.");
    }
  }

  const reason =
    effectiveFee < baseFee
      ? `Anuidade efetiva de R$${effectiveFee.toLocaleString("pt-BR")} após regra estruturada.`
      : "Sem regra de isenção suficientemente estruturada para este perfil; anuidade cheia aplicada.";

  if (effectiveFee === baseFee && (feeWaivers.length > 0 || structuredRules.length > 0)) {
    notes.push("Há menção de isenção/desconto, mas sem condição estruturada aplicável ao perfil.");
  }

  return { annualFee: effectiveFee, reason, notes };
}

function issuerSpreadFallback(card: CardFacet): number {
  const issuer = normalizeText(card.issuer_raw);
  if (/(sicredi|sicoob|unicred|uniprime|sisprime|cresol)/.test(issuer)) {
    return COOPERATIVE_SPREAD;
  }
  if (/(bradesco|itau|itaú|santander|banco do brasil|caixa)/.test(issuer)) {
    return RETAIL_BANK_SPREAD;
  }
  return DEFAULT_SPREAD;
}

function parseSpread(card: CardFacet): { spread: number; note?: string } {
  const text = `${card.facets_numeric_or_special.official_forex_or_iof_note} ${characteristicText(card)}`;
  const normalized = normalizeText(text);
  const spreadText = normalized
    .split(/[.;|]/)
    .filter((part) => part.includes("spread") || part.includes("dolar"))
    .join(" ");
  const parsed = parsePercent(spreadText);
  if (parsed !== null) return { spread: parsed };
  return {
    spread: issuerSpreadFallback(card),
    note: "Spread não estruturado; usado fallback por tipo de emissor.",
  };
}

function effectiveIofRate(card: CardFacet, assumptions: CardValueAssumptions): number {
  const text = normalizeText(
    `${card.facets_numeric_or_special.official_forex_or_iof_note} ${characteristicText(card)}`
  );
  if (/iof\s*zero|zero\s*iof|0\s*%\s*de\s*iof/.test(text)) return 0;
  return assumptions.iof;
}

function estimateAnnualTravelDemand(profile: UserProfile): number {
  if (profile.travelFrequency === "frequent") return 10;
  if (profile.travelFrequency === "occasional") return 6;
  return 1;
}

function fallbackAnnualLoungeCap(card: CardFacet): { visits: number; note: string } {
  const variant = normalizeText(card.variant_band);
  const segment = card.market_segment_guess;
  const visits =
    /black|infinite|centurion/.test(variant) || segment === "ultra_premium" || segment === "premium"
      ? 2
      : 1;
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
  if (typeof card.lounge_access.annual_visits === "number") {
    return { visits: Math.min(demand, card.lounge_access.annual_visits) };
  }

  if (card.lounge_access.unlimited) return { visits: demand };

  const fallback = fallbackAnnualLoungeCap(card);
  return {
    visits: Math.min(demand, fallback.visits),
    note: fallback.note,
  };
}

function travelBenefitDemandFactor(profile: UserProfile): number {
  return estimateAnnualTravelDemand(profile) / 10;
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
  const spendThreshold = la.condition_monthly_spend_brl ?? parseSpendThresholdAnyOrder(loungeConditionText(card));
  const investmentThreshold = la.condition_investment_brl ?? parseInvestmentThresholdAnyOrder(loungeConditionText(card));
  const isOr = la.condition_logic === "or";
  const hasGate = spendThreshold !== null || investmentThreshold !== null;
  if (!hasGate) return { allowed: true };

  const passesSpend = spendThreshold === null || profile.avgMonthlySpendBrl >= spendThreshold;
  const passesInvestment = investmentThreshold === null || profile.avgInvestedBrl >= investmentThreshold;

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
    investmentThreshold !== null && !passesInvestment ? `investimento de ${formatBrl(investmentThreshold)}` : null,
  ].filter(Boolean);

  return {
    allowed: false,
    note: `Benefício de sala VIP não valorizado porque exige ${missing.join(" e ")}.`,
  };
}

function normalizeScore({
  netMonthly,
  eligible,
  grossRewardMonthly,
  intangibleMonthlyValue,
  effectiveMonthlyFee,
  monthlySpend,
}: {
  netMonthly: number;
  eligible: boolean;
  grossRewardMonthly: number;
  intangibleMonthlyValue: number;
  effectiveMonthlyFee: number;
  monthlySpend: number;
}): number {
  if (!eligible) return 0;

  const valueCreated = grossRewardMonthly + intangibleMonthlyValue;
  if (valueCreated <= 0 && effectiveMonthlyFee <= 0 && netMonthly >= 0) return 50;

  const spendBase = Math.max(1, monthlySpend);
  const spendYield = netMonthly / spendBase;

  if (netMonthly < 0) {
    const absolutePenalty = Math.min(25, Math.abs(netMonthly) / 2);
    const proportionalPenalty = Math.min(25, (Math.abs(spendYield) / 0.02) * 25);
    return Math.round(clamp(50 - absolutePenalty - proportionalPenalty, 0, 49));
  }

  const absoluteGainScore = Math.min(20, netMonthly / 5);
  const proportionalGainScore = Math.min(28, (spendYield / 0.025) * 28);
  const benefitSignal = Math.min(2, valueCreated / 50);
  return Math.round(clamp(50 + absoluteGainScore + proportionalGainScore + benefitSignal, 0, 100));
}

function preferenceAdjustment(
  profile: UserProfile,
  {
    pointsRewardMonthlySale,
    cashlikeRewardMonthly,
    loungeValue,
  }: {
    pointsRewardMonthlySale: number;
    cashlikeRewardMonthly: number;
    loungeValue: number;
  }
): number {
  let adjustment = 0;
  const hasMeaningfulPoints = pointsRewardMonthlySale > 0;
  const hasMeaningfulCashlike = cashlikeRewardMonthly > 0;

  if (profile.preferences.prefersCashback) {
    if (hasMeaningfulCashlike || hasMeaningfulPoints) {
      adjustment += cashlikeRewardMonthly >= pointsRewardMonthlySale ? 3 : -3;
    }
  }
  if (profile.preferences.prefersPoints) {
    if (hasMeaningfulCashlike || hasMeaningfulPoints) {
      adjustment += pointsRewardMonthlySale > cashlikeRewardMonthly ? 3 : -3;
    }
  }
  if (profile.preferences.wantsLounge) {
    adjustment += loungeValue >= 20 ? 2 : -2;
  }

  return clamp(adjustment, -6, 6);
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

export function scoreCardValue(
  card: CardFacet,
  profile: UserProfile = DEFAULT_SCORING_PROFILE,
  mode: CardScoreMode = "profile",
  assumptions: CardValueAssumptions = DEFAULT_VALUE_ASSUMPTIONS
): CardValueScore {
  const eligibility = evaluateEligibility(card, profile);
  const eligibilityReasons = eligibility.reasons;

  const {
    annualFee: effectiveAnnualFee,
    reason: feeAppliedReason,
    notes: feeNotes,
  } = computeEffectiveAnnualFee(card, profile);
  const effectiveMonthlyFee = effectiveAnnualFee / 12;

  const pointsRates = parsePointsRates(card);

  // Nomad Explorer: tiered earning rate based on user's USD investment balance
  if (card.card_stable_id === NOMAD_CARD_ID) {
    const investedUsd = (profile.avgInvestedBrl ?? 0) / assumptions.ptaxBrlPerUsd;
    const tier = NOMAD_TIERS.find((t) => investedUsd >= t.minUsd);
    const nomadRate = tier?.rate ?? 0;
    pointsRates.domesticRate = nomadRate;
    pointsRates.internationalRate = nomadRate;
    pointsRates.fallbackRate = nomadRate;
    if (!tier) {
      pointsRates.note =
        "Nomad Explorer: investimento abaixo de US$ 1.000 — pontuação não aplicada. A taxa sobe para 1,6–3,0 pts/USD com saldo a partir de US$ 1 mil.";
    } else {
      pointsRates.note = `Nomad Explorer: taxa ${nomadRate} pts/USD aplicada com US$${investedUsd.toFixed(0)} investidos (faixa ≥ US$${tier.minUsd.toLocaleString()}).`;
    }
  }

  const pointValuation = pointValuationForCard(card, profile, assumptions);

  const internationalSpend = profile.monthlyInternationalSpendBrl ?? 0;
  const domesticSpend = Math.max(0, profile.avgMonthlySpendBrl - internationalSpend);
  const pointsEarnedMonthly =
    card.facets_boolean.earn_points_or_miles &&
    (pointsRates.domesticRate !== null || pointsRates.internationalRate !== null)
      ? (domesticSpend / assumptions.ptaxBrlPerUsd) * (pointsRates.domesticRate ?? 0) +
        (internationalSpend / assumptions.ptaxBrlPerUsd) *
          (pointsRates.internationalRate ?? pointsRates.domesticRate ?? 0)
      : 0;
  const pointsRewardMonthlySale =
    card.facets_boolean.earn_points_or_miles &&
    (pointsRates.domesticRate !== null || pointsRates.internationalRate !== null)
      ? (pointsEarnedMonthly * pointValuation.saleValuePerThousandBrl) / 1000
      : 0;
  const pointsRewardMonthlyTravel =
    card.facets_boolean.earn_points_or_miles &&
    (pointsRates.domesticRate !== null || pointsRates.internationalRate !== null)
      ? (pointsEarnedMonthly * pointValuation.travelValuePerThousandBrl) / 1000
      : 0;

  const cashlike = parseCashlikeRates(card);
  const tieredRate = effectiveCashlikeRate(card, profile.avgMonthlySpendBrl);
  // Use tiered rate when spend thresholds exist; otherwise fall back to parsed rates
  const hasTiers = parseSpendTieredRates(card).length > 0;
  const cashlikeDomesticRate = hasTiers ? tieredRate : (cashlike.domesticRate ?? cashlike.generalRate);
  const cashlikeInternationalRate = hasTiers ? tieredRate : (cashlike.internationalRate ?? cashlike.generalRate);
  const cashlikeRewardMonthly =
    domesticSpend * cashlikeDomesticRate + internationalSpend * cashlikeInternationalRate;
  const grossRewardMonthly = Math.max(pointsRewardMonthlySale, cashlikeRewardMonthly);
  const rewardChoice =
    pointsRewardMonthlySale >= cashlikeRewardMonthly ? "milhas/pontos" : "retorno financeiro";

  const loungeGate = hasLoungeGate(card, profile);
  const annualLounge = loungeGate.allowed
    ? estimateAnnualLoungeVisits(profile, card)
    : { visits: 0 };
  const loungeValue = (annualLounge.visits * assumptions.loungeVisitValueBrl) / 12;
  const travelDemandFactor = travelBenefitDemandFactor(profile);
  const insuranceValue = card.facets_boolean.mentions_travel_insurance
    ? assumptions.travelInsuranceMonthlyValueBrl * travelDemandFactor
    : 0;
  const conciergeValue = card.facets_boolean.mentions_concierge
    ? assumptions.conciergeMonthlyValueBrl * travelDemandFactor
    : 0;
  const intangibleMonthlyValue = loungeValue + insuranceValue + conciergeValue;

  const spread = parseSpread(card);
  const iofRate = effectiveIofRate(card, assumptions);
  const internationalMonthlyCost =
    internationalSpend * ((1 + spread.spread) * (1 + iofRate) - 1);

  const netMonthlyValue =
    grossRewardMonthly + intangibleMonthlyValue - effectiveMonthlyFee - internationalMonthlyCost;
  const netContributionRateOverSpend =
    profile.avgMonthlySpendBrl > 0
      ? (grossRewardMonthly + intangibleMonthlyValue - internationalMonthlyCost) /
        profile.avgMonthlySpendBrl
      : 0;
  const breakEvenByRewardsOnlyMonthlySpend =
    grossRewardMonthly > 0 && profile.avgMonthlySpendBrl > 0
      ? (effectiveMonthlyFee / grossRewardMonthly) * profile.avgMonthlySpendBrl
      : null;
  const breakEvenMonthlySpend =
    netContributionRateOverSpend > 0 ? effectiveMonthlyFee / netContributionRateOverSpend : null;

  const pointsValuationNote =
    card.facets_boolean.earn_points_or_miles &&
    (pointsRates.domesticRate !== null || pointsRates.internationalRate !== null)
      ? pointValuation.note
      : undefined;

  const tieredSpendNote = (() => {
    const tiers = parseSpendTieredRates(card);
    if (tiers.length === 0) return undefined;
    const minRequired = Math.min(...tiers.map((t) => t.minSpend));
    if (profile.avgMonthlySpendBrl < minRequired)
      return `Cashback requer gasto mínimo de ${formatBrl(minRequired)}/mês; seu perfil (${formatBrl(profile.avgMonthlySpendBrl)}) não atinge o limite — cashback zero aplicado.`;
    return undefined;
  })();

  const dataQualityNotes = [
    ...eligibility.notes,
    ...feeNotes,
    ...(pointsRates.note ? [pointsRates.note] : []),
    ...(pointsValuationNote ? [pointsValuationNote] : []),
    ...(tieredSpendNote ? [tieredSpendNote] : []),
    ...(cashlike.note && !tieredSpendNote ? [cashlike.note] : []),
    ...(loungeGate.note ? [loungeGate.note] : []),
    ...(annualLounge.note ? [annualLounge.note] : []),
    ...(spread.note ? [spread.note] : []),
  ];

  const components = [
    makeComponent(
        "rewards",
        "Retorno estimado",
        grossRewardMonthly,
        `Retorno realizável entre pontos/cashback: ${rewardChoice}. ${
          pointsEarnedMonthly > 0
          ? `${pointsEarnedMonthly.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} pts/mês × ${pointValuation.saleLabel}. Potencial de utilizacao: R$${roundMoney(pointsRewardMonthlyTravel).toLocaleString("pt-BR")}/mês com ${pointValuation.travelLabel}.`
          : ""
      }`,
      pointsRates.note ??
        (pointsRates.fallbackRate === null &&
        cashlike.generalRate === 0 &&
        cashlike.domesticRate === null &&
        cashlike.internationalRate === null
          ? "Sem taxa de retorno estruturada."
          : undefined)
    ),
    makeComponent(
      "intangibles",
      "Benefícios valorizados",
      intangibleMonthlyValue,
      `Sala VIP (${annualLounge.visits.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} acessos/ano × R$${assumptions.loungeVisitValueBrl} ÷ 12), seguro viagem (R$${roundMoney(insuranceValue)}/mês) e concierge (R$${roundMoney(conciergeValue)}/mês) ponderados pela frequência de viagem.`,
      loungeGate.note ?? annualLounge.note
    ),
    makeComponent(
      "fee",
      "Mensalidade efetiva",
      -effectiveMonthlyFee,
      "Anuidade dividida por 12 após isenções estruturadas."
    ),
    makeComponent(
      "international",
      "Custo internacional",
      -internationalMonthlyCost,
      "Custo adicional estimado de IOF e spread sobre gasto internacional.",
      spread.note
    ),
  ];

  const roundedNetMonthly = roundMoney(netMonthlyValue);
  const netAnnualValue = netMonthlyValue * 12;
  const feeBurden =
    profile.avgMonthlySpendBrl > 0
      ? effectiveAnnualFee / (profile.avgMonthlySpendBrl * 12)
      : null;
  const roiMultiple = effectiveAnnualFee > 0 ? netAnnualValue / effectiveAnnualFee : null;
  const scoreDrivers = [
    `Valor líquido: R$${roundMoney(netMonthlyValue).toLocaleString("pt-BR")}/mês`,
    `Anuidade efetiva: R$${roundMoney(effectiveAnnualFee).toLocaleString("pt-BR")}/ano`,
    `Retorno bruto: R$${roundMoney(grossRewardMonthly).toLocaleString("pt-BR")}/mês`,
    `Benefícios valorizados: R$${roundMoney(intangibleMonthlyValue).toLocaleString("pt-BR")}/mês`,
  ];
  if (internationalMonthlyCost > 0) {
    scoreDrivers.push(
      `Custo internacional: -R$${roundMoney(internationalMonthlyCost).toLocaleString("pt-BR")}/mês`
    );
  }
  const preferenceScoreAdjustment = preferenceAdjustment(profile, {
    pointsRewardMonthlySale,
    cashlikeRewardMonthly,
    loungeValue,
  });
  if (profile.preferences.prefersCashback || profile.preferences.prefersPoints || profile.preferences.wantsLounge) {
    scoreDrivers.push(
      `Preferências aplicadas com peso leve: ${preferenceScoreAdjustment >= 0 ? "+" : ""}${preferenceScoreAdjustment} pts no score`
    );
  }
  const rankReason = !eligibility.eligible
    ? `Bloqueado por elegibilidade: ${eligibilityReasons.join(" ")}`
    : roundedNetMonthly >= 0
      ? `Rankeado por valor líquido positivo de R$${roundedNetMonthly.toLocaleString("pt-BR")}/mês após anuidade e custos.`
      : `Rankeado abaixo por destruir R$${Math.abs(roundedNetMonthly).toLocaleString("pt-BR")}/mês após anuidade e custos.`;
  const verdict =
    !eligibility.eligible
      ? "Não elegível com o perfil informado."
      : roundedNetMonthly > 100
        ? "Forte candidato para este perfil."
        : roundedNetMonthly >= 0
          ? "Pode compensar, dependendo do uso real."
          : "Tende a destruir valor neste perfil.";

  const baseScore = normalizeScore({
    netMonthly: netMonthlyValue,
    eligible: eligibility.eligible,
    grossRewardMonthly,
    intangibleMonthlyValue,
    effectiveMonthlyFee,
    monthlySpend: profile.avgMonthlySpendBrl,
  });
  const adjustedScore = Math.round(
    clamp(
      baseScore + preferenceScoreAdjustment,
      0,
      100
    )
  );

  return {
    card,
    mode,
    eligible: eligibility.eligible,
    eligibilityReasons,
    score0To100: adjustedScore,
    rankReason,
    feeAppliedReason,
    roiMultiple: roiMultiple === null ? null : roundMoney(roiMultiple),
    feeBurdenPctOfAnnualSpend: feeBurden === null ? null : roundMoney(feeBurden * 100),
    scoreDrivers,
    netMonthlyValueBrl: roundedNetMonthly,
    netAnnualValueBrl: roundMoney(netAnnualValue),
    effectiveMonthlyFeeBrl: roundMoney(effectiveMonthlyFee),
    effectiveAnnualFeeBrl: roundMoney(effectiveAnnualFee),
    grossRewardMonthlyBrl: roundMoney(grossRewardMonthly),
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

export function scoreCardValues(
  cards: CardFacet[],
  profile: UserProfile = DEFAULT_SCORING_PROFILE,
  mode: CardScoreMode = "profile",
  assumptions: CardValueAssumptions = DEFAULT_VALUE_ASSUMPTIONS
): CardValueScore[] {
  return cards
    .map((card) => scoreCardValue(card, profile, mode, assumptions))
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.netMonthlyValueBrl - a.netMonthlyValueBrl || b.score0To100 - a.score0To100;
    });
}
