# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

- Preferred: [GitHub private vulnerability reporting](../../security/advisories/new)
- Fallback: email dev.matheustheodoro@gmail.com with subject `[SECURITY] cartaoideal`

You can expect an acknowledgment within **7 days**. Please include reproduction
steps and impact; coordinated disclosure is appreciated.

## Scope

In scope:

- The web application and its API routes (`/api/chat`, `/api/corrections`,
  `/api/recommend`, `/api/cards/top`, `/api/affiliate/*`, `/api/exchange-rate`)
- The GitHub Actions workflows in `.github/workflows/` (especially the
  issue-triggered correction automation)
- Dependency vulnerabilities with a demonstrated impact on the above

Out of scope:

- Inaccuracies in card data — use the correction form or a
  [card-correction issue](../../issues/new/choose)
- Issues on card issuers' own websites
- Rate-limit bypass on a self-hosted/fork deployment using the default
  in-memory limiter (documented as best-effort; see `platform/lib/rate-limit.ts`)

## Data handling

The app stores user financial profiles only in the browser (localStorage),
never logs IPs or profile contents server-side, and sends chat messages to
OpenAI for processing. See the Privacy section of the [README](README.md).
