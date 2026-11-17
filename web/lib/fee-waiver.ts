import type { CardFacet, FeeWaiverRule } from "@/types/cards";

function parseAmount(numStr: string, suffix?: string): number {
  const raw = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(raw)) return NaN;
  const s = (suffix ?? "").toLowerCase();
  if (s.startsWith("milh")) return raw * 1_000_000;
  if (s === "mil") return raw * 1_000;
  return raw;
}

const MERCHANT_SPECIFIC_SPEND =
  /\b(?:vivo|extra|p[aã]o de a[cç][uú]car|magalu|magazine luiza|amazon|mercado livre|carrefour|assa[ií]|lojas?|e-commerce|posto)\b/i;

function contextAllowsCategory(
  text: string,
  matchText: string,
  index: number,
  category: "monthly_spend" | "investment"
) {
  const beforeSentence = Math.max(text.lastIndexOf(".", index), text.lastIndexOf(";", index));
  const afterDot = text.indexOf(".", index);
  const afterSemi = text.indexOf(";", index);
  const afterSentenceCandidates = [afterDot, afterSemi].filter((value) => value !== -1);
  const afterSentence =
    afterSentenceCandidates.length > 0 ? Math.min(...afterSentenceCandidates) : text.length;
  const sentence = text.slice(beforeSentence + 1, afterSentence);

  const beforeClause = Math.max(
    text.lastIndexOf(",", index),
    text.lastIndexOf(" ou ", index),
    text.lastIndexOf(" e ", index),
    beforeSentence
  );
  const afterComma = text.indexOf(",", index);
  const afterOu = text.indexOf(" ou ", index);
  const afterE = text.indexOf(" e ", index);
  const afterClauseCandidates = [afterComma, afterOu, afterE, afterSentence].filter(
    (value) => value !== -1
  );
  const afterClause = Math.min(...afterClauseCandidates);
  const clause = text.slice(beforeClause + 1, afterClause) || matchText;

  const hasSpendInClause = /gastos?|faturas?|compras|despesas/i.test(clause);
  const hasInvestInClause = /invest|patrim[oô]nio|aplica/i.test(clause);
  const hasSpendInSentence = /gastos?|faturas?|compras|despesas/i.test(sentence);
  const hasInvestInSentence = /invest|patrim[oô]nio|aplica/i.test(sentence);
  const isFeeAmount = /valor da anuidade|anuidade será|anuidade de até|anuidade:?/i.test(clause);
  const isProgressiveDiscount =
    /desconto|mensalidade|valor total/i.test(clause) &&
    !/100%|isen[cç][aã]o total|isencao total|gratuit|sem anuidade/i.test(clause);
  if (isProgressiveDiscount) return false;

  if (category === "monthly_spend") {
    // "R$ 350 em compras Vivo": meta em parceiro, não gasto geral no cartão.
    if (MERCHANT_SPECIFIC_SPEND.test(sentence)) return false;
    if (hasInvestInClause && !hasSpendInClause) return false;
    if (hasSpendInClause) return true;
    return !isFeeAmount && hasSpendInSentence && !hasInvestInSentence;
  }

  if (hasSpendInClause && !hasInvestInClause) return false;
  if (hasInvestInClause) return true;
  return !isFeeAmount && hasInvestInSentence && !hasSpendInSentence;
}

function ruleFullWaiverFromContext(text: string, index: number, fallback: boolean) {
  const beforeSentence = Math.max(text.lastIndexOf(".", index), text.lastIndexOf(";", index));
  const afterDot = text.indexOf(".", index);
  const afterSemi = text.indexOf(";", index);
  const afterSentenceCandidates = [afterDot, afterSemi].filter((value) => value !== -1);
  const afterSentence =
    afterSentenceCandidates.length > 0 ? Math.min(...afterSentenceCandidates) : text.length;
  const sentence = text.slice(beforeSentence + 1, afterSentence);

  const beforeClause = Math.max(
    text.lastIndexOf(",", index),
    text.lastIndexOf(" ou ", index),
    text.lastIndexOf(" e ", index),
    beforeSentence
  );
  const afterComma = text.indexOf(",", index);
  const afterOu = text.indexOf(" ou ", index);
  const afterE = text.indexOf(" e ", index);
  const afterClauseCandidates = [afterComma, afterOu, afterE, afterSentence].filter(
    (value) => value !== -1
  );
  const afterClause = Math.min(...afterClauseCandidates);
  const clause = text.slice(beforeClause + 1, afterClause);
  const clauseText = clause.toLowerCase();
  const sentenceText = sentence.toLowerCase();
  const hasPartialInClause = /50%|metade|parcial/.test(clauseText);
  const hasFullSpecificInClause =
    /100%|isen[cç][aã]o total|isencao total|gratuit|sem anuidade|zero/.test(clauseText);
  const hasFullInClause = hasFullSpecificInClause || /isenta|isento/.test(clauseText);
  if (hasPartialInClause && !hasFullSpecificInClause) return false;
  if (hasFullInClause && !hasPartialInClause) return true;

  const hasPartialInSentence = /50%|metade|parcial/.test(sentenceText);
  const hasFullSpecificInSentence =
    /100%|isen[cç][aã]o total|isencao total|gratuit|sem anuidade|zero/.test(sentenceText);
  const hasFullInSentence = hasFullSpecificInSentence || /isenta|isento/.test(sentenceText);
  if (hasPartialInSentence && !hasFullSpecificInSentence) return false;
  if (hasFullInSentence && !hasPartialInSentence) return true;
  return fallback;
}

function capturedAmountIndex(match: RegExpMatchArray) {
  const offset = match[0].lastIndexOf(match[1]);
  return (match.index ?? 0) + Math.max(offset, 0);
}

function isInvalidAmountFragment(text: string, match: RegExpMatchArray) {
  const start = match.index ?? 0;
  const end = start + match[0].length;
  const before = text.slice(Math.max(0, start - 8), start);
  const after = text.slice(end, end + 14);
  if (/[A-Za-zÀ-ÿ\d.,]/.test(text[start - 1] ?? "")) return true;
  if (/[A-Za-zÀ-ÿ\d.,]/.test(text[end] ?? "")) return true;
  if (/mil\s+e\s*$/i.test(before)) return true;
  if (!/\bmil/i.test(match[0]) && /^\s*mil/i.test(after)) return true;
  if (/\bmil\s*$/i.test(match[0]) && /^\s+e\s+\d/i.test(after)) return true;
  return false;
}

/**
 * Extracts the investment-specific threshold (in BRL) from a fee waiver text.
 *
 * Uses three patterns to handle the different sentence structures found in real data:
 *   A) "R$ X mil em investimento(s)" — amount before keyword (most common)
 *   B) "investimento(s) … R$ X mil"  — amount after keyword (Safra, BTG, XP, etc.)
 *   C) "R$ X mil investidos"          — BTG Pactual-style
 *
 * Returns null if no investment clause is found (e.g. gasto-only waiver text).
 */
export function extractInvestmentThreshold(texto: string): number | null {
  let m: RegExpMatchArray | null;

  // Pattern A: "R$ X [mil/milhões] em/de [fundos de] investimento(s)"
  // e.g. "R$ 20 mil em investimentos", "R$ 100 mil em fundos de investimento"
  m = texto.match(
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+(?:em|de|dos?|nos?)\s+(?:fundos?\s+(?:de|dos?)\s+)?investimento/i
  );
  if (m) {
    const v = parseAmount(m[1], m[2]);
    if (!Number.isNaN(v)) return v;
  }

  // Pattern B: "investimento(s) [up to ~60 chars] R$ X [mil/milhões]"
  // e.g. "investimentos acima de R$ 5 milhões", "investimentos superiores a R$ 100 mil"
  m = texto.match(/investimento[^.\n]{0,60}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)/i);
  if (m) {
    const v = parseAmount(m[1], m[2]);
    if (!Number.isNaN(v)) return v;
  }

  // Pattern C: "R$ X [mil] investidos" — BTG Pactual style
  // e.g. "R$ 10.000 investidos no BTG"
  m = texto.match(/R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+investidos?/i);
  if (m) {
    const v = parseAmount(m[1], m[2]);
    if (!Number.isNaN(v)) return v;
  }

  return null;
}

export function extractFeeWaiverRules(texto: string): FeeWaiverRule[] {
  const raw = texto.trim();
  if (!raw || raw === "unknown") return [];

  const fullWaiver = /100%|isenc|isent|gratuit|sem anuidade|zero/i.test(raw);
  const rules: FeeWaiverRule[] = [];
  const seen = new Set<string>();

  function add(rule: FeeWaiverRule) {
    const key = `${rule.category}:${rule.threshold_brl ?? "none"}:${rule.period ?? "none"}`;
    if (seen.has(key)) {
      const existing = rules.find(
        (item) =>
          `${item.category}:${item.threshold_brl ?? "none"}:${item.period ?? "none"}` === key
      );
      if (existing) Object.assign(existing, rule);
      return;
    }
    seen.add(key);
    rules.push(rule);
  }

  const investmentPatterns = [
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+(?:em|de|dos?|nos?)\s+(?:fundos?\s+(?:de|dos?)\s+)?investimento/gi,
    /investimento[^.\n]{0,80}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)/gi,
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+investidos?/gi,
    /investimentos?\s+(?:acima|superiores?|a partir)\s+de\s+([\d.,]+)\s*(mil(?:hões?)?)?\s+reais/gi,
  ];

  for (const pattern of investmentPatterns) {
    for (const match of raw.matchAll(pattern)) {
      if (/gastos?|fatura|compras|despesas/i.test(match[0])) continue;
      const amountIndex = capturedAmountIndex(match);
      if (!contextAllowsCategory(raw, match[0], amountIndex, "investment")) continue;
      const threshold = parseAmount(match[1], match[2]);
      if (!Number.isNaN(threshold)) {
        add({
          category: "investment",
          threshold_brl: threshold,
          full_waiver: ruleFullWaiverFromContext(raw, amountIndex, fullWaiver),
          description: "Investimento mínimo",
          raw_text: raw,
        });
      }
    }
  }

  const spendPatterns = [
    /(?:gastos?|fatura|compras|despesas)[^.\n]{0,80}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)/gi,
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?[^.\n]{0,50}?(?:por mês|mensais|mensal|fatura|gastos?|compras|despesas)/gi,
  ];

  for (const match of raw.matchAll(
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?[^.\n]{0,90}?(?:gastos?|fatura)[^.\n]{0,90}?isen[cç][aã]o total/gi
  )) {
    const threshold = parseAmount(match[1], match[2]);
    if (!Number.isNaN(threshold) && !MERCHANT_SPECIFIC_SPEND.test(match[0])) {
      add({
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver: true,
        description: "Gasto mensal mínimo",
        raw_text: raw,
      });
    }
  }

  for (const match of raw.matchAll(
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?(?:(?!R\$).){0,60}?isen[cç][aã]o\s+de\s+50%/gi
  )) {
    const threshold = parseAmount(match[1], match[2]);
    if (!Number.isNaN(threshold) && !MERCHANT_SPECIFIC_SPEND.test(match[0])) {
      add({
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver: false,
        description: "Gasto mensal mínimo",
        raw_text: raw,
      });
    }
  }

  for (const pattern of spendPatterns) {
    for (const match of raw.matchAll(pattern)) {
      if (/invest/i.test(match[0])) continue;
      const amountIndex = capturedAmountIndex(match);
      if (!contextAllowsCategory(raw, match[0], amountIndex, "monthly_spend")) continue;
      const threshold = parseAmount(match[1], match[2]);
      if (!Number.isNaN(threshold)) {
        add({
          category: "monthly_spend",
          threshold_brl: threshold,
          period: "monthly",
          full_waiver: ruleFullWaiverFromContext(raw, amountIndex, fullWaiver),
          description: "Gasto mensal mínimo",
          raw_text: raw,
        });
      }
    }
  }

  for (const match of raw.matchAll(/(?:R\$\s*)?(\d[\d.]*(?:,\d+)?)(?:\s*(mil(?:hões?)?))?/gi)) {
    if (raw[(match.index ?? 0) + match[0].length] === "%") continue;
    if (isInvalidAmountFragment(raw, match)) continue;
    const threshold = parseAmount(match[1], match[2]);
    if (!Number.isFinite(threshold)) continue;
    const amountIndex = capturedAmountIndex(match);

    if (contextAllowsCategory(raw, match[0], amountIndex, "monthly_spend")) {
      add({
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver: ruleFullWaiverFromContext(raw, amountIndex, fullWaiver),
        description: "Gasto mensal mínimo",
        raw_text: raw,
      });
    }

    if (contextAllowsCategory(raw, match[0], amountIndex, "investment")) {
      add({
        category: "investment",
        threshold_brl: threshold,
        full_waiver: ruleFullWaiverFromContext(raw, amountIndex, fullWaiver),
        description: "Investimento mínimo",
        raw_text: raw,
      });
    }
  }

  const isAlwaysFree =
    /^sem anuidade/i.test(raw) ||
    /^anuidade isenta para todos/i.test(raw) ||
    /^todos os clientes são isentos/i.test(raw) ||
    /^não há anuidade/i.test(raw);

  if (isAlwaysFree && rules.length === 0) {
    add({
      category: "general",
      full_waiver: true,
      description: "Isento para todos os clientes",
      raw_text: raw,
    });
  }

  if (
    /invest/i.test(raw) &&
    /(isenc|isent|gratuit|anuidade|100%)/i.test(raw) &&
    !rules.some((rule) => rule.category === "investment")
  ) {
    add({
      category: "investment",
      full_waiver: fullWaiver,
      description: "Investimento mínimo não informado",
      raw_text: raw,
    });
  }

  if (/cashback/i.test(raw) && /(100%|isenc|isent|gratuit|anuidade)/i.test(raw)) {
    const fullCashbackMatch = raw.match(
      /100%[^.\n]{0,80}?cashback[^.\n]{0,80}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?/i
    );
    const threshold = fullCashbackMatch
      ? parseAmount(fullCashbackMatch[1], fullCashbackMatch[2])
      : NaN;
    add({
      category: "cashback",
      threshold_brl: Number.isFinite(threshold) ? threshold : undefined,
      period: Number.isFinite(threshold) ? "monthly" : undefined,
      full_waiver: fullWaiver,
      description: "Cashback da anuidade",
      raw_text: raw,
    });
  }

  if (/(milhas|miles)/i.test(raw) && /(isenc|isent|gratuit|anuidade)/i.test(raw)) {
    add({
      category: "miles",
      full_waiver: fullWaiver,
      description: "Condição por milhas",
      raw_text: raw,
    });
  }

  // "cumprir dois dos seguintes critérios": cada condição sozinha não basta.
  const minConditions = minConditionsFromText(raw);
  if (minConditions !== null) {
    for (const rule of rules) {
      if (rule.category === "monthly_spend" || rule.category === "investment") {
        rule.min_conditions = minConditions;
      }
    }
  }

  return rules;
}

const COUNT_WORDS: Record<string, number> = { dois: 2, duas: 2, "2": 2, tres: 3, três: 3, "3": 3 };

function minConditionsFromText(text: string): number | null {
  const match = text.match(
    /\b(dois|duas|2|tr[eê]s|3)\s+(?:d[oa]s|crit[eé]rios|condi[cç][oõ]es)\b[^.]{0,20}?(?:seguintes|crit[eé]rios|condi[cç][oõ]es)/i
  );
  if (!match) return null;
  return COUNT_WORDS[match[1].toLowerCase()] ?? null;
}

// ─── Fonte única de regras e de avaliação de isenção ───────────────────────
// Score (card-value), badges (fee-waiver-badges) e chat (filter-cards →
// getCardFeeWaiver) usam estas funções, então não podem divergir.

/** Texto de isenção do cartão (valor + detalhes da característica `fee_waiver`). */
export function feeWaiverText(card: CardFacet): string {
  const char = card.characteristics?.find((item) => item.key === "fee_waiver");
  if (!char || char.value === "unknown") return "";
  return `${String(char.value)} ${char.details ?? ""}`.trim();
}

/** Regras estruturadas do cartão; sem elas, as regras extraídas do texto de isenção. */
export function feeWaiverRulesForCard(card: CardFacet): FeeWaiverRule[] {
  if (card.fee_waiver_rules?.length) return card.fee_waiver_rules;
  return extractFeeWaiverRules(feeWaiverText(card));
}

export type FeeWaiverRuleStatus = "met" | "not_met" | "not_evaluable";

export interface FeeWaiverProfile {
  avgMonthlySpendBrl: number;
  avgInvestedBrl: number;
}

/** "Sem anuidade"/"isento para todos": regra geral incondicional (não promoção, não programa). */
function isUnconditionalGeneralRule(rule: FeeWaiverRule): boolean {
  const text = `${rule.description} ${rule.raw_text}`.toLowerCase();
  if (/primeir[oa]s?\s+\d|per[ií]odo|introdut|promo|n[ií]vel|programa|pontua/.test(text)) {
    return false;
  }
  return /sem anuidade|todos os clientes|para todos|gr[aá]tis|gratuit|n[aã]o h[aá] anuidade|sem custo/.test(
    text
  );
}

/** Situação de uma regra para o perfil. Condições que o perfil não coleta são "not_evaluable". */
export function feeWaiverRuleStatus(
  rule: FeeWaiverRule,
  profile: FeeWaiverProfile
): FeeWaiverRuleStatus {
  switch (rule.category) {
    case "monthly_spend":
      if (typeof rule.threshold_brl !== "number") return "not_evaluable";
      return profile.avgMonthlySpendBrl >= rule.threshold_brl ? "met" : "not_met";
    case "cashback":
      // "Cashback da anuidade" com meta mensal de fatura é uma isenção por gasto.
      if (typeof rule.threshold_brl !== "number" || rule.period !== "monthly") {
        return "not_evaluable";
      }
      return profile.avgMonthlySpendBrl >= rule.threshold_brl ? "met" : "not_met";
    case "investment":
      if (typeof rule.threshold_brl !== "number") return "not_evaluable";
      return profile.avgInvestedBrl >= rule.threshold_brl ? "met" : "not_met";
    case "general":
      return rule.full_waiver && isUnconditionalGeneralRule(rule) ? "met" : "not_evaluable";
    default:
      // subscription, miles, pix_key, promotional_period: o perfil não coleta.
      return "not_evaluable";
  }
}

/** Menor percentual (1–99) citado na regra: "5% de isenção … ou 100% …" → 5. */
function partialPercentFromText(rule: FeeWaiverRule): number | null {
  const text = `${rule.description} ${rule.raw_text}`;
  const pcts = [...text.matchAll(/(\d+(?:[,.]\d+)?)\s*%/g)]
    .map((m) => Number(m[1].replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100);
  return pcts.length > 0 ? Math.min(...pcts) : null;
}

/**
 * Anuidade anual depois de aplicar a regra (já atendida), ou null quando o
 * efeito de uma regra parcial não é conhecido.
 */
export function feeWaiverRuleEffect(
  rule: FeeWaiverRule,
  baseAnnualFee: number,
  profile: FeeWaiverProfile
): number | null {
  if (rule.full_waiver) return 0;
  if (typeof rule.discount_pct === "number") {
    const pct = Math.min(100, Math.max(0, rule.discount_pct));
    return baseAnnualFee * (1 - pct / 100);
  }
  const phrase = `${rule.description} ${rule.raw_text}`;
  if (
    typeof rule.discount_brl === "number" &&
    rule.period === "monthly" &&
    typeof rule.threshold_brl === "number" &&
    rule.threshold_brl > 0 &&
    /a cada|progressiv/i.test(phrase)
  ) {
    const steps = Math.floor(profile.avgMonthlySpendBrl / rule.threshold_brl);
    return Math.max(0, baseAnnualFee / 12 - steps * rule.discount_brl) * 12;
  }
  const pct = partialPercentFromText(rule);
  if (pct !== null) return baseAnnualFee * (1 - pct / 100);
  if (typeof rule.discount_brl === "number") {
    const annualDiscount = rule.period === "monthly" ? rule.discount_brl * 12 : rule.discount_brl;
    return Math.max(0, baseAnnualFee - annualDiscount);
  }
  return null;
}

export interface FeeWaiverEvaluation {
  /** Anuidade anual depois da melhor regra atendida (igual à base se nenhuma). */
  effectiveAnnualFee: number;
  /** Regra (ou grupo) que produziu a anuidade efetiva. */
  appliedRules: FeeWaiverRule[];
  metRules: FeeWaiverRule[];
  unmetRules: FeeWaiverRule[];
  notEvaluableRules: FeeWaiverRule[];
  /** Regras atendidas cujo desconto não é conhecido (parcial sem valor). */
  unknownEffectRules: FeeWaiverRule[];
}

/**
 * Avalia todas as regras de isenção do cartão para o perfil. Regras com
 * `min_conditions` formam um grupo: o efeito só vale com N critérios atendidos
 * (critérios não avaliáveis contam como não atendidos).
 */
export function evaluateFeeWaiver(
  rules: FeeWaiverRule[],
  baseAnnualFee: number,
  profile: FeeWaiverProfile
): FeeWaiverEvaluation {
  const evaluation: FeeWaiverEvaluation = {
    effectiveAnnualFee: baseAnnualFee,
    appliedRules: [],
    metRules: [],
    unmetRules: [],
    notEvaluableRules: [],
    unknownEffectRules: [],
  };
  if (baseAnnualFee <= 0) return evaluation;

  const consider = (fee: number | null, applied: FeeWaiverRule[]) => {
    if (fee === null || fee >= evaluation.effectiveAnnualFee) return;
    evaluation.effectiveAnnualFee = fee;
    evaluation.appliedRules = applied;
  };

  const groups = new Map<number, FeeWaiverRule[]>();
  for (const rule of rules) {
    const status = feeWaiverRuleStatus(rule, profile);
    if (status === "met") evaluation.metRules.push(rule);
    else if (status === "not_met") evaluation.unmetRules.push(rule);
    else evaluation.notEvaluableRules.push(rule);

    const min = rule.min_conditions ?? 1;
    if (min > 1) {
      groups.set(min, [...(groups.get(min) ?? []), rule]);
      continue;
    }
    if (status !== "met") continue;
    const fee = feeWaiverRuleEffect(rule, baseAnnualFee, profile);
    if (fee === null) evaluation.unknownEffectRules.push(rule);
    consider(fee, [rule]);
  }

  for (const [min, groupRules] of groups) {
    const met = groupRules.filter((rule) => feeWaiverRuleStatus(rule, profile) === "met");
    if (met.length < min) continue;
    const fees = groupRules
      .map((rule) => feeWaiverRuleEffect(rule, baseAnnualFee, profile))
      .filter((fee): fee is number => fee !== null);
    if (fees.length > 0) consider(Math.min(...fees), met);
  }

  return evaluation;
}

/** Descrição curta da condição de uma regra ("gasto mensal de R$ 5.000"). */
export function describeFeeWaiverCondition(rule: FeeWaiverRule): string {
  const amount =
    typeof rule.threshold_brl === "number"
      ? `R$ ${rule.threshold_brl.toLocaleString("pt-BR")}`
      : "";
  if ((rule.category === "monthly_spend" || rule.category === "cashback") && amount) {
    return `gasto mensal de ${amount}`;
  }
  if (rule.category === "investment" && amount) return `investimento de ${amount}`;
  return rule.description.replace(/^crit[eé]rio\s+\d+\s+de\s+\d+:\s*/i, "").toLowerCase();
}
