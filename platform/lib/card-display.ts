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

export function networkGradientClass(network: CardFacet["network_primary"]): string {
  switch (network) {
    case "Visa":
      return "from-blue-950 via-blue-900 to-indigo-800";
    case "Mastercard":
      return "from-zinc-950 via-orange-950 to-red-900";
    case "Elo":
      return "from-zinc-950 via-zinc-900 to-yellow-900";
    case "American Express":
      return "from-slate-950 via-cyan-950 to-teal-900";
    default:
      return "from-zinc-950 via-zinc-900 to-zinc-800";
  }
}
