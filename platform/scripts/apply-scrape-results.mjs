#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uniqueClaims } from "./lib/source-claims.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "..");
const catalogPath = path.join(platformRoot, "data/cards_brazil_catalog_v2.json");
const facetsPath = path.join(platformRoot, "data/cards_brazil_ai_comparison_facets.json");
const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  if (!args.input) throw new Error("Missing --input audit-reports/scrape-results/<file>.json");

  const scrape = JSON.parse(await fs.readFile(path.resolve(platformRoot, args.input), "utf8"));
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const facets = JSON.parse(await fs.readFile(facetsPath, "utf8"));
  const results = Array.isArray(scrape.results) ? scrape.results : [];

  const summary = { results_seen: results.length, cards_matched: 0, claims_added: 0, warnings: [] };

  for (const result of results) {
    const id = result.card_stable_id;
    const catalogCard = catalog.cards.find((card) => card.identity?.stable_id === id);
    const facetCard = facets.cards.find((card) => card.card_stable_id === id);
    if (!catalogCard || !facetCard) {
      summary.warnings.push(`missing_card:${id}`);
      continue;
    }

    const claims = Array.isArray(result.source_claims) ? result.source_claims : [];
    if (claims.length === 0) {
      summary.warnings.push(`no_claims:${id}`);
      continue;
    }

    const beforeCatalog = catalogCard.source_claims?.length ?? 0;
    const beforeFacet = facetCard.source_claims?.length ?? 0;
    catalogCard.source_claims = uniqueClaims([...(catalogCard.source_claims ?? []), ...claims]);
    facetCard.source_claims = uniqueClaims([...(facetCard.source_claims ?? []), ...claims]);
    summary.cards_matched += 1;
    summary.claims_added += Math.max(0, catalogCard.source_claims.length - beforeCatalog);

    if (catalogCard.source_claims.length !== facetCard.source_claims.length && beforeCatalog === beforeFacet) {
      summary.warnings.push(`claim_count_drift:${id}:${catalogCard.source_claims.length}/${facetCard.source_claims.length}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));

  if (!args.write) {
    console.log("Dry run only. Re-run with --write to update catalog and facets JSON.");
    return;
  }

  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
  await fs.writeFile(facetsPath, JSON.stringify(facets, null, 2) + "\n");
  console.log("Updated data/cards_brazil_catalog_v2.json and data/cards_brazil_ai_comparison_facets.json.");
}

function parseArgs(argv) {
  const parsed = { input: null, write: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => arg.includes("=") ? arg.split("=").slice(1).join("=") : argv[++i];
    if (arg.startsWith("--input")) parsed.input = readValue();
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/apply-scrape-results.mjs --input audit-reports/scrape-results/file.json [--write]");
      process.exit(0);
    }
  }
  return parsed;
}
