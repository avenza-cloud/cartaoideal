// Add card-specific affiliate override URLs here.
// Key: card_stable_id, Value: your affiliate URL (already includes tracking params).
// When empty, falls back to the card's application_url with UTM params appended.
const AFFILIATE_OVERRIDES: Record<string, string> = {
  // "nubank-cartao-nubank-5feb686dbf": "https://example.com/ref/nubank",
};

const UTM = {
  utm_source: "cartaoideal",
  utm_medium: "affiliate",
  utm_campaign: "cartao",
} as const;

export function getApplicationUrl(card: {
  card_stable_id: string;
  application_url?: string;
}): string | null {
  const override = AFFILIATE_OVERRIDES[card.card_stable_id];
  if (override) return override;

  const base = card.application_url;
  if (!base || base === "unknown") return null;

  try {
    const url = new URL(base);
    for (const [k, v] of Object.entries(UTM)) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    }
    return url.toString();
  } catch {
    return base;
  }
}

export function affiliateClickUrl(cardId: string, applicationUrl: string): string {
  return `/api/affiliate/${cardId}?dest=${encodeURIComponent(applicationUrl)}`;
}
