// Canonical serialization for per-card data files. Deterministic output keeps
// diffs minimal and lets `build-cards-artifact.mjs --check` verify formatting.
//
// Top-level keys follow the schema declaration order (identity first); nested
// object keys are sorted alphabetically. Keys unknown to the order list land at
// the end, alphabetically, so a schema addition never breaks serialization.

export const TOP_LEVEL_KEY_ORDER = [
  "card_stable_id",
  "display_name",
  "issuer_raw",
  "issuer_id",
  "network_primary",
  "network_alternatives",
  "variant_band",
  "market_segment_guess",
  "product_kind",
  "verification_cross_check_status",
  "verification_confidence_0_to_1",
  "primary_evidence_url",
  "application_url",
  "review_source_url",
  "source_label",
  "review_source_label",
  "source_tier",
  "source_url",
  "ranking_position",
  "ranking_score",
  "media",
  "reward_return",
  "lounge_access",
  "eligibility",
  "fee_waiver_rules",
  "benefit_groups",
  "characteristics",
  "facets_numeric_or_special",
  "facets_boolean",
  "labels_for_filtering",
  "application_availability",
  "source_claims",
  "store_benefits",
  "secured_limit_options",
  "cashback_details",
  "co_brand",
  "data_quality_notes",
  "pending_corrections",
  "provenance",
];

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value;
}

export function canonicalizeCard(card) {
  const known = TOP_LEVEL_KEY_ORDER.filter((key) => key in card);
  const unknown = Object.keys(card).filter((key) => !TOP_LEVEL_KEY_ORDER.includes(key)).sort();
  const out = {};
  for (const key of [...known, ...unknown]) out[key] = sortValue(card[key]);
  return out;
}

export function serializeCard(card) {
  return `${JSON.stringify(canonicalizeCard(card), null, 2)}\n`;
}
