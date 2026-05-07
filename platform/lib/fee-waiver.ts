import type { FeeWaiverRule } from "@/types/cards";

function parseAmount(numStr: string, suffix?: string): number {
  const raw = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
  if (isNaN(raw)) return NaN;
  const s = (suffix ?? "").toLowerCase();
  if (s.startsWith("milh")) return raw * 1_000_000;
  if (s === "mil") return raw * 1_000;
  return raw;
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
  m = texto.match(/R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+(?:em|de|dos?|nos?)\s+(?:fundos?\s+(?:de|dos?)\s+)?investimento/i);
  if (m) {
    const v = parseAmount(m[1], m[2]);
    if (!isNaN(v)) return v;
  }

  // Pattern B: "investimento(s) [up to ~60 chars] R$ X [mil/milhões]"
  // e.g. "investimentos acima de R$ 5 milhões", "investimentos superiores a R$ 100 mil"
  m = texto.match(/investimento[^.\n]{0,60}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)/i);
  if (m) {
    const v = parseAmount(m[1], m[2]);
    if (!isNaN(v)) return v;
  }

  // Pattern C: "R$ X [mil] investidos" — BTG Pactual style
  // e.g. "R$ 10.000 investidos no BTG"
  m = texto.match(/R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+investidos?/i);
  if (m) {
    const v = parseAmount(m[1], m[2]);
    if (!isNaN(v)) return v;
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
    if (seen.has(key)) return;
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
      const threshold = parseAmount(match[1], match[2]);
      if (!isNaN(threshold)) {
        add({
          category: "investment",
          threshold_brl: threshold,
          full_waiver: fullWaiver,
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

  for (const pattern of spendPatterns) {
    for (const match of raw.matchAll(pattern)) {
      if (/invest/i.test(match[0])) continue;
      const threshold = parseAmount(match[1], match[2]);
      if (!isNaN(threshold)) {
        add({
          category: "monthly_spend",
          threshold_brl: threshold,
          period: "monthly",
          full_waiver: fullWaiver,
          description: "Gasto mensal mínimo",
          raw_text: raw,
        });
      }
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
    const fullCashbackMatch = raw.match(/100%[^.\n]{0,80}?cashback[^.\n]{0,80}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?/i);
    const threshold = fullCashbackMatch ? parseAmount(fullCashbackMatch[1], fullCashbackMatch[2]) : NaN;
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
