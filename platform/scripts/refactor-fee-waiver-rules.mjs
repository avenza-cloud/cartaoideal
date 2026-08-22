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

function amountForms(value) {
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

  return [...forms];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function amountPattern(value) {
  const forms = amountForms(value).sort((a, b) => b.length - a.length);
  return new RegExp(`(?:R\\$\\s*)?(?:${forms.map(escapeRegExp).join("|")})`, "i");
}

function amountPatternGlobal(value) {
  const forms = amountForms(value).sort((a, b) => b.length - a.length);
  return new RegExp(`(?:R\\$\\s*)?(?:${forms.map(escapeRegExp).join("|")})`, "gi");
}

function isInvalidAmountFragment(text, match) {
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

function firstValidAmountMatch(text, value) {
  for (const match of String(text).matchAll(amountPatternGlobal(value))) {
    if (!isInvalidAmountFragment(String(text), match)) return match;
  }
  return null;
}

function ruleFullWaiverFromContext(text, index, fallback) {
  const { clause, sentence } = contextAround(String(text), index);
  const clauseText = clause.toLowerCase();
  const sentenceText = sentence.toLowerCase();
  const hasPartialInClause = /50%|metade|parcial/.test(clauseText);
  const hasFullSpecificInClause = /100%|isen[cç][aã]o total|isencao total|gratuit|sem anuidade|zero/.test(clauseText);
  const hasFullInClause = hasFullSpecificInClause || /isenta|isento/.test(clauseText);
  if (hasPartialInClause && !hasFullSpecificInClause) return false;
  if (hasFullInClause && !hasPartialInClause) return true;

  const hasPartialInSentence = /50%|metade|parcial/.test(sentenceText);
  const hasFullSpecificInSentence = /100%|isen[cç][aã]o total|isencao total|gratuit|sem anuidade|zero/.test(sentenceText);
  const hasFullInSentence = hasFullSpecificInSentence || /isenta|isento/.test(sentenceText);
  if (hasPartialInSentence && !hasFullSpecificInSentence) return false;
  if (hasFullInSentence && !hasPartialInSentence) return true;
  return fallback;
}

function capturedAmountIndex(match) {
  const offset = match[0].lastIndexOf(match[1]);
  return (match.index ?? 0) + Math.max(offset, 0);
}

function contextAround(text, index) {
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

  return { clause, sentence };
}

function thresholdMatchesCategory(text, value, category) {
  if (typeof value !== "number") return false;
  const source = String(text);
  for (const match of source.matchAll(amountPatternGlobal(value))) {
    if (isInvalidAmountFragment(source, match)) continue;

    const { clause, sentence } = contextAround(source, match.index);
    const hasSpendInClause = /gastos?|faturas?|compras|despesas/i.test(clause);
    const hasInvestInClause = /invest|patrim[oô]nio|aplica/i.test(clause);
    const hasSpendInSentence = /gastos?|faturas?|compras|despesas/i.test(sentence);
    const hasInvestInSentence = /invest|patrim[oô]nio|aplica/i.test(sentence);
    const isFeeAmount = /valor da anuidade|anuidade será|anuidade de até|anuidade:?/i.test(clause);
    const isProgressiveDiscount =
      /desconto|mensalidade|valor total/i.test(clause) &&
      !/100%|isen[cç][aã]o total|isencao total|gratuit|sem anuidade/i.test(clause);
    if (isProgressiveDiscount) continue;

    if (category === "monthly_spend") {
      if (hasInvestInClause && !hasSpendInClause) continue;
      if (hasSpendInClause) return true;
      if (!isFeeAmount && hasSpendInSentence && !hasInvestInSentence) return true;
      continue;
    }

    if (hasSpendInClause && !hasInvestInClause) continue;
    if (hasInvestInClause) return true;
    if (!isFeeAmount && hasInvestInSentence && !hasSpendInSentence) return true;
  }
  return false;
}

function pushUnique(rules, rule) {
  const key = `${rule.category}:${rule.threshold_brl ?? "none"}:${rule.period ?? "none"}`;
  const existing = rules.find((item) => `${item.category}:${item.threshold_brl ?? "none"}:${item.period ?? "none"}` === key);
  if (existing) {
    Object.assign(existing, rule);
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
    if (typeof threshold === "number" && thresholdMatchesCategory(text, threshold, "monthly_spend")) {
      const match = firstValidAmountMatch(text, threshold);
      pushUnique(rules, {
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver: ruleFullWaiverFromContext(text, match?.index ?? 0, full_waiver),
        description: "Gasto mensal mínimo",
        raw_text: text,
      });
    }
  }
  for (const threshold of policy.investment_thresholds_brl ?? []) {
    if (typeof threshold === "number" && thresholdMatchesCategory(text, threshold, "investment")) {
      const match = firstValidAmountMatch(text, threshold);
      pushUnique(rules, {
        category: "investment",
        threshold_brl: threshold,
        full_waiver: ruleFullWaiverFromContext(text, match?.index ?? 0, full_waiver),
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

  for (const match of raw_text.matchAll(/R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?[^.\n]{0,90}?(?:gastos?|fatura)[^.\n]{0,90}?isen[cç][aã]o total/gi)) {
    const threshold = parseAmount(match[1], match[2]);
    if (threshold !== null) {
      pushUnique(rules, {
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver: true,
        description: "Gasto mensal mínimo",
        raw_text,
      });
    }
  }

  for (const match of raw_text.matchAll(/R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?(?:(?!R\$).){0,60}?isen[cç][aã]o\s+de\s+50%/gi)) {
    const threshold = parseAmount(match[1], match[2]);
    if (threshold !== null) {
      pushUnique(rules, {
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver: false,
        description: "Gasto mensal mínimo",
        raw_text,
      });
    }
  }

  for (const pattern of investmentPatterns) {
    for (const match of raw_text.matchAll(pattern)) {
      if (/gastos?|fatura|compras|despesas/i.test(match[0])) continue;
      const amountIndex = capturedAmountIndex(match);
      if (!thresholdMatchesCategory(raw_text, parseAmount(match[1], match[2]), "investment")) continue;
      const threshold = parseAmount(match[1], match[2]);
      if (threshold !== null) {
        pushUnique(rules, {
          category: "investment",
          threshold_brl: threshold,
          full_waiver: ruleFullWaiverFromContext(raw_text, amountIndex, full_waiver),
          description: "Investimento mínimo",
          raw_text,
        });
      }
    }
  }

  for (const pattern of spendPatterns) {
    for (const match of raw_text.matchAll(pattern)) {
      if (/invest/i.test(match[0])) continue;
      const amountIndex = capturedAmountIndex(match);
      if (!thresholdMatchesCategory(raw_text, parseAmount(match[1], match[2]), "monthly_spend")) continue;
      const threshold = parseAmount(match[1], match[2]);
      if (threshold !== null) {
        pushUnique(rules, {
          category: "monthly_spend",
          threshold_brl: threshold,
          period: "monthly",
          full_waiver: ruleFullWaiverFromContext(raw_text, amountIndex, full_waiver),
          description: "Gasto mensal mínimo",
          raw_text,
        });
      }
    }
  }

  for (const match of raw_text.matchAll(/(?:R\$\s*)?(\d[\d.]*(?:,\d+)?)(?:\s*(mil(?:hões?)?))?/gi)) {
    if (raw_text[match.index + match[0].length] === "%") continue;
    if (isInvalidAmountFragment(raw_text, match)) continue;
    const threshold = parseAmount(match[1], match[2]);
    if (threshold === null) continue;
    const amountIndex = capturedAmountIndex(match);

    if (thresholdMatchesCategory(raw_text, threshold, "monthly_spend")) {
      pushUnique(rules, {
        category: "monthly_spend",
        threshold_brl: threshold,
        period: "monthly",
        full_waiver: ruleFullWaiverFromContext(raw_text, amountIndex, full_waiver),
        description: "Gasto mensal mínimo",
        raw_text,
      });
    }

    if (thresholdMatchesCategory(raw_text, threshold, "investment")) {
      pushUnique(rules, {
        category: "investment",
        threshold_brl: threshold,
        full_waiver: ruleFullWaiverFromContext(raw_text, amountIndex, full_waiver),
        description: "Investimento mínimo",
        raw_text,
      });
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
    applySpecificWaiverHints(parsedRules);
    return parsedRules;
  }

  const rules = [...semanticRules];
  for (const rule of parsedRules) {
    pushUnique(rules, rule);
  }
  applySpecificWaiverHints(rules);
  return rules;
}

function amountNearPattern(value, tailPattern) {
  const forms = amountForms(value).sort((a, b) => b.length - a.length);
  return new RegExp(`(?:R\\$\\s*)?(?:${forms.map(escapeRegExp).join("|")})(?:(?!R\\$).){0,70}?${tailPattern}`, "i");
}

function applySpecificWaiverHints(rules) {
  for (const rule of rules) {
    if (typeof rule.threshold_brl !== "number") continue;
    if (amountNearPattern(rule.threshold_brl, "isen[cç][aã]o\\s+de\\s+50%").test(rule.raw_text)) {
      rule.full_waiver = false;
    }
    if (amountNearPattern(rule.threshold_brl, "isen[cç][aã]o\\s+total").test(rule.raw_text)) {
      rule.full_waiver = true;
    }
  }
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
