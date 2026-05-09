#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "..");
const facetsPath = path.join(platformRoot, "data/cards_brazil_ai_comparison_facets.json");
const outputDir = path.join(platformRoot, "audit-reports/source-freshness");
const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const facets = JSON.parse(await fs.readFile(facetsPath, "utf8"));
  const now = new Date();
  let cards = facets.cards.filter((card) => !card.facets_boolean?.generic_article_not_single_product && !card.facets_boolean?.issuer_multi_entity_row);

  if (args.search) {
    const query = normalize(args.search);
    cards = cards.filter((card) => normalize(`${card.card_stable_id} ${card.display_name} ${card.issuer_raw}`).includes(query));
  }

  const reports = cards.map((card) => auditCard(card, now)).sort((a, b) => b.issue_count - a.issue_count);
  const summary = {
    generated_at: now.toISOString(),
    stale_after_days: args.staleDays,
    cards_audited: reports.length,
    dynamic_claims_seen: reports.reduce((sum, report) => sum + report.dynamic_claim_count, 0),
    stale_dynamic_claims: reports.reduce((sum, report) => sum + report.stale_dynamic_claim_count, 0),
    cards_missing_source_claims: reports.filter((report) => report.missing_source_claims).length,
    issue_count: reports.reduce((sum, report) => sum + report.issue_count, 0),
    filters: { search: args.search ?? null },
  };

  await fs.mkdir(outputDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `${stamp}.json`);
  const mdPath = path.join(outputDir, `${stamp}.md`);
  await fs.writeFile(jsonPath, JSON.stringify({ summary, reports }, null, 2) + "\n");
  await fs.writeFile(mdPath, renderMarkdown(summary, reports));

  console.log(`Audited ${summary.cards_audited} card(s).`);
  console.log(`Dynamic claims: ${summary.dynamic_claims_seen}; stale: ${summary.stale_dynamic_claims}.`);
  console.log(`Cards missing source_claims: ${summary.cards_missing_source_claims}.`);
  console.log(`Issues: ${summary.issue_count}.`);
  console.log(`JSON: ${path.relative(platformRoot, jsonPath)}`);
  console.log(`Markdown: ${path.relative(platformRoot, mdPath)}`);
}

function auditCard(card, now) {
  const claims = Array.isArray(card.source_claims) ? card.source_claims : [];
  const issues = [];
  if (claims.length === 0) issues.push("missing_source_claims");

  const staleClaims = [];
  for (const claim of claims) {
    if (!claim.dynamic) continue;
    const referenceDate = parseDate(claim.last_verified_at ?? claim.captured_at);
    if (!referenceDate) {
      issues.push(`invalid_claim_date:${claim.field_path}`);
      continue;
    }
    const ageDays = Math.floor((now.getTime() - referenceDate.getTime()) / 86_400_000);
    if (ageDays > args.staleDays) {
      staleClaims.push({ field_path: claim.field_path, age_days: ageDays, source_url: claim.source_url });
      issues.push(`stale_dynamic_claim:${claim.field_path}:${ageDays}d`);
    }
  }

  return {
    card_stable_id: card.card_stable_id,
    display_name: card.display_name,
    issuer_raw: card.issuer_raw,
    source_claim_count: claims.length,
    dynamic_claim_count: claims.filter((claim) => claim.dynamic).length,
    stale_dynamic_claim_count: staleClaims.length,
    missing_source_claims: claims.length === 0,
    issue_count: issues.length,
    issues,
    stale_claims: staleClaims,
  };
}

function renderMarkdown(summary, reports) {
  const problemReports = reports.filter((report) => report.issue_count > 0).slice(0, 100);
  return `# Source Freshness Audit\n\n` +
    `Generated at: ${summary.generated_at}\n\n` +
    `- Stale after: ${summary.stale_after_days} days\n` +
    `- Cards audited: ${summary.cards_audited}\n` +
    `- Dynamic claims: ${summary.dynamic_claims_seen}\n` +
    `- Stale dynamic claims: ${summary.stale_dynamic_claims}\n` +
    `- Cards missing source_claims: ${summary.cards_missing_source_claims}\n` +
    `- Issues: ${summary.issue_count}\n\n` +
    `## Top cards with issues\n\n` +
    (problemReports.length === 0 ? `No issues found.\n` : problemReports.map((report) =>
      `### ${report.display_name}\n\n` +
      `- ID: \`${report.card_stable_id}\`\n` +
      `- Claims: ${report.source_claim_count}\n` +
      `- Stale dynamic claims: ${report.stale_dynamic_claim_count}\n` +
      `- Issues: ${report.issues.join(", ")}\n`
    ).join("\n"));
}

function parseArgs(argv) {
  const parsed = { staleDays: 90, search: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => arg.includes("=") ? arg.split("=").slice(1).join("=") : argv[++i];
    if (arg.startsWith("--stale-days")) parsed.staleDays = Number(readValue());
    else if (arg.startsWith("--search")) parsed.search = readValue();
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/audit-source-freshness.mjs [--stale-days 90] [--search text]");
      process.exit(0);
    }
  }
  if (!Number.isFinite(parsed.staleDays) || parsed.staleDays < 1) parsed.staleDays = 90;
  return parsed;
}

function parseDate(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
