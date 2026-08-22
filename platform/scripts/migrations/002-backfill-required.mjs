#!/usr/bin/env node
// Migration 002 — backfill schema-required fields that older generator runs
// omitted, using the "unknown" sentinel (or a derivable value). Idempotent.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const facetsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "cards_brazil_ai_comparison_facets.json"
);
const facets = JSON.parse(readFileSync(facetsPath, "utf8"));

const filled = {
  guest_policy: 0,
  summary: 0,
  monthly_fee: 0,
  reward_return_cashlike: 0,
  hard_gate_fields: 0,
  fee_waiver_raw_text: 0,
};
for (const card of facets.cards) {
  if (card.eligibility && !Array.isArray(card.eligibility.hard_gate_fields)) {
    card.eligibility.hard_gate_fields = [];
    filled.hard_gate_fields += 1;
  }
  for (const rule of card.fee_waiver_rules ?? []) {
    if (typeof rule.raw_text !== "string") {
      rule.raw_text = rule.description;
      filled.fee_waiver_raw_text += 1;
    }
  }
  const lounge = card.lounge_access;
  if (lounge.guest_policy === undefined) {
    lounge.guest_policy = "unknown";
    filled.guest_policy += 1;
  }
  if (lounge.summary === undefined) {
    lounge.summary = "unknown";
    filled.summary += 1;
  }
  const numeric = card.facets_numeric_or_special;
  if (numeric.monthly_fee_brl_after_intro_official_hint === undefined) {
    numeric.monthly_fee_brl_after_intro_official_hint = "unknown";
    filled.monthly_fee += 1;
  }
  if (card.facets_boolean.reward_return_cashlike === undefined) {
    card.facets_boolean.reward_return_cashlike = card.reward_return.has_cashlike_return;
    filled.reward_return_cashlike += 1;
  }
}

writeFileSync(facetsPath, `${JSON.stringify(facets, null, 2)}\n`);
console.log(`backfilled: ${JSON.stringify(filled)}`);
