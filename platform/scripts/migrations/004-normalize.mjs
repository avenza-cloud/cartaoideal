#!/usr/bin/env node
// Migration 004 — normalize dirty enum-candidate values so the schema can
// tighten. Every change is driven by the explicit mapping tables below
// (reviewable in this file's diff). Idempotent.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCard } from "../lib/canonical-json.mjs";

const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "cards");

// ── Issuer cleanup: truncated/misparsed names, casing, co-brand rows ────────
// Keyed by card_stable_id where the fix is per-card, by value where global.
const ISSUER_BY_VALUE = {
  CAIXA: "Caixa Econômica Federal",
  digio: "Digio",
  "Pão": "Pão de Açúcar",
  "Itaú / Magalu": "Itaú", // co-brand partner already modeled in co_brand
};
const ISSUER_BY_CARD = {
  // display_name "Cartão de Crédito Dotz Visa Platinum" — issuer misparsed as "Cartão"
  "cartao-cartao-de-credito-dotz-visa-platinum-9ccf69cb1c": "Dotz",
  // display_name "Cartão de Crédito Saraiva" — BB-issued (evidence: bb.com.br)
  "cartao-cartao-de-credito-saraiva-ada05cbac5": "Banco do Brasil",
};

// ── variant_band: 35 cards carried a network name instead of a tier ─────────
// Tier derived from display_name tokens only (conservative: else "unknown").
const BAND_TOKEN_PATTERNS = [
  [/infinite\s+privilege/i, "Infinite Privilege"],
  [/aeternum/i, "Aeternum"],
  [/infinite/i, "Infinite"],
  [/signature/i, "Signature"],
  [/platinum/i, "Platinum"],
  [/\bgold\b/i, "Gold"],
  [/\bblack\b/i, "Black"],
  [/nanquim/i, "Nanquim"],
  [/grafite/i, "Grafite"],
  [/centurion/i, "Centurion"],
  [/green\s+card/i, "Green"],
  [/quartz/i, "Quartz"],
  [/universit[aá]ri[oa]/i, "Universitário"],
  [/dom[eé]stico/i, "Nacional"],
  [/\bmais\b/i, "Mais"],
  [/internacional/i, "Internacional"],
];
const NETWORK_NAME_BANDS = new Set(["Mastercard", "Visa", "Elo", "American Express", "Gold/Platinum"]);
const BAND_CASE_FIXES = { "estelar": "Estelar", "básico": "Básico", "universitário": "Universitário" };

// ── network_primary: split the 3 non-atomic "Visa / Mastercard" rows ────────
// None of the three names a network in its display_name; all are genuinely
// offered on both. Visa becomes primary, Mastercard an alternative.
const COMPOUND_NETWORK = "Visa / Mastercard";

// ── eligibility.source_status: 8 near-synonyms → 5 ──────────────────────────
const SOURCE_STATUS_MAP = {
  not_structured: "not_structured",
  official_or_structured: "official",
  official_current: "official",
  official_current_prime: "official",
  official_issuer_initial_capture: "official_partial",
  official_issuer_partial_capture: "official_partial",
  manual_curated: "manual_curated",
  aggregator_secondary: "aggregator",
};

// ── verification_cross_check_status: 9 → 4 (nuance kept in provenance) ──────
const VERIFICATION_MAP = {
  trusted_passageiro_de_primeira_ranking: "trusted_aggregator",
  official_issuer_initial_capture: "official_partial",
  official_issuer_with_user_reported_context: "official_partial",
  trusted_catalog_with_curated_official_override: "manual_curated",
  manual_das_milhas_secondary_official_product_url: "manual_curated",
  official_issuer_page: "official_verified",
  official_issuer_with_trusted_review_context: "official_verified",
  official_nubank_card_page_curated: "official_verified",
  official_issuer_with_trusted_ranking_context: "official_verified",
};
// Originals whose collapse loses real nuance — preserved as a provenance note.
const VERIFICATION_NOTE_WORTHY = new Set([
  "trusted_catalog_with_curated_official_override",
  "manual_das_milhas_secondary_official_product_url",
  "official_nubank_card_page_curated",
  "official_issuer_with_user_reported_context",
]);

// ── Defunct products ────────────────────────────────────────────────────────
const DEFUNCT = {
  "cartao-cartao-de-credito-saraiva-ada05cbac5":
    "Produto descontinuado — a rede Saraiva encerrou as operações.",
};

const slugify = (name) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const stats = {};
const bump = (k) => (stats[k] = (stats[k] || 0) + 1);

for (const file of readdirSync(cardsDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const path = join(cardsDir, file);
  const card = JSON.parse(readFileSync(path, "utf8"));

  const issuerFix = ISSUER_BY_CARD[card.card_stable_id] ?? ISSUER_BY_VALUE[card.issuer_raw];
  if (issuerFix && card.issuer_raw !== issuerFix) {
    card.issuer_raw = issuerFix;
    bump("issuer_fixed");
  }
  if (card.issuer_id !== slugify(card.issuer_raw)) {
    card.issuer_id = slugify(card.issuer_raw);
    bump("issuer_id_set");
  }

  if (NETWORK_NAME_BANDS.has(card.variant_band)) {
    const match = BAND_TOKEN_PATTERNS.find(([re]) => re.test(card.display_name));
    card.variant_band = match ? match[1] : "unknown";
    bump(match ? "band_derived" : "band_unknown");
  } else if (BAND_CASE_FIXES[card.variant_band]) {
    card.variant_band = BAND_CASE_FIXES[card.variant_band];
    bump("band_case_fixed");
  }

  if (card.network_primary === COMPOUND_NETWORK) {
    card.network_primary = "Visa";
    card.network_alternatives = ["Mastercard"];
    bump("network_split");
  }

  if (card.eligibility && SOURCE_STATUS_MAP[card.eligibility.source_status]) {
    const mapped = SOURCE_STATUS_MAP[card.eligibility.source_status];
    if (card.eligibility.source_status !== mapped) {
      card.eligibility.source_status = mapped;
      bump("source_status_collapsed");
    }
  }

  const original = card.verification_cross_check_status;
  const mappedVerification = VERIFICATION_MAP[original];
  if (mappedVerification && original !== mappedVerification) {
    card.verification_cross_check_status = mappedVerification;
    if (VERIFICATION_NOTE_WORTHY.has(original) && card.provenance) {
      const note = `Verificação original: ${original}`;
      card.provenance.verification_note = card.provenance.verification_note
        ? `${card.provenance.verification_note} — ${note}`
        : note;
    }
    bump("verification_collapsed");
  }

  if ("verification_confidence_0_to_1" in card) {
    // Constant 1.0 on 265/299 cards — a non-signal; provenance carries sourcing.
    delete card.verification_confidence_0_to_1;
    bump("confidence_dropped");
  }

  if (DEFUNCT[card.card_stable_id] && card.eligibility?.availability_status !== "unavailable") {
    card.eligibility.availability_status = "unavailable";
    card.data_quality_notes = [...(card.data_quality_notes ?? []), DEFUNCT[card.card_stable_id]];
    bump("marked_unavailable");
  }

  writeFileSync(path, serializeCard(card));
}
console.log(JSON.stringify(stats, null, 1));
