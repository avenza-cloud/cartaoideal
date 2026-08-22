#!/usr/bin/env node
// Non-blocking freshness report: warns (GitHub ::warning annotations in CI)
// about cards whose provenance.last_verified_date exceeds the budget. Always
// exits 0 — staleness is a signal for contributors, not a build failure.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUDGET_DAYS = 180; // freshness SLA (see platform/data/README.md)

const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "cards");
const now = Date.now();
const stale = [];
let total = 0;

for (const file of readdirSync(cardsDir).sort()) {
  if (!file.endsWith(".json")) continue;
  total += 1;
  const card = JSON.parse(readFileSync(join(cardsDir, file), "utf8"));
  const verified = Date.parse(card.provenance?.last_verified_date ?? "");
  const ageDays = Number.isFinite(verified) ? Math.floor((now - verified) / 86_400_000) : Infinity;
  if (ageDays > BUDGET_DAYS) stale.push({ id: card.card_stable_id, ageDays });
}

if (process.env.GITHUB_ACTIONS && stale.length > 0) {
  console.log(
    `::warning title=Card data freshness::${stale.length}/${total} cards past the ${BUDGET_DAYS}-day verification budget`
  );
}
console.log(`freshness: ${total - stale.length}/${total} within ${BUDGET_DAYS} days`);
for (const { id, ageDays } of stale.slice(0, 20)) {
  console.log(`  stale: ${id} (${ageDays === Infinity ? "sem data" : `${ageDays}d`})`);
}
if (stale.length > 20) console.log(`  … +${stale.length - 20} more`);
