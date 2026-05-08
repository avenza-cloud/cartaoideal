import { describe, expect, it } from "vitest";
import { scoreCardValue, scoreCardValues } from "@/lib/card-value";
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

  it("keeps zero-value free cards neutral in the 0-100 score", () => {
    const card = getCardById("nubank-cartao-nubank-5feb686dbf");
    expect(card).toBeDefined();

    const profile: UserProfile = {
      ...baseProfile,
      monthlySalaryBrl: 2000,
      avgMonthlySpendBrl: 1200,
      avgInvestedBrl: 0,
      travelFrequency: "none",
    };

    const directScore = scoreCardValue(card!, profile);
    expect(directScore.netMonthlyValueBrl).toBe(0);
    expect(directScore.grossRewardMonthlyBrl).toBe(0);
    expect(directScore.intangibleMonthlyValueBrl).toBe(0);
    expect(directScore.score0To100).toBe(50);

    const rankedScore = scoreCardValues([card!], profile)[0];
    expect(rankedScore.score0To100).toBe(50);
  });

  it("rewards gains proportionally for lower-spend profiles", () => {
    const card = getCardById("nomad-nomad-explorer-visa-infinite-aae26793ed");
    expect(card).toBeDefined();

    const profile: UserProfile = {
      ...baseProfile,
      monthlySalaryBrl: 2000,
      avgMonthlySpendBrl: 1200,
      avgInvestedBrl: 25000,
      travelFrequency: "none",
    };

    const score = scoreCardValue(card!, profile);
    expect(score.netMonthlyValueBrl).toBeGreaterThanOrEqual(25);
    expect(score.score0To100).toBeGreaterThanOrEqual(80);
  });
});
