import { describe, expect, it } from "vitest";
import { getAllCards } from "@/lib/cards";
import { DEFAULT_VALUE_ASSUMPTIONS, scoreCardValues } from "@/lib/card-value";
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

describe("server/client scoring parity", () => {
  it("scoreCards (server) and scoreCardValues (client) agree on ranking when given the same assumptions", () => {
    const server = scoreCards(getAllCards(), PROFILE, DEFAULT_VALUE_ASSUMPTIONS).map(
      (s) => s.card.card_stable_id
    );
    const client = scoreCardValues(getAllCards(), PROFILE, "profile", DEFAULT_VALUE_ASSUMPTIONS)
      .filter((s) => s.eligible)
      .map((s) => s.card.card_stable_id);
    expect(server).toEqual(client);
  });

  it("both paths score every eligible card identically", () => {
    const server = scoreCards(getAllCards(), PROFILE, DEFAULT_VALUE_ASSUMPTIONS);
    const clientById = new Map(
      scoreCardValues(getAllCards(), PROFILE, "profile", DEFAULT_VALUE_ASSUMPTIONS).map((s) => [
        s.card.card_stable_id,
        s.score0To100,
      ])
    );
    expect(server.length).toBeGreaterThan(0);
    for (const s of server) {
      expect(clientById.get(s.card.card_stable_id)).toBe(s.valueScore?.score0To100);
    }
  });

  it("all clients share the single card source (getAllCards)", () => {
    const all = getAllCards();
    expect(all.length).toBeGreaterThan(200);
    expect(new Set(all.map((c) => c.card_stable_id)).size).toBe(all.length);
  });
});
