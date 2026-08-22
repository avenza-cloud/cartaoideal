#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const facetsPath = path.join(repoRoot, "web/data/generated/cards.json");
const outputDir = path.join(repoRoot, "audit-reports/card-sources");

// Contact URL comes from env so forks identify themselves, not this repo.
const USER_AGENT = process.env.AUDIT_CONTACT_URL
  ? `Mozilla/5.0 (compatible; CartaoIdealSourceAudit/1.0; +${process.env.AUDIT_CONTACT_URL})`
  : "Mozilla/5.0 (compatible; CartaoIdealSourceAudit/1.0)";

const args = parseArgs(process.argv.slice(2));
const now = new Date().toISOString().replace(/[:.]/g, "-");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const facets = JSON.parse(await fs.readFile(facetsPath, "utf8"));
  let cards = facets.cards.filter(
    (card) =>
      !card.facets_boolean.generic_article_not_single_product &&
      !card.facets_boolean.issuer_multi_entity_row
  );

  if (args.card) {
    cards = cards.filter((card) => card.card_stable_id === args.card);
  }
  if (args.search) {
    const query = normalize(args.search);
    cards = cards.filter((card) =>
      normalize(`${card.display_name} ${card.issuer_raw}`).includes(query)
    );
  }
  if (args.limit) cards = cards.slice(0, args.limit);

  await fs.mkdir(outputDir, { recursive: true });

  const fetchCache = new Map();
  const reports = [];
  await mapLimit(cards, args.concurrency, async (card, index) => {
    const urls = sourceUrls(card);
    const pages = [];
    for (const url of urls) {
      pages.push(await fetchEvidence(url, fetchCache));
    }
    const report = auditCard(card, pages);
    reports.push(report);
    const prefix = String(index + 1).padStart(4, "0");
    if (args.verbose || report.issues.length > 0) {
      console.log(
        `${prefix}/${cards.length} ${card.display_name}: ${report.issues.length} issue(s)`
      );
    }
  });

  reports.sort(
    (a, b) =>
      b.issueScore - a.issueScore ||
      b.issues.length - a.issues.length ||
      a.card.display_name.localeCompare(b.card.display_name, "pt-BR")
  );

  const summary = {
    generated_at: new Date().toISOString(),
    cards_audited: reports.length,
    urls_seen: fetchCache.size,
    issue_count: reports.reduce((sum, report) => sum + report.issues.length, 0),
    failed_fetches: [...fetchCache.values()].filter((page) => !page.ok).length,
    filters: {
      card: args.card ?? null,
      search: args.search ?? null,
      limit: args.limit ?? null,
    },
  };

  const jsonPath = path.join(outputDir, `${now}.json`);
  const mdPath = path.join(outputDir, `${now}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify({ summary, reports }, null, 2)}\n`);
  await fs.writeFile(mdPath, renderMarkdown(summary, reports));

  console.log(`\nAudited ${summary.cards_audited} card(s), ${summary.urls_seen} source URL(s).`);
  console.log(`Issues: ${summary.issue_count}; failed fetches: ${summary.failed_fetches}.`);
  console.log(`JSON: ${path.relative(repoRoot, jsonPath)}`);
  console.log(`Markdown: ${path.relative(repoRoot, mdPath)}`);
}

function parseArgs(argv) {
  const parsed = {
    concurrency: 6,
    timeoutMs: 15000,
    limit: null,
    search: null,
    card: null,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => {
      const inline = arg.split("=")[1];
      if (inline !== undefined) return inline;
      return argv[++i];
    };

    if (arg === "--verbose") parsed.verbose = true;
    else if (arg.startsWith("--limit")) parsed.limit = Number(readValue());
    else if (arg.startsWith("--search")) parsed.search = readValue();
    else if (arg.startsWith("--card")) parsed.card = readValue();
    else if (arg.startsWith("--concurrency")) parsed.concurrency = Number(readValue());
    else if (arg.startsWith("--timeout")) parsed.timeoutMs = Number(readValue());
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/audit-card-sources.mjs [--search c6] [--card stable_id] [--limit 20]

Options:
  --search <text>       Audit cards whose id/name/issuer match text.
  --card <stable_id>    Audit one specific card.
  --limit <n>           Audit first n matching cards.
  --concurrency <n>     Fetch concurrency. Default: 6.
  --timeout <ms>        Per-request timeout. Default: 15000.
  --verbose             Log cards without issues too.

Reports are written to audit-reports/card-sources/ and ignored by git.`);
      process.exit(0);
    }
  }

  if (!Number.isFinite(parsed.concurrency) || parsed.concurrency < 1) parsed.concurrency = 6;
  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs < 1000) parsed.timeoutMs = 15000;
  if (!Number.isFinite(parsed.limit) || parsed.limit < 1) parsed.limit = null;
  return parsed;
}

function sourceUrls(card) {
  return [
    card.primary_evidence_url,
    card.application_url,
    card.source_url,
    card.review_source_url,
    card.media?.source_url,
  ]
    .filter(Boolean)
    .filter((url) => url !== "unknown")
    .map((url) => normalizeUrl(String(url)))
    .filter(unique);
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "gclid" || key === "gbraid" || key === "gad_source") {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function unique(value, index, array) {
  return array.indexOf(value) === index;
}

async function fetchEvidence(url, cache) {
  if (cache.has(url)) return cache.get(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const html =
      contentType.includes("text") || contentType.includes("html") ? await response.text() : "";
    const text = normalizeWhitespace(htmlToText(html));
    const page = {
      url,
      ok: response.ok,
      status: response.status,
      ms: Date.now() - startedAt,
      text,
      evidence: extractEvidence(text),
    };
    cache.set(url, page);
    return page;
  } catch (error) {
    const page = {
      url,
      ok: false,
      status: 0,
      ms: Date.now() - startedAt,
      text: "",
      evidence: {},
      error: error instanceof Error ? error.message : String(error),
    };
    cache.set(url, page);
    return page;
  } finally {
    clearTimeout(timeout);
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractEvidence(text) {
  const normalized = normalize(text);
  return {
    annualFees: moneyNear(normalized, /(anuidade|parcela mensal)/),
    waiverSpendThresholds: moneyNear(
      normalized,
      /(isenc|isento|zerad|anuidade)/,
      /(gasto|fatura|compras|despesas)/
    ),
    waiverInvestmentThresholds: moneyNear(
      normalized,
      /(isenc|isento|zerad|anuidade)/,
      /(invest|aplicac|patrimonio)/
    ),
    rewardRates: [
      ...normalized.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?)\s*(?:por|\/)\s*(?:dolar|usd)/g),
    ].map((m) => Number(m[1].replace(",", "."))),
    cashbackRates: [
      ...normalized.matchAll(
        /(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s*)?(cashback|credito na fatura|retorno)/g
      ),
    ].map((m) => Number(m[1].replace(",", "."))),
    loungeUnlimited:
      /(sala|salas|lounge)[^.!?]{0,120}(ilimitad|sem limite)|(?:acesso|acessos)[^.!?]{0,80}ilimitad/.test(
        normalized
      ),
    loungeVisits: [
      ...normalized.matchAll(
        /(\d+)\s*(?:acessos?|visitas?|entradas?)[^.!?]{0,80}(?:sala|salas|vip|lounge|dragon|priority|visa airport|mastercard)/g
      ),
    ].map((m) => Number(m[1])),
    mentionedPrograms: [
      ["Priority Pass", /priority pass/.test(normalized)],
      ["Dragon Pass", /dragon pass/.test(normalized)],
      ["Visa Airport Companion", /visa airport companion/.test(normalized)],
      ["LoungeKey", /loungekey|lounge key/.test(normalized)],
      ["Sala VIP Mastercard Black", /mastercard black/.test(normalized)],
      ["W Premium Lounge", /w premium/.test(normalized)],
    ]
      .filter(([, hit]) => hit)
      .map(([name]) => name),
    minInvestment: moneyNear(
      normalized,
      /(solicitar|elegib|cliente|ter|precisa|necessario)/,
      /(invest|aplicac|patrimonio)/
    ),
    snippets: evidenceSnippets(text),
  };
}

function moneyNear(text, contextA, contextB = null) {
  const amounts = [];
  const moneyPattern = /r\$\s*(\d[\d.]*(?:,\d+)?)(?:\s*(milhoes|milhao|mil))?/g;
  for (const match of text.matchAll(moneyPattern)) {
    const start = Math.max(0, match.index - 120);
    const end = Math.min(text.length, match.index + match[0].length + 120);
    const context = text.slice(start, end);
    if (!contextA.test(context)) continue;
    if (contextB && !contextB.test(context)) continue;
    const value = parseMoney(match[1], match[2]);
    if (Number.isFinite(value)) amounts.push(value);
  }
  return [...new Set(amounts)].sort((a, b) => a - b);
}

function parseMoney(raw, suffix = "") {
  const value = Number(String(raw).replace(/\./g, "").replace(",", "."));
  const multiplier = /milh/.test(suffix) ? 1_000_000 : /mil/.test(suffix) ? 1_000 : 1;
  return value * multiplier;
}

function evidenceSnippets(text) {
  const normalized = normalizeWhitespace(text);
  const needles = [
    /anuidade[^.]{0,220}/i,
    /isenc[aã]o[^.]{0,220}/i,
    /pontos? por d[oó]lar[^.]{0,160}/i,
    /cashback[^.]{0,180}/i,
    /sala[s]? vip[^.]{0,220}/i,
    /lounge[^.]{0,220}/i,
    /investimentos?[^.]{0,180}/i,
  ];
  const snippets = [];
  for (const needle of needles) {
    const match = normalized.match(needle);
    if (match?.[0]) snippets.push(match[0].slice(0, 260));
  }
  return [...new Set(snippets)].slice(0, 8);
}

function auditCard(card, pages) {
  const merged = mergeEvidence(pages.filter((page) => page.ok).map((page) => page.evidence));
  const issues = [];

  for (const page of pages) {
    if (!page.ok) {
      issues.push({
        severity: "fetch",
        field: "source",
        message: `Could not fetch ${page.url} (${page.status || page.error || "unknown error"})`,
      });
    }
  }

  const structuredFee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  if (typeof structuredFee === "number" && merged.annualFees.length > 0) {
    const closest = closestNumber(structuredFee, merged.annualFees);
    if (closest !== null && Math.abs(closest - structuredFee) > 24) {
      issues.push({
        severity: "high",
        field: "annual_fee",
        message: `Structured annual fee ${structuredFee} differs from source amount ${closest}.`,
        source_values: merged.annualFees,
      });
    }
  }

  const structuredRates = parseStructuredPointRates(card);
  if (structuredRates.length > 0 && merged.rewardRates.length > 0) {
    const maxStructured = Math.max(...structuredRates);
    const maxSource = Math.max(...merged.rewardRates);
    if (Math.abs(maxStructured - maxSource) >= 0.4) {
      issues.push({
        severity: "medium",
        field: "rewards",
        message: `Structured points rate ${maxStructured} pts/USD differs from source ${maxSource} pts/USD.`,
        source_values: merged.rewardRates,
      });
    }
  }

  const structuredCashback = parseStructuredCashbackRates(card);
  if (structuredCashback.length > 0 && merged.cashbackRates.length > 0) {
    const maxStructured = Math.max(...structuredCashback);
    const maxSource = Math.max(...merged.cashbackRates);
    if (Math.abs(maxStructured - maxSource) >= 0.3) {
      issues.push({
        severity: "medium",
        field: "cashback",
        message: `Structured cashback ${maxStructured}% differs from source ${maxSource}%.`,
        source_values: merged.cashbackRates,
      });
    }
  }

  if (card.lounge_access.has_lounge_access) {
    if (!card.lounge_access.unlimited && typeof card.lounge_access.annual_visits !== "number") {
      issues.push({
        severity: "medium",
        field: "lounge",
        message: "Card has lounge access but no structured annual_visits or unlimited=true.",
      });
    }
    if (merged.loungeUnlimited && !card.lounge_access.unlimited) {
      issues.push({
        severity: "medium",
        field: "lounge",
        message: "Source mentions unlimited lounge access but structured unlimited=false.",
      });
    }
    if (!card.lounge_access.unlimited && typeof card.lounge_access.annual_visits === "number") {
      const sourceMax = merged.loungeVisits.length > 0 ? Math.max(...merged.loungeVisits) : null;
      if (sourceMax !== null && sourceMax !== card.lounge_access.annual_visits) {
        issues.push({
          severity: "low",
          field: "lounge",
          message: `Structured annual lounge visits ${card.lounge_access.annual_visits} differs from source ${sourceMax}.`,
          source_values: merged.loungeVisits,
        });
      }
    }
  } else if (
    merged.mentionedPrograms.length > 0 ||
    merged.loungeUnlimited ||
    merged.loungeVisits.length > 0
  ) {
    issues.push({
      severity: "medium",
      field: "lounge",
      message: "Source mentions lounge program/access but structured has_lounge_access=false.",
      source_values: merged.mentionedPrograms,
    });
  }

  const structuredWaiverSpend = (card.fee_waiver_rules ?? [])
    .filter((rule) => rule.category === "monthly_spend" && typeof rule.threshold_brl === "number")
    .map((rule) => rule.threshold_brl);
  if (structuredWaiverSpend.length > 0 && merged.waiverSpendThresholds.length > 0) {
    const minStructured = Math.min(...structuredWaiverSpend);
    const minSource = Math.min(...merged.waiverSpendThresholds);
    if (Math.abs(minStructured - minSource) > 500) {
      issues.push({
        severity: "high",
        field: "fee_waiver_rules",
        message: `Structured spend waiver ${minStructured} differs from source ${minSource}.`,
        source_values: merged.waiverSpendThresholds,
      });
    }
  }

  return {
    card: {
      id: card.card_stable_id,
      display_name: card.display_name,
      issuer: card.issuer_raw,
      source_urls: sourceUrls(card),
    },
    structured: {
      annual_fee: structuredFee,
      reward_summary: card.reward_return.earning_summary,
      lounge: card.lounge_access,
      fee_waiver_rules: card.fee_waiver_rules ?? [],
      eligibility: card.eligibility ?? null,
    },
    extracted: merged,
    issues,
    issueScore: issues.reduce((score, issue) => score + severityScore(issue.severity), 0),
  };
}

function mergeEvidence(items) {
  return {
    annualFees: mergeNumbers(items, "annualFees"),
    waiverSpendThresholds: mergeNumbers(items, "waiverSpendThresholds"),
    waiverInvestmentThresholds: mergeNumbers(items, "waiverInvestmentThresholds"),
    rewardRates: mergeNumbers(items, "rewardRates"),
    cashbackRates: mergeNumbers(items, "cashbackRates"),
    loungeUnlimited: items.some((item) => item.loungeUnlimited),
    loungeVisits: mergeNumbers(items, "loungeVisits"),
    mentionedPrograms: [...new Set(items.flatMap((item) => item.mentionedPrograms ?? []))],
    minInvestment: mergeNumbers(items, "minInvestment"),
    snippets: [...new Set(items.flatMap((item) => item.snippets ?? []))].slice(0, 16),
  };
}

function mergeNumbers(items, key) {
  return [...new Set(items.flatMap((item) => item[key] ?? []))]
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

function parseStructuredPointRates(card) {
  const texts = [
    card.reward_return.earning_summary,
    ...(card.characteristics ?? [])
      .filter((item) => item.key === "earning_rate" || item.key === "earning_detail")
      .map((item) => `${item.value} ${item.details ?? ""}`),
  ];
  return texts.flatMap((text) =>
    [
      ...String(text).matchAll(
        /(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?)\s*(?:por|\/)\s*(?:d[oó]lar|usd)/gi
      ),
    ].map((match) => Number(match[1].replace(",", ".")))
  );
}

function parseStructuredCashbackRates(card) {
  const texts = [
    card.reward_return.earning_summary,
    ...(card.characteristics ?? [])
      .filter((item) => item.key === "earning_rate" || item.key === "earning_detail")
      .map((item) => `${item.value} ${item.details ?? ""}`),
  ];
  return texts.flatMap((text) =>
    [
      ...String(text).matchAll(/(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s*)?(cashback|credito|retorno)/gi),
    ].map((match) => Number(match[1].replace(",", ".")))
  );
}

function closestNumber(target, values) {
  if (values.length === 0) return null;
  return values.reduce((best, value) =>
    Math.abs(value - target) < Math.abs(best - target) ? value : best
  );
}

function severityScore(severity) {
  return severity === "high" ? 5 : severity === "medium" ? 3 : severity === "low" ? 1 : 0;
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function renderMarkdown(summary, reports) {
  const issueReports = reports.filter((report) => report.issues.length > 0);
  const lines = [
    "# Card Source Audit",
    "",
    `Generated: ${summary.generated_at}`,
    `Cards audited: ${summary.cards_audited}`,
    `Source URLs seen: ${summary.urls_seen}`,
    `Issues: ${summary.issue_count}`,
    `Failed fetches: ${summary.failed_fetches}`,
    "",
  ];

  for (const report of issueReports.slice(0, 200)) {
    lines.push(`## ${report.card.display_name}`);
    lines.push("");
    lines.push(`ID: \`${report.card.id}\``);
    lines.push("");
    for (const issue of report.issues) {
      lines.push(`- **${issue.severity} / ${issue.field}**: ${issue.message}`);
      if (issue.source_values)
        lines.push(`  Source values: ${JSON.stringify(issue.source_values)}`);
    }
    if (report.extracted.snippets.length > 0) {
      lines.push("");
      lines.push("Evidence snippets:");
      for (const snippet of report.extracted.snippets.slice(0, 5)) {
        lines.push(`- ${snippet}`);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
