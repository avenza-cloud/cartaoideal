# Source scraper and source-claim pipeline

This documents checklist steps 1–10 for the Cartão Ideal source provenance work.

## Implemented scope

1. Dependencies can now be installed locally with `pnpm install`.
2. Baseline validation commands were run after install.
3. Existing failures are recorded in the task summary, not silently fixed as part of this scraper scope.
4. Added a target-file format at `data/scrape_targets.example.json`.
5. Added a non-mutating scraper CLI: `pnpm scrape:card-sources`.
6. Added generic HTML-to-text extraction using Node built-ins only.
7. Added a source adapter interface in `scripts/sources/adapters.mjs`.
8. Added initial adapters for Itaú, Santander, PagBank, Neon, PAN, Carrefour, plus a generic fallback.
9. Scrape output is written to ignored report space: `audit-reports/scrape-results/`.
10. Added a dry-run-first merge script: `pnpm apply:scrape-results -- --input <result.json>`.

## Target input format

Use `platform/data/scrape_targets.example.json` as the template. For real runs, copy it to a local or reviewed target file, for example `platform/data/scrape_targets.json`.

```json
[
  {
    "card_stable_id": "itau-visa-platinum-8fefddc769",
    "display_name": "Itaú Visa Platinum",
    "issuer": "Itaú",
    "source_url": "https://www.itau.com.br/cartoes/escolha/g/itau-visa-platinum/",
    "source_type": "official_issuer",
    "adapter": "itau"
  }
]
```

## Scraper commands

Run the example target:

```bash
cd platform
pnpm scrape:card-sources -- --limit 1
```

Run a real target file:

```bash
pnpm scrape:card-sources -- --targets data/scrape_targets.json --limit 5
```

Useful filters:

```bash
pnpm scrape:card-sources -- --search itau
pnpm scrape:card-sources -- --card <card_stable_id>
pnpm scrape:card-sources -- --delay-ms 1000 --timeout 20000
```

## Output format

Scrape results are written to:

```text
audit-reports/scrape-results/<timestamp>.json
```

Each result includes:

- card identity;
- source URL and source type;
- adapter used;
- fetch status;
- extracted `source_claims`;
- empty `proposed_patch` placeholders for future structured field updates;
- warnings.

## Merge workflow

The merge script is dry-run by default:

```bash
pnpm apply:scrape-results -- --input audit-reports/scrape-results/<timestamp>.json
```

To write changes:

```bash
pnpm apply:scrape-results -- --input audit-reports/scrape-results/<timestamp>.json --write
```

The script currently only merges `source_claims` into both:

- `data/cards_brazil_catalog_v2.json`
- `data/cards_brazil_ai_comparison_facets.json`

It refuses to silently invent structured values. Future updates can extend `proposed_patch` handling after review.

## Risk controls

- Official issuer pages are prioritized.
- The scraper uses a clear user agent.
- Runs are sequential by default with a delay between requests.
- The first output is non-mutating.
- The merge command is dry-run-first.
- Dynamic fields keep `captured_at`, `last_verified_at`, `raw_excerpt`, and confidence metadata.
- PDF handling is not automated yet; PDFs should be marked as `tariff_pdf` and reviewed manually until a safe extractor is approved.

## Validation commands

```bash
cd platform
pnpm test:unit
pnpm exec tsc --noEmit
pnpm build
node -c scripts/scrape-card-sources.mjs
node -c scripts/apply-scrape-results.mjs
node -c scripts/lib/source-claims.mjs
node -c scripts/sources/adapters.mjs
pnpm scrape:card-sources -- --limit 1
```
