# Local testing setup

## One-time setup

From the repository root:

```bash
cd platform
pnpm install
```

## Fast validation loop

```bash
cd platform
pnpm test:unit
pnpm exec tsc --noEmit
pnpm build
```

## Data/source validation

```bash
cd platform
node -e "JSON.parse(require('fs').readFileSync('data/cards_brazil_catalog_v2.json','utf8')); JSON.parse(require('fs').readFileSync('data/cards_brazil_ai_comparison_facets.json','utf8')); console.log('json ok')"
pnpm audit:source-claims
pnpm audit:source-freshness
pnpm audit:card-sources -- --limit 20 --concurrency 2
```

## Scraper smoke test

```bash
cd platform
pnpm scrape:card-sources -- --targets data/scrape_targets.priority.json --limit 3 --delay-ms 250
```

This writes a non-mutating result to `audit-reports/scrape-results/`.

Dry-run merge:

```bash
pnpm apply:scrape-results -- --input audit-reports/scrape-results/<timestamp>.json
```

Write merge only after reviewing the result:

```bash
pnpm apply:scrape-results -- --input audit-reports/scrape-results/<timestamp>.json --write
```

## Run the app locally

```bash
cd platform
pnpm dev
```

Then open the local URL printed by Next.js, usually `http://localhost:3000`.

Useful pages:

- `/cartoes`
- `/cartoes/pagbank-cartao-de-credito`
- `/cartoes/neon-cartao-de-credito`
- `/chat`

## Current expected state

As of this setup pass:

- `pnpm test:unit` passes: 48 tests.
- `pnpm exec tsc --noEmit` passes.
- `pnpm build` passes.
- Source freshness audit passes for PagBank.
- Source-claim audit passes for Neon.

Some issuer pages block automated fetches or return sparse HTML. Treat those as normal audit findings, not app failures.
