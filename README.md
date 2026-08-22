# Cartão Ideal

[![CI](https://github.com/caiotheodoro/cartaoideal/actions/workflows/ci.yml/badge.svg)](https://github.com/caiotheodoro/cartaoideal/actions/workflows/ci.yml)

Plataforma open-source de comparação de cartões de crédito brasileiros — 299
cartões com tarifas, recompensas, acesso a salas VIP e regras de isenção de
anuidade estruturados, motor de pontuação de valor personalizado, comparação
lado a lado e assistente de chat com IA. Contribuições são bem-vindas em
português ou inglês.

**Documentação da aplicação:** [web/README.md](web/README.md) ·
**Como contribuir:** [CONTRIBUTING.md](CONTRIBUTING.md)

## Funcionalidades

- **Catálogo** (`/cartoes`) — 299 cartões brasileiros, filtráveis por
  bandeira, segmento, tipo de recompensa, anuidade e condições de isenção.
- **Ranking personalizado** — um motor de valor (`web/lib/card-value.ts`)
  estima o valor líquido mensal de cada cartão a partir da sua renda, gasto,
  investimentos e perfil de viagem, incluindo valoração de pontos, spread
  cambial/IOF e modelagem de salas VIP.
- **Comparação** (`/comparar`) — até 4 cartões lado a lado.
- **Chat com IA** (`/chat`) — assistente com tool-calling sobre o mesmo
  catálogo e motor de pontuação.
- **Correções da comunidade** — um formulário em cada página de cartão abre
  uma issue no GitHub; um workflow a transforma em pull request revisável
  contra o arquivo de dados do cartão.

## Estrutura do repositório

| Caminho | O que é |
|---|---|
| `web/` | Aplicação Next.js 16 (App Router, React 19, Tailwind 4, TypeScript) |
| `data/cards/` | **O dataset** — um arquivo JSON por cartão, validado por contrato Zod |
| `web/lib/` | Lógica de domínio: pontuação, isenções, filtros, contrato de dados |
| `scripts/` | Ferramentas de dados: build do artefato, correções, auditoria de fontes |
| `.github/workflows/` | CI, automação de issue-de-correção → PR, auditoria semanal dos dados |

## Começando

```bash
nvm use                 # Node 22 (.nvmrc)
corepack enable         # pnpm 10 (packageManager do package.json)
cd web
pnpm install
cp .env.example .env.local   # opcional — tudo degrada graciosamente
pnpm dev
```

`pnpm dev` compila o dataset por cartão no artefato de runtime automaticamente
(hook `predev`). Veja o [CONTRIBUTING.md](CONTRIBUTING.md) para a referência
completa de comandos, suítes de teste e o fluxo de edição de dados.

## Monetização e neutralidade

Este projeto pode gerar receita com slots do Google AdSense e com parâmetros
de afiliado nos links de "solicitar" (`utm_source=cartaoideal`; overrides de
afiliado por cartão vivem em
[`web/lib/affiliate.ts`](web/lib/affiliate.ts) e estão vazios neste
repositório). **A monetização tem zero influência nos rankings**: o código de
pontuação ([`web/lib/scoring.ts`](web/lib/scoring.ts),
[`web/lib/card-value.ts`](web/lib/card-value.ts)) lê apenas os dados dos
cartões e o perfil do usuário — auditável neste repositório.

## Aviso legal

O Cartão Ideal é conteúdo informativo, não aconselhamento financeiro. Os dados
dos cartões podem estar incompletos ou desatualizados (cada cartão carrega um
`provenance.last_verified_date`); sempre confirme as condições no site oficial
do emissor antes de solicitar.

## Privacidade

- Seu perfil financeiro (renda, gasto, investimentos) é armazenado **apenas no
  seu navegador** (localStorage) e enviado ao servidor de forma transitória
  para calcular rankings; nunca é registrado ou persistido no servidor.
- As mensagens do chat são processadas pelo Google (Gemini) via AI SDK, com o
  DeepSeek como provedor de fallback automático.
- IPs de requisição são usados em memória apenas para rate limiting e não são
  registrados.
- O Vercel Analytics coleta métricas agregadas de uso.

## Licença

- **Código:** [MIT](LICENSE).
- **Dataset** (`data/`): [CC BY 4.0](data/LICENSE) —
  atribuição "Cartão Ideal — github.com/caiotheodoro/cartaoideal". A arte dos
  cartões e as marcas de emissores/bandeiras estão excluídas (propriedade de
  seus titulares, uso nominativo).
