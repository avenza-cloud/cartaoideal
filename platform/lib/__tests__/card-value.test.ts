import { describe, expect, it } from "vitest";
import { DEFAULT_VALUE_ASSUMPTIONS, scoreCardValue, scoreCardValues } from "@/lib/card-value";
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

  it("values Membership Rewards in BRL per thousand points", () => {
    const card = getCardById("santander-santander-american-express-gold-card-f813c0b48b");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
      membershipRewardsPointValuePerThousandBrl: 95,
    });

    expect(score.pointsRewardMonthlyBrl).toBe(68.4);
    expect(score.dataQualityNotes).toContain(
      "Membership Rewards: usado R$95 por 1.000 pontos para uso em parceiros/viagens."
    );
  });

  it("values Livelo and Esfera points in BRL per thousand points", () => {
    const card = getCardById("btg-pactual-btg-pactual-opcao-avancada-79583395cd");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
      liveloPointValuePerThousandBrl: 32,
    });

    expect(score.pointsRewardMonthlyBrl).toBe(30.72);
    expect(score.dataQualityNotes).toContain(
      "Livelo/Esfera: usado R$32 por 1.000 pontos."
    );
  });

  it("applies CAIXA Icone annual-fee cashback tiers", () => {
    const card = getCardById("caixa-caixa-icone-visa-infinite-421cd080e8");
    expect(card).toBeDefined();

    const belowTier = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 12_000 });
    const halfTier = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 12_500 });
    const fullTier = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 25_000 });

    expect(belowTier.effectiveAnnualFeeBrl).toBe(1650);
    expect(halfTier.effectiveAnnualFeeBrl).toBe(825);
    expect(fullTier.effectiveAnnualFeeBrl).toBe(0);
  });
});
