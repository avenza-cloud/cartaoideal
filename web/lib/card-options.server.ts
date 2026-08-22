import "server-only";
import { getAllCards } from "@/lib/cards";
import { CURATED_POPULAR } from "@/lib/card-overrides";
import { normalizeCardSearchText, type ClientCardOption } from "@/lib/card-options";

const POPULAR_HINTS = [
  "nubank",
  "itau",
  "itaú",
  "c6",
  "inter",
  "xp",
  "bradesco",
  "santander",
  "banco do brasil",
  "bb",
  "caixa",
  "btg",
  "porto",
  "mercado pago",
  "picpay",
  "will",
];

function popularityRank(name: string, issuer: string): number {
  const search = normalizeCardSearchText(`${issuer} ${name}`);
  const rank = POPULAR_HINTS.findIndex((hint) => search.includes(normalizeCardSearchText(hint)));
  return rank === -1 ? POPULAR_HINTS.length : rank;
}

const curatedDescriptions = new Map(
  CURATED_POPULAR.map((c) => [c.card_stable_id, c.description_pt])
);

/**
 * The slim projection client card pickers receive as props (~67KB for the full
 * catalog vs ~1.9MB for the facets themselves).
 */
export const CARD_OPTIONS: ClientCardOption[] = getAllCards()
  .map((card) => ({
    id: card.card_stable_id,
    name: card.display_name,
    issuer: card.issuer_raw,
    artUrl: card.media.card_art_url,
    altText: card.media.alt_text,
    popularityRank: popularityRank(card.display_name, card.issuer_raw),
    searchText: normalizeCardSearchText(
      `${card.display_name} ${card.issuer_raw} ${card.network_primary}`
    ),
    description: curatedDescriptions.get(card.card_stable_id),
  }))
  .sort((a, b) => a.popularityRank - b.popularityRank || a.name.localeCompare(b.name, "pt-BR"));

/** Ordered "Mais comuns" list shown when the picker query is empty. */
export const CURATED_CARD_OPTIONS: ClientCardOption[] = CURATED_POPULAR.map((c) =>
  CARD_OPTIONS.find((o) => o.id === c.card_stable_id)
).filter((c): c is ClientCardOption => c !== undefined);
