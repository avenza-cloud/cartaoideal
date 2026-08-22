# Dataset — Catálogo de cartões de crédito brasileiros

## Licença

O conjunto de dados estruturado neste diretório (arquivos JSON de cartões) é licenciado sob
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) como compilação própria do mantenedor.
Atribuição sugerida: **"Cartão Ideal — github.com/caiotheodoro/cartaoideal"**.

**Exclusões**: a licença cobre apenas os dados estruturados. Não cobre:

- Arte de cartões (`platform/public/card-images/`) — propriedade dos emissores, usada de forma
  nominativa para identificação do produto, cada arquivo com procedência registrada em
  `media.art_provenance`.
- Marcas, nomes de produtos e logotipos de emissores e bandeiras — pertencem aos seus titulares.

## Procedência

Os fatos aqui compilados (tarifas, benefícios, regras de isenção, elegibilidade) foram levantados
a partir de fontes públicas — páginas oficiais de emissores e rankings/análises editoriais de
terceiros — e são **citados por URL** nos campos `source_url` / `primary_evidence_url` de cada
cartão. Nenhum texto editorial de terceiros é reproduzido literalmente neste repositório, e
nenhuma imagem de terceiros é redistribuída. O site
[passageirodeprimeira.com](https://passageirodeprimeira.com) foi uma fonte de descoberta e
ranqueamento relevante na compilação inicial e é creditado aqui; seu conteúdo permanece apenas
como citação (link), nunca como cópia.

O pipeline original de captação foi aposentado. Os arquivos por cartão neste diretório são a
única fonte de verdade, mantida por pull requests.

## Convenções

- **Sentinela `"unknown"`**: campos cujo valor não foi verificado carregam a string `"unknown"`
  (nunca `null` implícito ou campo ausente em campos obrigatórios). Consumidores devem tratar
  `"unknown"` como "não sabemos", não como "não tem".
- **Dados podem estar desatualizados**: cada cartão carrega `provenance.last_verified_date`.
  Confirme sempre as condições no site oficial do emissor antes de contratar.

## Evolução do schema

Ver `SCHEMA_CHANGELOG` abaixo. Política:

- Mudanças **aditivas** apenas: campos novos entram como opcionais.
- Valores de enum podem ser **adicionados** (bump menor de `schema_version`); nunca renomeados ou
  removidos sem bump maior acompanhado de script de migração.

### SCHEMA_CHANGELOG

- **1.0** — formato original (`cards_brazil_ai_comparison_facets.json`).
