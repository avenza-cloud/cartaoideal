# Arquivo de arte de cartões — quarentena de procedência

46 imagens de arte de cartão removidas de `web/public/card-images/` por não
terem procedência verificada (origem: blog de terceiros). Ficam aqui — fora
do app e do dataset — até serem substituídas ou confirmadas com arte oficial
do emissor.

**Não referencie estas URLs no dataset.** Para promover uma imagem ao app:

1. Confirme a arte na página oficial do emissor.
2. Copie o arquivo para `web/public/card-images/` na branch principal.
3. Adicione o bloco `media.art_provenance` (`source_url`, `retrieved_date`)
   no JSON do cartão e ajuste `media.card_art_url`.
4. Rode `node ../scripts/build-cards-artifact.mjs --format && pnpm test:unit`.

URL bruta de cada imagem:
`https://raw.githubusercontent.com/avenza-cloud/cartaoideal/card-art-archive/images/<arquivo>`
