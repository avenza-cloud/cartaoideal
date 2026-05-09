#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "..");
const facetsPath = path.join(platformRoot, "data/cards_brazil_ai_comparison_facets.json");
const outputDir = path.join(platformRoot, "audit-reports/source-claims");

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const facets = JSON.parse(await fs.readFile(facetsPath, "utf8"));
  let cards = facets.cards.filter(
    (card) =>
      !card.facets_boolean?.generic_article_not_single_product &&
      !card.facets_boolean?.issuer_multi_entity_row
  );

  if (args.search) {
    const query = normalize(args.search);
    cards = cards.filter((card) =>
      normalize(`${card.display_name} ${card.issuer_raw} ${card.card_stable_id}`).includes(query)
    );
  }

  const reports = cards.map(auditCard).sort((a, b) => b.issue_count - a.issue_count);
  const summary = {
    generated_at: new Date().toISOString(),
    cards_audited: reports.length,
    cards_with_source_claims: reports.filter((r) => r.source_claim_count > 0).length,
    issue_count: reports.reduce((sum, report) => sum + report.issue_count, 0),
    filters: { search: args.search ?? null },
  };

  await fs.mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `${stamp}.json`);
  const mdPath = path.join(outputDir, `${stamp}.md`);
  await fs.writeFile(jsonPath, JSON.stringify({ summary, reports }, null, 2) + "\n");
  await fs.writeFile(mdPath, renderMarkdown(summary, reports));

  console.log(`Audited ${summary.cards_audited} card(s).`);
  console.log(`Cards with source_claims: ${summary.cards_with_source_claims}.`);
  console.log(`Issues: ${summary.issue_count}.`);
  console.log(`JSON: ${path.relative(platformRoot, jsonPath)}`);
  console.log(`Markdown: ${path.relative(platformRoot, mdPath)}`);
}

function auditCard(card) {
  const issues = [];
  const claims = Array.isArray(card.source_claims) ? card.source_claims : [];
  if (claims.length === 0) issues.push("missing_source_claims");

  for (const [index, claim] of claims.entries()) {
    const prefix = `source_claims[${index}]`;
    if (!claim.field_path) issues.push(`${prefix}.missing_field_path`);
    if (!claim.value_text) issues.push(`${prefix}.missing_value_text`);
    if (!isHttpUrl(claim.source_url)) issues.push(`${prefix}.invalid_source_url`);
    if (!claim.source_type) issues.push(`${prefix}.missing_source_type`);
    if (!isIsoDateish(claim.captured_at)) issues.push(`${prefix}.invalid_captured_at`);
    if (claim.last_verified_at && !isIsoDateish(claim.last_verified_at)) {
      issues.push(`${prefix}.invalid_last_verified_at`);
    }
    if (typeof claim.confidence_0_to_1 !== "number" || claim.confidence_0_to_1 < 0 || claim.confidence_0_to_1 > 1) {
      issues.push(`${prefix}.invalid_confidence`);
    }
    if (typeof claim.dynamic !== "boolean") issues.push(`${prefix}.missing_dynamic_flag`);
    if (claim.dynamic && !claim.raw_excerpt) issues.push(`${prefix}.dynamic_missing_raw_excerpt`);
  }

  return {
    card_stable_id: card.card_stable_id,
    display_name: card.display_name,
    issuer_raw: card.issuer_raw,
    source_claim_count: claims.length,
    issue_count: issues.length,
    issues,
  };
}

function renderMarkdown(summary, reports) {
  const problemReports = reports.filter((report) => report.issue_count > 0);
  return `# Source Claims Audit\n\n` +
    `Generated at: ${summary.generated_at}\n\n` +
    `- Cards audited: ${summary.cards_audited}\n` +
    `- Cards with source_claims: ${summary.cards_with_source_claims}\n` +
    `- Issues: ${summary.issue_count}\n\n` +
    `## Cards with issues\n\n` +
    (problemReports.length === 0
      ? `No issues found.\n`
      : problemReports.map((report) =>
          `### ${report.display_name}\n\n` +
          `- ID: \`${report.card_stable_id}\`\n` +
          `- Claims: ${report.source_claim_count}\n` +
          `- Issues: ${report.issues.join(", ")}\n`
        ).join("\n"));
}

function parseArgs(argv) {
  const parsed = { search: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => arg.includes("=") ? arg.split("=").slice(1).join("=") : argv[++i];
    if (arg.startsWith("--search")) parsed.search = readValue();
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/audit-source-claims.mjs [--search text]");
      process.exit(0);
    }
  }
  return parsed;
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoDateish(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);
}
