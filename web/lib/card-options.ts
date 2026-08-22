import { normalizeSearchText } from "@/lib/filter-cards";

/**
 * Client-safe card-picker helpers. The option list itself is built server-side
 * (lib/card-options.server.ts) and reaches client components as props — the
 * full catalog never ships to the browser.
 */
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

export const normalizeCardSearchText = normalizeSearchText;

export function cardMatchScore(card: ClientCardOption, query: string): number {
  if (!query) return 100 - card.popularityRank;
  const issuer = normalizeCardSearchText(card.issuer);
  const name = normalizeCardSearchText(card.name);
  if (issuer === query || name === query) return 1000;
  if (issuer.startsWith(query)) return 900;
  if (name.startsWith(query)) return 850;
  if (card.searchText.split(/\s+/).some((token) => token === query)) return 800;
  if (card.searchText.split(/\s+/).some((token) => token.startsWith(query))) return 700;
  if (card.searchText.includes(query)) return 500;
  return -1;
}

/** Ranked picker results: curated list when the query is empty. */
export function searchCardOptions(
  options: ClientCardOption[],
  curated: ClientCardOption[],
  rawQuery: string,
  limit: number
): ClientCardOption[] {
  const query = normalizeCardSearchText(rawQuery.trim());
  if (!query) return curated;
  return options
    .map((card) => ({ card, score: cardMatchScore(card, query) }))
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.card.popularityRank - b.card.popularityRank ||
        a.card.name.localeCompare(b.card.name, "pt-BR")
    )
    .map((item) => item.card)
    .slice(0, limit);
}
