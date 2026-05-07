import fs from "node:fs";

const FACETS_PATH = "platform/data/cards_brazil_ai_comparison_facets.json";
const CATALOG_PATH = "platform/data/cards_brazil_catalog_v2.json";

function parseAmount(numStr, suffix = "") {
  const raw = Number.parseFloat(String(numStr).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(raw)) return null;
  const normalizedSuffix = suffix.toLowerCase();
  if (normalizedSuffix.startsWith("milh")) return raw * 1_000_000;
  if (normalizedSuffix === "mil") return raw * 1_000;
  return raw;
}

function rawWaiverTextFromCatalog(card) {
  return (
    card.semantic_audit?.normalized_claims?.annual_fee?.waiver_policy?.raw_text ??
    card.fees?.waiver_and_discounts?.policy_text ??
    card.raw_source_snapshot?.benefit_sections?.["Política de isenção da anuidade"]?.[0] ??
    card.benefits?.characteristics?.find((item) => item.key === "fee_waiver")?.value ??
    ""
  );
}

function rawWaiverTextFromFacet(card) {
  return card.characteristics?.find((item) => item.key === "fee_waiver")?.value ?? "";
}

function fullWaiverFromText(text) {
  return /100%|isenc|isent|gratuit|sem anuidade|zero/i.test(text);
}

function thresholdAppearsInText(text, value) {
  if (typeof value !== "number") return false;
  const normalized = String(text).toLowerCase();
  const forms = new Set([
    String(value),
    value.toLocaleString("pt-BR"),
  ]);

  const thousands = value / 1000;
  if (Number.isInteger(thousands)) {
    forms.add(`${thousands} mil`);
  } else {
    forms.add(`${thousands.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mil`);
    const whole = Math.floor(thousands);
    const remainder = value - whole * 1000;
    if (whole > 0 && remainder > 0) {
      forms.add(`${whole} mil e ${remainder}`);
    }
  }

  const millions = value / 1_000_000;
  if (value >= 1_000_000) {
    forms.add(`${millions.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} milhão`);
    forms.add(`${millions.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} milhões`);
  }

  return [...forms].some((form) => normalized.includes(form.toLowerCase()));
}

function pushUnique(rules, rule) {
  const key = `${rule.category}:${rule.threshold_brl ?? "none"}:${rule.period ?? "none"}`;
  if (rules.some((existing) => `${existing.category}:${existing.threshold_brl ?? "none"}:${existing.period ?? "none"}` === key)) {
    return;
  }
  rules.push(rule);
}

function rulesFromSemanticAudit(card, text) {
  const policy = card.semantic_audit?.normalized_claims?.annual_fee?.waiver_policy;
  if (!policy) return [];

  const rules = [];
  const full_waiver = fullWaiverFromText(text) || policy.has_full_waiver === true;
  for (const threshold of policy.spend_thresholds_brl ?? []) {
    if (typeof threshold === "number" && thresholdAppearsInText(text, threshold)) {
      pushUnique(rules, {
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver,
        description: "Gasto mensal mínimo",
        raw_text: text,
      });
    }
  }
  for (const threshold of policy.investment_thresholds_brl ?? []) {
    if (typeof threshold === "number" && thresholdAppearsInText(text, threshold)) {
      pushUnique(rules, {
        category: "investment",
        threshold_brl: threshold,
        full_waiver,
        description: "Investimento mínimo",
        raw_text: text,
      });
    }
  }
  return rules;
}

function hasCrossedSpendInvestmentThresholds(rules) {
  const spend = new Set(
    rules
      .filter((rule) => rule.category === "monthly_spend")
      .map((rule) => rule.threshold_brl)
      .filter((value) => typeof value === "number")
  );
  return rules
    .filter((rule) => rule.category === "investment")
    .some((rule) => spend.has(rule.threshold_brl));
}

function rulesFromText(text) {
  const raw_text = String(text ?? "").trim();
  if (!raw_text || raw_text === "unknown" || /^não há/i.test(raw_text)) return [];

  const full_waiver = fullWaiverFromText(raw_text);
  const rules = [];
  const investmentPatterns = [
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+(?:em|de|dos?|nos?)\s+(?:fundos?\s+(?:de|dos?)\s+)?investimento/gi,
    /investimento[^.\n]{0,80}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)/gi,
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+investidos?/gi,
    /investimentos?\s+(?:acima|superiores?|a partir)\s+de\s+([\d.,]+)\s*(mil(?:hões?)?)?\s+reais/gi,
  ];
  const spendPatterns = [
    /(?:gastos?|fatura|compras|despesas)[^.\n]{0,80}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)/gi,
    /R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?[^.\n]{0,50}?(?:por mês|mensais|mensal|fatura|gastos?|compras|despesas)/gi,
  ];

  for (const pattern of investmentPatterns) {
    for (const match of raw_text.matchAll(pattern)) {
      if (/gastos?|fatura|compras|despesas/i.test(match[0])) continue;
      const threshold = parseAmount(match[1], match[2]);
      if (threshold !== null) {
        pushUnique(rules, {
          category: "investment",
          threshold_brl: threshold,
          full_waiver,
          description: "Investimento mínimo",
          raw_text,
        });
      }
    }
  }

  for (const pattern of spendPatterns) {
    for (const match of raw_text.matchAll(pattern)) {
      if (/invest/i.test(match[0])) continue;
      const threshold = parseAmount(match[1], match[2]);
      if (threshold !== null) {
        pushUnique(rules, {
          category: "monthly_spend",
          threshold_brl: threshold,
          period: "monthly",
          full_waiver,
          description: "Gasto mensal mínimo",
          raw_text,
        });
      }
    }
  }

  const isAlwaysFree =
    /^sem anuidade/i.test(raw_text) ||
    /^anuidade isenta para todos/i.test(raw_text) ||
    /^todos os clientes são isentos/i.test(raw_text) ||
    /^não há anuidade/i.test(raw_text);

  if (isAlwaysFree && rules.length === 0) {
    pushUnique(rules, {
      category: "general",
      full_waiver: true,
      description: "Isento para todos os clientes",
      raw_text,
    });
  }

  if (
    /invest/i.test(raw_text) &&
    /(isenc|isent|gratuit|anuidade|100%)/i.test(raw_text) &&
    !rules.some((rule) => rule.category === "investment")
  ) {
    pushUnique(rules, {
      category: "investment",
      full_waiver,
      description: "Investimento mínimo não informado",
      raw_text,
    });
  }

  if (/cashback/i.test(raw_text) && /(100%|isenc|isent|gratuit|anuidade)/i.test(raw_text)) {
    const fullCashbackMatch = raw_text.match(/100%[^.\n]{0,80}?cashback[^.\n]{0,80}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?/i);
    const threshold = fullCashbackMatch ? parseAmount(fullCashbackMatch[1], fullCashbackMatch[2]) : null;
    pushUnique(rules, {
      category: "cashback",
      ...(threshold !== null ? { threshold_brl: threshold, period: "monthly" } : {}),
      full_waiver,
      description: "Cashback da anuidade",
      raw_text,
    });
  }

  if (/(milhas|miles)/i.test(raw_text) && /(isenc|isent|gratuit|anuidade)/i.test(raw_text)) {
    pushUnique(rules, {
      category: "miles",
      full_waiver,
      description: "Condição por milhas",
      raw_text,
    });
  }

  return rules;
}

function rulesForCatalogCard(card) {
  const text = rawWaiverTextFromCatalog(card);
  const semanticRules = rulesFromSemanticAudit(card, text);
  const parsedRules = rulesFromText(text);
  if (
    hasCrossedSpendInvestmentThresholds(semanticRules) &&
    parsedRules.some((rule) => rule.category === "monthly_spend") &&
    parsedRules.some((rule) => rule.category === "investment")
  ) {
    return parsedRules;
  }

  const rules = [...semanticRules];
  for (const rule of parsedRules) {
    if (
      semanticRules.length > 0 &&
      (rule.category === "monthly_spend" || rule.category === "investment")
    ) {
      continue;
    }
    pushUnique(rules, rule);
  }
  return rules;
}

function syncSemanticWaiverPolicy(card, rules) {
  const policy = card.semantic_audit?.normalized_claims?.annual_fee?.waiver_policy;
  if (!policy) return;

  policy.investment_thresholds_brl = rules
    .filter((rule) => rule.category === "investment" && typeof rule.threshold_brl === "number")
    .map((rule) => rule.threshold_brl);
  policy.spend_thresholds_brl = rules
    .filter((rule) => rule.category === "monthly_spend" && typeof rule.threshold_brl === "number")
    .map((rule) => rule.threshold_brl);
  policy.has_full_waiver = rules.some((rule) => rule.full_waiver);
}

function main() {
  const facets = JSON.parse(fs.readFileSync(FACETS_PATH, "utf8"));
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const catalogRulesById = new Map();

  let catalogCardsWithRules = 0;
  for (const card of catalog.cards) {
    const text = rawWaiverTextFromCatalog(card);
    const rules = rulesForCatalogCard(card);
    if (rules.length > 0) {
      catalogCardsWithRules += 1;
      syncSemanticWaiverPolicy(card, rules);
      card.fees.waiver_and_discounts = {
        ...(card.fees.waiver_and_discounts ?? {}),
        policy_text: text,
        rules,
        has_full_waiver_option: rules.some((rule) => rule.full_waiver),
      };
      catalogRulesById.set(card.identity.stable_id, rules);
    } else if (card.fees.waiver_and_discounts?.rules) {
      delete card.fees.waiver_and_discounts.rules;
    }
  }

  let facetCardsWithRules = 0;
  for (const card of facets.cards) {
    const text = rawWaiverTextFromFacet(card);
    const rules = catalogRulesById.get(card.card_stable_id) ?? rulesFromText(text);
    if (rules.length > 0) {
      facetCardsWithRules += 1;
      card.fee_waiver_rules = rules;
    } else {
      delete card.fee_waiver_rules;
    }
  }

  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(FACETS_PATH, `${JSON.stringify(facets, null, 2)}\n`);

  console.log(`Catalog cards with structured fee waiver rules: ${catalogCardsWithRules}`);
  console.log(`Facet cards with structured fee waiver rules: ${facetCardsWithRules}`);
}

main();
