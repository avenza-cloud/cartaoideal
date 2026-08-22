# Contributing to Cartão Ideal

Contributions are welcome in English or Portuguese — data fixes, bug reports,
features and docs. This guide covers setup, the test suites, and the two ways
to fix card data.

## Prerequisites

- **Node 22** — `nvm use` picks it up from `.nvmrc`
- **pnpm 10** — `corepack enable` reads the exact version from
  `platform/package.json` (`packageManager`)
- No Python required.

## Setup

```bash
git clone https://github.com/caiotheodoro/cartaoideal.git
cd cartaoideal/platform
pnpm install
cp .env.example .env.local   # optional
pnpm dev
```

### Environment variables

All optional — features degrade gracefully (see `platform/.env.example` for
details):

| Variable | Enables | Without it |
|---|---|---|
| `GEMINI_API_KEY` | AI chat (primary model) | Chat UI renders; requests fail |
| `DEEPSEEK_API_KEY` | AI chat fallback | No fallback if the Gemini call fails |
| `NEXT_PUBLIC_SITE_URL` | Canonical SEO URL | Falls back to Vercel/project default |
| `NEXT_PUBLIC_ADSENSE_*` | Ad slots | Ads disabled entirely |
| `GITHUB_CORRECTIONS_TOKEN` / `GITHUB_CORRECTIONS_REPO` | Correction form → GitHub issue | `/api/corrections` returns 503 |

## Commands (run inside `platform/`)

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server (builds the data artifact first via `predev`) |
| `pnpm build` | Production build |
| `pnpm data:build` | Compile `data/cards/*.json` → `data/generated/cards.json` |
| `node scripts/build-cards-artifact.mjs --check` | Also verify canonical formatting (CI mode) |
| `node scripts/build-cards-artifact.mjs --format` | Rewrite card files into canonical format |
| `pnpm test:unit` | Vitest suite incl. the full data-contract validation |
| `pnpm test:e2e` | Playwright suite (5 viewports; excludes the live-AI spec) |
| `pnpm test:chat` | The live-AI e2e spec (needs a real `GEMINI_API_KEY`) |
| `pnpm check` / `pnpm check:fix` | Biome lint + format check / autofix |
| `pnpm exec tsc --noEmit` | Typecheck |

CI runs: data artifact `--check` → freshness report (non-blocking) → Biome →
unit tests with coverage gates → typecheck → build, plus a separate e2e job.

## Fixing card data

The dataset is **one JSON file per card** in `platform/data/cards/`, validated
against the Zod contract in `platform/lib/card-schema.ts`. Conventions
(`"unknown"` sentinel, additive schema evolution, provenance) are documented
in [`platform/data/README.md`](platform/data/README.md).

### Path A — no repo setup needed

Use the **"Sugerir correção"** form on any card page of the live site, or open
a [card-correction issue](../../issues/new/choose). A maintainer applies the
`correction` label and automation opens a PR with the data diff.

### Path B — direct pull request

1. Edit `platform/data/cards/<card_stable_id>.json`.
2. Update `provenance`: add your source URL and set `last_verified_date`.
3. Run `node scripts/build-cards-artifact.mjs --format` (canonical formatting),
   then `pnpm test:unit`.
4. Open a PR citing the source. Fees and conditions must be verifiable on the
   issuer's official page or another citable public source.

Card **images** are accepted only from official issuer sources and require a
`media.art_provenance` block (`source_url`, `retrieved_date`).

## Pull request expectations

- Small, focused diffs; tests pass (`pnpm test:unit`, `pnpm check`,
  `pnpm exec tsc --noEmit`).
- No drive-by reformatting of files you didn't change.
- Data changes cite sources; code changes explain the why in the description.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Security
issues go through [SECURITY.md](SECURITY.md), not public issues.
