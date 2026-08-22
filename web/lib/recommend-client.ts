import type { CardScore, CardValueScore, UserProfile } from "@/types/cards";

/**
 * Client for POST /api/recommend. No client-side fallback: scoring lives on
 * the server only (shipping the catalog + engine to the browser cost ~2MB of
 * JS). Callers surface an error state and let the user retry.
 */
export interface CurrentCardResult {
  /** Position among eligible cards for this profile; null when not eligible. */
  rank: number | null;
  score: CardValueScore;
}

export interface RecommendResponse {
  scores: CardScore[];
  currentCard: CurrentCardResult | null;
}

export async function fetchRecommendations(
  profile: UserProfile,
  limit = 10
): Promise<RecommendResponse> {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, limit }),
  });
  if (!res.ok) throw new Error(`recommend status ${res.status}`);
  const data = (await res.json()) as RecommendResponse;
  if (!Array.isArray(data?.scores)) throw new Error("recommend payload malformed");
  return data;
}
