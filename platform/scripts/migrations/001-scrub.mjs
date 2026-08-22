#!/usr/bin/env node
// Migration 001 — scrub third-party content ahead of the open-source release.
// Idempotent: re-running produces identical output.
//
// - facets file: drop media.remote_card_art_url and text_for_embedding_compare,
//   set every media.card_art_url to the "unknown" sentinel (scraped images are
//   deleted from public/card-images; official art returns via provenance-tracked PRs).
// - catalog v2: strip raw_source_snapshot blocks (verbatim third-party prose).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

const facetsPath = join(dataDir, "cards_brazil_ai_comparison_facets.json");
const facets = JSON.parse(readFileSync(facetsPath, "utf8"));
facets.facets_meta.purpose = "Flattened card facets for LLM tool calls and reranking";
for (const card of facets.cards) {
  delete card.text_for_embedding_compare;
  if (card.media) {
    delete card.media.remote_card_art_url;
    card.media.card_art_url = "unknown";
  }
}
writeFileSync(facetsPath, `${JSON.stringify(facets, null, 2)}\n`);
console.log(`facets: scrubbed ${facets.cards.length} cards`);

const catalogPath = join(dataDir, "cards_brazil_catalog_v2.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const stripped = { raw_source_snapshot: 0, remote_card_art_url: 0 };
const stripKeys = (node) => {
  if (Array.isArray(node)) {
    for (const item of node) stripKeys(item);
  } else if (node && typeof node === "object") {
    for (const key of Object.keys(stripped)) {
      if (key in node) {
        delete node[key];
        stripped[key] += 1;
      }
    }
    for (const value of Object.values(node)) stripKeys(value);
  }
};
stripKeys(catalog);
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`catalog v2: stripped ${JSON.stringify(stripped)}`);
