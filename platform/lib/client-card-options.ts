import { getAllCards } from "@/lib/cards";
import { normalizeSearchText } from "@/lib/filter-cards";
import type { CardFacet } from "@/types/cards";

export interface ClientCardOption {
  id: string;
  name: string;
  issuer: string;
  artUrl: string;
  altText: string;
  popularityRank: number;
  searchText: string;
  description?: string;
}

// Curated "Mais comuns" — shown when search is empty, in order
const CURATED_POPULAR: { id: string; description: string }[] = [
  {
    id: "itau-itau-click-visa-platinum-com-pontos-d763e4b0d0",
    description: "Sem anuidade com vantagens da bandeira.",
  },
  {
    id: "mercado-pago-mercado-pago-visa-gold-5a8ac898a9",
    description: "Muito usado para compras online, fácil aprovação.",
  },
  {
    id: "inter-inter-mastercard-gold-c1c8b413cc",
    description: "Sem anuidade, cashback e conta digital.",
  },
  {
    id: "nubank-cartao-nubank-5feb686dbf",
    description: "O roxinho. Sem anuidade, controle pelo app.",
  },
];

export const CURATED_POPULAR_IDS = new Set(CURATED_POPULAR.map((c) => c.id));

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

export const normalizeCardSearchText = normalizeSearchText;

function popularityRank(name: string, issuer: string): number {
  const search = normalizeCardSearchText(`${issuer} ${name}`);
  const rank = POPULAR_HINTS.findIndex((hint) => search.includes(normalizeCardSearchText(hint)));
  return rank === -1 ? POPULAR_HINTS.length : rank;
}

const curatedMap = new Map(CURATED_POPULAR.map((c) => [c.id, c.description]));

export const CLIENT_CARD_FACETS: CardFacet[] = getAllCards();

const CLIENT_CARD_FACETS_BY_ID = new Map(
  CLIENT_CARD_FACETS.map((card) => [card.card_stable_id, card])
);

export const CLIENT_CARD_OPTIONS: ClientCardOption[] = CLIENT_CARD_FACETS
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
    description: curatedMap.get(card.card_stable_id),
  }))
  .sort(
    (a, b) =>
      a.popularityRank - b.popularityRank ||
      a.name.localeCompare(b.name, "pt-BR")
  );

// Ordered curated list for "Mais comuns" display
export const CURATED_CARDS: ClientCardOption[] = CURATED_POPULAR
  .map((c) => CLIENT_CARD_OPTIONS.find((o) => o.id === c.id))
  .filter((c): c is ClientCardOption => c !== undefined);

export function getClientCardById(id: string): CardFacet | undefined {
  return CLIENT_CARD_FACETS_BY_ID.get(id);
}

export function resolveClientCardByName(query: string): CardFacet | undefined {
  const normalized = normalizeCardSearchText(query.trim());
  if (!normalized) return undefined;

  const exact =
    CLIENT_CARD_OPTIONS.find(
      (option) =>
        option.id === query ||
        normalizeCardSearchText(option.name) === normalized ||
        normalizeCardSearchText(`${option.issuer} ${option.name}`) === normalized
    ) ?? null;

  if (exact) return getClientCardById(exact.id);

  const partial = CLIENT_CARD_OPTIONS.find((option) => option.searchText.includes(normalized));
  return partial ? getClientCardById(partial.id) : undefined;
}
