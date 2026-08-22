# Cartão Ideal — plataforma

Comparador de cartões de crédito brasileiros. Catálogo estruturado de 299 cartões com
scoring de valor personalizado (renda, gasto, investimento, viagens), ranking, chat com IA,
comparação lado a lado e correções da comunidade via GitHub Issues.

Documentação geral em inglês no [README raiz](../README.md); guia de contribuição em
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Estrutura do repositório

- `web/` — aplicação Next.js 16 (App Router, React 19, Tailwind 4, zustand, Vercel AI SDK).
- `data/cards/` — **o dataset**: um arquivo JSON por cartão (fonte de verdade).
- `scripts/` — ferramentas de dados (build do artefato, correções, auditorias).
- `.github/workflows/ci.yml` — dados, lint, testes, typecheck e build em cada push/PR.
- `.github/workflows/correction-pr.yml` — transforma issues de correção em PRs com o diff do dado.
- `.github/workflows/data-health.yml` — auditoria semanal de frescor e link-rot das fontes.

## Dados

- `data/cards/<card_stable_id>.json` — um arquivo por cartão, formato canônico.
- `web/data/generated/cards.json` — artefato de runtime compilado no build (gitignored).
- `data/card_overrides.json` — dados de negócio por cartão (curadoria, tiers Nomad, Smiles).
- Contrato de dados: `web/lib/card-schema.ts` (Zod) — validado sobre todos os cartões em CI
  (`lib/__tests__/card-data.test.ts`). Convenções (sentinela `"unknown"`, evolução aditiva,
  procedência) em [`data/README.md`](../data/README.md); licença do dataset em
  [`data/LICENSE`](../data/LICENSE) (CC BY 4.0).

Edite o arquivo do cartão, rode `node ../scripts/build-cards-artifact.mjs --format` e
`pnpm test:unit` — o fluxo completo está no CONTRIBUTING.

## Começando

```bash
nvm use            # Node 22
corepack enable    # pnpm 10
cd web
pnpm install
cp .env.example .env.local   # opcional
pnpm dev                     # http://localhost:3000 (compila o dataset via predev)
```

## Testes e qualidade

```bash
cd web
pnpm test:unit            # vitest + contrato de dados + thresholds de cobertura
pnpm test:e2e             # playwright (desktop/mobile, sem IA real)
pnpm test:chat            # e2e do chat com backend de IA real (GEMINI_API_KEY)
pnpm check                # biome (lint + formato)
pnpm exec tsc --noEmit    # typecheck
```

## Scripts de dados (Node)

```bash
pnpm data:build                                      # compila data/cards → artefato de runtime
node ../scripts/build-cards-artifact.mjs --check     # + valida formato canônico (modo CI)
node ../scripts/build-cards-artifact.mjs --format    # reformata arquivos de cartão
node ../scripts/report-data-freshness.mjs            # relatório de frescor (não bloqueante)
pnpm audit:card-sources                           # auditoria de fontes / link-rot
```

O pipeline original de captação (Python) foi aposentado — os arquivos por cartão são a única
fonte de verdade, mantida por pull requests.

## Deploy

Vercel. URL pública e metadados de SEO derivam de `NEXT_PUBLIC_SITE_URL`
(ou `VERCEL_PROJECT_PRODUCTION_URL`), com fallback para `https://cartaoideal.com`
(`lib/site.ts`).

## Env

Ver `web/.env.example` (tudo opcional; cada recurso degrada graciosamente):

- `GEMINI_API_KEY` — chat com IA (`/api/chat`, modelo primário Gemini; `GEMINI_MODEL` opcional).
- `DEEPSEEK_API_KEY` — fallback automático do chat quando a chamada ao Gemini falha (`DEEPSEEK_MODEL`/`DEEPSEEK_BASE_URL` opcionais).
- `NEXT_PUBLIC_SITE_URL` — URL canônica para SEO.
- `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` / `NEXT_PUBLIC_ADSENSE_SLOT_CATALOG` /
  `NEXT_PUBLIC_ADSENSE_SLOT_DETAIL` — anúncios (vazio desativa).
- `GITHUB_CORRECTIONS_TOKEN` / `GITHUB_CORRECTIONS_REPO` — automação de correções
  (server-only; sem eles o endpoint responde 503).
