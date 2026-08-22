#!/usr/bin/env node
// Applies a community correction (the `json card-correction` block from a
// GitHub issue) to the per-card data file, so the automated PR carries a
// directly mergeable diff.
//
// Usage: node scripts/apply-correction.mjs --file payload.json [--issue 123]
//
// Mechanically applicable numeric fields (annual fee, minimum income/
// investment) are written when the suggested value parses cleanly as one
// number; everything else lands as a schema-modeled pending_corrections entry
// for the maintainer to resolve in the same PR. The source URL is always
// appended to provenance.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCard } from "./lib/canonical-json.mjs";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const payloadPath = arg("file");
if (!payloadPath) {
  console.error("uso: node scripts/apply-correction.mjs --file payload.json [--issue N]");
  process.exit(2);
}
const issueNumber = arg("issue") ? Number(arg("issue")) : undefined;
const payload = JSON.parse(readFileSync(payloadPath, "utf8"));

const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "cards");
const cardPath = join(cardsDir, `${payload.cardId}.json`);
if (!existsSync(cardPath)) {
  console.error(`✗ cartão não encontrado: ${payload.cardId}`);
  process.exit(1);
}
const card = JSON.parse(readFileSync(cardPath, "utf8"));

/** Parse "R$ 1.234,56", "1234", "1.234" → number, or null when ambiguous. */
function parseBrlNumber(text) {
  const cleaned = String(text)
    .replace(/r\$\s*/i, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

// field label (pt-BR, from lib/correction-fields.ts) → mechanical target paths
const NUMERIC_TARGETS = {
  "Anuidade": [["facets_numeric_or_special", "annual_fee_brl_best_estimate"]],
  "Renda mínima": [
    ["eligibility", "minimum_income_brl_best_estimate"],
    ["facets_numeric_or_special", "minimum_income_brl_best_estimate"],
  ],
  "Investimento mínimo": [
    ["eligibility", "minimum_investment_brl_best_estimate"],
    ["facets_numeric_or_special", "minimum_investment_brl_best_estimate"],
  ],
};

let applied = false;
const targets = NUMERIC_TARGETS[payload.field];
if (targets) {
  const value = parseBrlNumber(payload.suggestedValue);
  if (value !== null) {
    for (const [parent, key] of targets) {
      if (card[parent] && key in card[parent]) card[parent][key] = value;
    }
    applied = true;
  }
}

if (!applied) {
  card.pending_corrections = [
    ...(card.pending_corrections ?? []),
    {
      field: payload.field,
      suggested_value: String(payload.suggestedValue),
      source_url: payload.sourceUrl,
      ...(payload.notes ? { notes: String(payload.notes) } : {}),
      submitted_at: payload.submittedAt ?? new Date().toISOString(),
      ...(issueNumber ? { issue_number: issueNumber } : {}),
    },
  ];
}

card.provenance.sources = [
  ...card.provenance.sources.filter((s) => s.url !== payload.sourceUrl),
  { url: payload.sourceUrl, label: "Correção da comunidade" },
];

writeFileSync(cardPath, serializeCard(card));
console.log(applied ? "applied" : "pending");
