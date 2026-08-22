#!/usr/bin/env node
// Migration 003 — explode the monolithic facets file into one file per card
// (platform/data/cards/<card_stable_id>.json), adding a provenance block
// harvested from catalog v2 evidence dates, facets source_claims, and the
// one-time manual review overrides. Deletes the harvested inputs afterwards.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCard } from "../lib/canonical-json.mjs";

const platformRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = join(platformRoot, "..");
const dataDir = join(platformRoot, "data");
const cardsDir = join(dataDir, "cards");

const facetsPath = join(dataDir, "cards_brazil_ai_comparison_facets.json");
const catalogPath = join(dataDir, "cards_brazil_catalog_v2.json");
const overridesPath = join(repoRoot, "tools", "manual_card_review_overrides.json");

const facets = JSON.parse(readFileSync(facetsPath, "utf8"));
const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, "utf8")) : null;
const overrides = existsSync(overridesPath)
  ? JSON.parse(readFileSync(overridesPath, "utf8")).overrides
  : {};

const fallbackDate = (catalog?.catalog_meta?.generated_at_utc ?? "2026-05-07").slice(0, 10);

const latestEvidenceDate = new Map();
if (catalog) {
  for (const card of catalog.cards) {
    const id = card.identity?.stable_id;
    if (!id) continue;
    let latest = null;
    const scan = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) scan(item);
      } else if (node && typeof node === "object") {
        if (typeof node.retrieved_at_utc === "string") {
          const day = node.retrieved_at_utc.slice(0, 10);
          if (!latest || day > latest) latest = day;
        }
        for (const value of Object.values(node)) scan(value);
      }
    };
    scan(card);
    if (latest) latestEvidenceDate.set(id, latest);
  }
}

mkdirSync(cardsDir, { recursive: true });
for (const card of facets.cards) {
  const id = card.card_stable_id;

  let lastVerified = latestEvidenceDate.get(id) ?? null;
  for (const claim of card.source_claims ?? []) {
    const day = (claim.last_verified_at ?? claim.captured_at ?? "").slice(0, 10);
    if (day && (!lastVerified || day > lastVerified)) lastVerified = day;
  }

  const sources = [{ url: card.source_url, label: card.source_label, tier: card.source_tier }];
  if (card.primary_evidence_url && card.primary_evidence_url !== card.source_url) {
    sources.push({ url: card.primary_evidence_url, label: "Evidência primária" });
  }

  card.provenance = {
    sources,
    last_verified_date: lastVerified ?? fallbackDate,
    ...(overrides[id]?.review_note ? { verification_note: overrides[id].review_note } : {}),
  };

  writeFileSync(join(cardsDir, `${id}.json`), serializeCard(card));
}
console.log(`wrote ${facets.cards.length} per-card files to data/cards/`);

for (const path of [facetsPath, catalogPath, overridesPath]) {
  if (existsSync(path)) rmSync(path);
}
console.log("removed monolithic inputs (facets, catalog v2, manual overrides)");
