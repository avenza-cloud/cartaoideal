# Cartão Ideal

[![CI](https://github.com/caiotheodoro/cartaoideal/actions/workflows/ci.yml/badge.svg)](https://github.com/caiotheodoro/cartaoideal/actions/workflows/ci.yml)

An open-source comparison platform for Brazilian credit cards — 299 cards with
structured fees, rewards, lounge access and fee-waiver rules, a personalized
value-scoring engine, side-by-side comparison, and an AI chat assistant.
Product UI is in Brazilian Portuguese; the codebase and docs welcome
contributors in English or Portuguese.

**Documentação em português:** [platform/README.md](platform/README.md) ·
**Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)

## Features

- **Catalog** (`/cartoes`) — 299 Brazilian cards, filterable by network,
  segment, rewards type, fee and fee-waiver conditions.
- **Personalized ranking** — a value engine (`platform/lib/card-value.ts`)
  estimates net monthly value per card from your income, spend, investments
  and travel profile, including point valuations, FX spread/IOF and lounge
  modeling.
- **Compare** (`/comparar`) — up to 4 cards side by side.
- **AI chat** (`/chat`) — tool-calling assistant over the same catalog and
  scoring engine.
- **Community corrections** — a form on every card page files a GitHub issue;
  a workflow turns it into a reviewable pull request against the card's data
  file.

## Repository layout

| Path | What it is |
|---|---|
| `platform/` | Next.js 16 app (App Router, React 19, Tailwind 4, TypeScript) |
| `platform/data/cards/` | **The dataset** — one JSON file per card, validated by a Zod contract |
| `platform/lib/` | Domain logic: scoring, fee waivers, filtering, data contract |
| `.github/workflows/` | CI, correction-issue-to-PR automation, weekly data health audit |

## Quickstart

```bash
nvm use                 # Node 22 (.nvmrc)
corepack enable         # pnpm 10 (package.json packageManager)
cd platform
pnpm install
cp .env.example .env.local   # optional — everything degrades gracefully
pnpm dev
```

`pnpm dev` compiles the per-card dataset into the runtime artifact
automatically (`predev` hook). See [CONTRIBUTING.md](CONTRIBUTING.md) for the
full command reference, test suites and the data-editing workflow.

## Monetization & neutrality

This project may earn revenue from Google AdSense slots and from affiliate
parameters on outbound "apply" links (`utm_source=cartaoideal`; per-card
affiliate overrides live in
[`platform/lib/affiliate.ts`](platform/lib/affiliate.ts) and are empty in this
repository). **Monetization has zero input into rankings**: the scoring code
([`platform/lib/scoring.ts`](platform/lib/scoring.ts),
[`platform/lib/card-value.ts`](platform/lib/card-value.ts)) reads only card
data and user profile — auditable in this repo.

## Disclaimer

Cartão Ideal is informational content, not financial advice. Card data can be
incomplete or out of date (each card carries a `provenance.last_verified_date`);
always confirm conditions on the issuer's official site before applying.

## Privacy

- Your financial profile (income, spend, investments) is stored **only in
  your browser** (localStorage) and sent to the server transiently to compute
  rankings; it is never logged or persisted server-side.
- Chat messages are processed by OpenAI via the AI SDK.
- Request IPs are used in-memory for rate limiting only and are not logged.
- Vercel Analytics collects aggregate usage metrics.

## License

- **Code:** [MIT](LICENSE).
- **Dataset** (`platform/data/`): [CC BY 4.0](platform/data/LICENSE) —
  attribution "Cartão Ideal — github.com/caiotheodoro/cartaoideal". Card
  artwork and issuer/network trademarks are excluded (property of their
  owners, used nominatively).
