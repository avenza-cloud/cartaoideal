# Credit DB — Cartão Ideal

Comparador de cartões de crédito brasileiros. Catálogo estruturado de 299 cartões com
scoring de valor personalizado (renda, gasto, investimento, viagens), ranking, chat com IA,
comparação lado a lado e correções da comunidade via GitHub Issues.

## Estrutura do repositório

- `platform/` — aplicação Next.js 16 (App Router, React 19, Tailwind 4, zustand, Vercel AI SDK).
- `tools/` — pipeline de dados em Python (scraping, localização de imagens, auditoria).
- `.github/workflows/ci.yml` — testes, typecheck, build e validação de dados em cada push/PR.
- `.github/workflows/correction-pr.yml` — transforma issues de correção em PRs.

## Dados

- `platform/data/cards_brazil_ai_comparison_facets.json` — fonte consumida em runtime (facets achatados).
- `platform/data/cards_brazil_catalog_v2.json` — catálogo aninhado completo.
- `platform/data/cards_brazil_raw_sources.json` — capturas brutas das fontes.
- `platform/data/corrections/pending/` — correções da comunidade pendentes de revisão.

Edições manuais no JSON são permitidas, mas o schema é validado em CI
(`lib/__tests__/data-schema.test.ts` e `tools/validate_card_data.py`).

## Começando

```bash
cd platform
pnpm install
pnpm dev          # http://localhost:3000
```

## Testes

```bash
cd platform
pnpm test:unit            # vitest + thresholds de cobertura
pnpm test:e2e             # playwright (desktop/mobile, sem IA real)
pnpm test:chat            # e2e do chat com backend de IA real
pnpm exec tsc --noEmit    # typecheck
```

## Pipeline de dados (Python)

```bash
python3 tools/build_credit_cards_catalog.py   # gera os 3 JSON em tools/ e platform/data/
python3 tools/localize_card_images.py          # baixa artes em public/card-images/
python3 tools/validate_card_data.py            # valida os facets usados na recomendação
pnpm --dir platform audit:card-sources         # auditoria de fontes (Node)
```

## Deploy

Vercel. URL pública e metadados de SEO derivam de `NEXT_PUBLIC_SITE_URL`
(ou `VERCEL_PROJECT_PRODUCTION_URL`), com fallback para `https://cartaoideal.com`.

## Env

- `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` / `NEXT_PUBLIC_ADSENSE_SLOT_CATALOG` /
  `NEXT_PUBLIC_ADSENSE_SLOT_DETAIL` — anúncios (opcional, vazio desativa).
- `GITHUB_CORRECTIONS_TOKEN` / `GITHUB_CORRECTIONS_REPO` — automação de correções (server-only).
