import type { CardFacet } from "@/types/cards";

/** Resolve card art to a renderable src, or null when only a placeholder should render. */
export function cardArtSrc(url: string | undefined | null): string | null {
  if (!url || url === "unknown") return null;
  return url;
}

/** Normalize sentinel/empty data values to null so rows/labels can be skipped. */
export function displayValue(value: string | undefined | null): string | null {
  if (!value || value === "unknown") return null;
  return value;
}

/** Short initials for the issuer, used by the card-art placeholder. */
export function issuerInitials(issuerRaw: string): string {
  const words = issuerRaw
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ú0-9]/.test(w) && !/^(de|da|do|dos|das|e)$/i.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
