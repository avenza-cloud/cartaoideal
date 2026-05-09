#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToText, isHttpUrl, todayIsoDate } from "./lib/source-claims.mjs";
import { selectAdapter } from "./sources/adapters.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "..");
const defaultTargetsPath = path.join(platformRoot, "data/scrape_targets.example.json");
const outputDir = path.join(platformRoot, "audit-reports/scrape-results");
const USER_AGENT = "Mozilla/5.0 (compatible; CartaoIdealSourceScraper/1.0; source-claim-audit)";

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const targets = await loadTargets(args.targets);
  const selectedTargets = selectTargets(targets);
  await fs.mkdir(outputDir, { recursive: true });

  const results = [];
  for (const target of selectedTargets) {
    results.push(await scrapeTarget(target));
    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  const summary = {
    generated_at: new Date().toISOString(),
    target_count: selectedTargets.length,
    claim_count: results.reduce((sum, result) => sum + result.source_claims.length, 0),
    warning_count: results.reduce((sum, result) => sum + result.warnings.length, 0),
    filters: { card: args.card, search: args.search, limit: args.limit },
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `${stamp}.json`);
  await fs.writeFile(jsonPath, JSON.stringify({ summary, results }, null, 2) + "\n");

  console.log(`Scraped ${summary.target_count} target(s).`);
  console.log(`Extracted ${summary.claim_count} source claim(s); warnings: ${summary.warning_count}.`);
  console.log(`JSON: ${path.relative(platformRoot, jsonPath)}`);
}

async function scrapeTarget(target) {
  const capturedAt = todayIsoDate();
  const warnings = [];
  if (!target.card_stable_id) warnings.push("missing_card_stable_id");
  if (!isHttpUrl(target.source_url)) warnings.push("invalid_source_url");

  let html = "";
  let fetchStatus = null;
  if (warnings.includes("invalid_source_url")) {
    warnings.push("fetch_skipped_invalid_url");
  } else {
    const fetched = await fetchSource(target.source_url);
    html = fetched.body;
    fetchStatus = fetched.status;
    if (!fetched.ok) warnings.push(`fetch_failed_${fetched.status}`);
  }

  const adapter = selectAdapter(target);
  const extracted = adapter.extract({
    cardStableId: target.card_stable_id,
    displayName: target.display_name,
    sourceUrl: target.source_url,
    sourceType: target.source_type ?? "official_issuer",
    htmlText: htmlToText(html),
    capturedAt,
  });

  return {
    card_stable_id: target.card_stable_id,
    display_name: target.display_name,
    issuer: target.issuer,
    source_url: target.source_url,
    source_type: target.source_type ?? "official_issuer",
    adapter: adapter.id,
    fetched_status: fetchStatus,
    source_claims: extracted.sourceClaims,
    proposed_patch: {
      catalog: extracted.proposedCatalogFields,
      facets: extracted.proposedFacetFields,
    },
    warnings: [...warnings, ...extracted.warnings],
  };
}

async function fetchSource(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("text") || contentType.includes("html") || contentType.includes("json")
      ? await response.text()
      : "";
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: "", error };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadTargets(targetsPath) {
  const resolved = path.resolve(platformRoot, targetsPath ?? defaultTargetsPath);
  const parsed = JSON.parse(await fs.readFile(resolved, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`Expected targets array in ${resolved}`);
  return parsed;
}

function selectTargets(targets) {
  let selected = targets;
  if (args.card) selected = selected.filter((target) => target.card_stable_id === args.card);
  if (args.search) {
    const query = normalize(args.search);
    selected = selected.filter((target) => normalize(`${target.card_stable_id} ${target.display_name} ${target.issuer}`).includes(query));
  }
  if (args.limit) selected = selected.slice(0, args.limit);
  return selected;
}

function parseArgs(argv) {
  const parsed = { targets: null, card: null, search: null, limit: null, timeoutMs: 15000, delayMs: 500 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => arg.includes("=") ? arg.split("=").slice(1).join("=") : argv[++i];
    if (arg.startsWith("--targets")) parsed.targets = readValue();
    else if (arg.startsWith("--card")) parsed.card = readValue();
    else if (arg.startsWith("--search")) parsed.search = readValue();
    else if (arg.startsWith("--limit")) parsed.limit = Number(readValue());
    else if (arg.startsWith("--timeout")) parsed.timeoutMs = Number(readValue());
    else if (arg.startsWith("--delay-ms")) parsed.delayMs = Number(readValue());
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/scrape-card-sources.mjs [--targets data/scrape_targets.json] [--card id] [--search text] [--limit n]\n\nWrites non-mutating scrape results to audit-reports/scrape-results/.`);
      process.exit(0);
    }
  }
  if (!Number.isFinite(parsed.limit) || parsed.limit < 1) parsed.limit = null;
  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs < 1000) parsed.timeoutMs = 15000;
  if (!Number.isFinite(parsed.delayMs) || parsed.delayMs < 0) parsed.delayMs = 500;
  return parsed;
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
