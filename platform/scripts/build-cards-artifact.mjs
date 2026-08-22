#!/usr/bin/env node
// Compiles platform/data/cards/*.json (source of truth, one file per card)
// into the runtime artifact platform/data/generated/cards.json that the app
// statically imports. Runs automatically via the predev/prebuild/pretest:unit
// hooks; CI also runs it explicitly with --check, which additionally verifies
// every source file is canonically formatted (see scripts/lib/canonical-json.mjs).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCard } from "./lib/canonical-json.mjs";

const platformRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = join(platformRoot, "data", "cards");
const outDir = join(platformRoot, "data", "generated");
const checkMode = process.argv.includes("--check");

const errors = [];
const cards = [];
for (const file of readdirSync(cardsDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const raw = readFileSync(join(cardsDir, file), "utf8");
  let card;
  try {
    card = JSON.parse(raw);
  } catch (error) {
    errors.push(`${file}: JSON inválido — ${error.message}`);
    continue;
  }
  if (card.card_stable_id !== basename(file, ".json")) {
    errors.push(`${file}: nome do arquivo difere de card_stable_id ("${card.card_stable_id}")`);
  }
  if (checkMode && raw !== serializeCard(card)) {
    errors.push(
      `${file}: formato não-canônico — rode "node scripts/build-cards-artifact.mjs --format"`
    );
  }
  if (process.argv.includes("--format") && raw !== serializeCard(card)) {
    writeFileSync(join(cardsDir, file), serializeCard(card));
  }
  cards.push(card);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}

// Deterministic order: ranking first, then id. Content hash instead of a
// timestamp keeps the artifact byte-identical for identical sources.
cards.sort((a, b) => {
  const ra = typeof a.ranking_position === "number" ? a.ranking_position : Infinity;
  const rb = typeof b.ranking_position === "number" ? b.ranking_position : Infinity;
  if (ra !== rb) return ra - rb;
  return a.card_stable_id.localeCompare(b.card_stable_id);
});

const content_hash = createHash("sha256")
  .update(cards.map((c) => JSON.stringify(c)).join("\n"))
  .digest("hex")
  .slice(0, 16);

const artifact = {
  facets_meta: {
    schema_version: "2.0",
    unknown_sentinel: "unknown",
    purpose: `Runtime compilation of data/cards/*.json (content ${content_hash})`,
    source: "data/cards/*.json",
  },
  cards,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "cards.json"), JSON.stringify(artifact));
console.log(`built data/generated/cards.json — ${cards.length} cards, content ${content_hash}`);
