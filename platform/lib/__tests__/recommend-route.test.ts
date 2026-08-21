import { describe, expect, it, vi } from "vitest";

// Deterministic assumptions: the live-FX fetch must not reorder rankings
// depending on network availability.
vi.mock("@/lib/exchange-rate", async () => {
  const { DEFAULT_VALUE_ASSUMPTIONS } = await import("@/lib/card-value");
  return { getValueAssumptionsWithLiveUsd: async () => DEFAULT_VALUE_ASSUMPTIONS };
});

import { POST } from "@/app/api/recommend/route";
import { getAllCards } from "@/lib/cards";
import { DEFAULT_VALUE_ASSUMPTIONS } from "@/lib/card-value";
import { scoreCards } from "@/lib/scoring";
import type { UserProfile } from "@/types/cards";

const PROFILE: UserProfile = {
  monthlySalaryBrl: 12000,
  avgMonthlySpendBrl: 4000,
  avgInvestedBrl: 60000,
  monthlyInternationalSpendBrl: 500,
  travelFrequency: "occasional",
  spendingCategories: ["viagens", "restaurantes"],
  preferences: {
    wantsLounge: true,
    prefersCashback: false,
    prefersPoints: true,
    prefersInvestback: false,
  },
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

// Contract test for the route the clients depend on since the client-side
// scoring fallback was removed: shape, ranking agreement with scoreCards, and
// server-side current-card resolution.
describe("/api/recommend contract", () => {
  it("returns the same top-10 as scoreCards and resolves the current card", async () => {
    const currentId = getAllCards()[40].card_stable_id;
    const res = await POST(
      request({ profile: { ...PROFILE, currentPrimaryCardId: currentId } })
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    const expected = scoreCards(getAllCards(), PROFILE, DEFAULT_VALUE_ASSUMPTIONS)
      .slice(0, 10)
      .map((s) => s.card.card_stable_id);
    expect(data.scores.map((s: { card: { card_stable_id: string } }) => s.card.card_stable_id))
      .toEqual(expected);

    expect(data.currentCard).not.toBeNull();
    expect(data.currentCard.score.card.card_stable_id).toBe(currentId);
    expect(
      data.currentCard.rank === null || typeof data.currentCard.rank === "number"
    ).toBe(true);
  });

  it("respects the limit parameter", async () => {
    const res = await POST(request({ profile: PROFILE, limit: 3 }));
    const data = await res.json();
    expect(data.scores).toHaveLength(3);
  });

  it("rejects an invalid profile with 400", async () => {
    const res = await POST(request({ profile: { nope: true } }));
    expect(res.status).toBe(400);
  });
});
