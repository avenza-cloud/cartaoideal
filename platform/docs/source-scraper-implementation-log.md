# Source scraper implementation log

Date: 2026-05-09

## Checklist steps 1–10 status

1. `pnpm install` completed successfully in `platform/`.
2. Baseline validation was run after install.
3. Existing validation failures were recorded and left unchanged because they are outside the scraper checklist scope.
4. Added target format: `platform/data/scrape_targets.example.json`.
5. Added non-mutating scraper CLI: `platform/scripts/scrape-card-sources.mjs`.
6. Added generic HTML text extraction helpers: `platform/scripts/lib/source-claims.mjs`.
7. Added adapter selection/interface: `platform/scripts/sources/adapters.mjs`.
8. Added initial adapters: Itaú, Santander, PagBank, Neon, PAN, Carrefour, generic fallback.
9. Scrape outputs are written to `platform/audit-reports/scrape-results/`.
10. Added dry-run merge script: `platform/scripts/apply-scrape-results.mjs`.

## Package scripts added

- `pnpm scrape:card-sources`
- `pnpm apply:scrape-results`

## Validation performed

```bash
cd platform && pnpm install
```

Result: success.

```bash
cd platform && pnpm test:unit
```

Result: failed before scraper implementation changes were applied to tests/data behavior.
Known failures:

- `lib/__tests__/ai-tools.test.ts`: expected investment-waiver card count `45`, actual `46`.
- `lib/__tests__/ai-tools.test.ts`: expected C6 Mastercard Black fixture behavior no longer matches current data.
- `lib/__tests__/cards.test.ts`: expected missing fee waiver to return `null`, but card data now has general zero-fee rules.
- `lib/__tests__/fee-waiver.test.ts`: C6 Mastercard Black lookup returned `undefined`, causing fixture failures.

```bash
cd platform && pnpm exec tsc --noEmit
```

Result: success.

```bash
cd platform && pnpm build
```

Result: success.

```bash
cd platform && node -c scripts/scrape-card-sources.mjs
cd platform && node -c scripts/apply-scrape-results.mjs
cd platform && node -c scripts/lib/source-claims.mjs
cd platform && node -c scripts/sources/adapters.mjs
```

Result: success.

```bash
cd platform && pnpm scrape:card-sources -- --limit 1
```

Result: script executed and wrote a non-mutating result. The Itaú example URL returned HTTP 403, so no claims were extracted for that URL.

A separate 3-target smoke run against PagBank, Neon, and Santander official URLs extracted 9 claims total and wrote a non-mutating scrape result.

```bash
cd platform && pnpm apply:scrape-results -- --input audit-reports/scrape-results/2026-05-09T21-52-04-172Z.json
```

Result: dry run succeeded. It matched 2 cards, would add 9 claims, and warned that Santander SX had no extracted claims.

```bash
cd platform && node -e "JSON.parse(require('fs').readFileSync('data/cards_brazil_catalog_v2.json','utf8')); JSON.parse(require('fs').readFileSync('data/cards_brazil_ai_comparison_facets.json','utf8')); console.log('json ok')"
```

Result: success.

```bash
cd platform && pnpm audit:source-claims -- --search pagbank
```

Result: success, 0 issues for PagBank.

```bash
cd platform && pnpm audit:card-sources -- --limit 5 --concurrency 2
```

Result: completed with existing source-fetch/content issues in 3 of 5 audited cards: 4 total issues, 2 failed fetches.

## Follow-up implementation: checklist steps 11–20

Date: 2026-05-09

Implemented:

- Added priority scrape target file for the 8 newly added cards: `data/scrape_targets.priority.json`.
- Ran scraper against the 8 priority targets.
- Applied valid extracted claims for matching successful scrape results; blocked/empty issuer pages were left unchanged.
- Added freshness audit script: `scripts/audit-source-freshness.mjs`.
- Added package script: `pnpm audit:source-freshness`.
- Added expansion backlog: `data/card_expansion_backlog.json`.
- Updated unit tests to match current catalog data after card expansion and fee-waiver schema changes.
- Added local testing guide: `docs/testing-setup.md`.

Validation after follow-up:

```bash
cd platform && pnpm test:unit
```

Result: 48 passed.

```bash
cd platform && pnpm exec tsc --noEmit
```

Result: passed.

```bash
cd platform && pnpm build
```

Result: passed.

```bash
cd platform && pnpm audit:source-freshness -- --search pagbank
```

Result: 0 issues.

```bash
cd platform && pnpm audit:source-claims -- --search neon
```

Result: 0 issues.

## Notes

- No new npm dependencies were added.
- Scraper extraction is intentionally conservative; blocked pages are reported, not forced.
- The unrelated untracked `.pi/` directory remains untouched.
