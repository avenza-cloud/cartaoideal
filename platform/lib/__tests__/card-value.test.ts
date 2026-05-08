import { describe, expect, it } from "vitest";
import { scoreCardValue } from "@/lib/card-value";
import { getCardById } from "@/lib/cards";
import type { UserProfile } from "@/types/cards";

const baseProfile: UserProfile = {
  monthlySalaryBrl: 10000,
  avgMonthlySpendBrl: 3000,
  avgInvestedBrl: 1000,
  monthlyInternationalSpendBrl: 0,
  travelFrequency: "occasional",
  spendingCategories: [],
  preferences: {
    wantsLounge: false,
    prefersCashback: true,
    prefersPoints: false,
    prefersInvestback: false,
  },
};

describe("scoreCardValue", () => {
  it("does not value conditional Rico lounge access when investment gate is not met", () => {
    const card = getCardById("rico-rico-visa-infinite-cashback-a93f2e1c7d");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile);

    expect(score.intangibleMonthlyValueBrl).toBe(24);
    expect(score.dataQualityNotes).toContain(
      "Benefício de sala VIP não valorizado porque exige investimento de R$50.000."
    );
  });
});
