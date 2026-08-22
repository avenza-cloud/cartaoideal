import type { FeeWaiverRule } from "@/types/cards";

function parseAmount(numStr: string, suffix?: string): number {
  const raw = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(raw)) return NaN;
  const s = (suffix ?? "").toLowerCase();
  if (s.startsWith("milh")) return raw * 1_000_000;
  if (s === "mil") return raw * 1_000;
  return raw;
}

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
    if (!Number.isNaN(threshold)) {
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
    if (!Number.isNaN(threshold)) {
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

  return rules;
}
