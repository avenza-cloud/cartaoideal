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
      travelFrequency: "occasional",
    };

    const score = scoreCardValue(card!, profile);
    expect(score.netMonthlyValueBrl).toBeGreaterThanOrEqual(25);
    expect(score.score0To100).toBeGreaterThanOrEqual(80);
  });

  it("uses Membership Rewards sale value for effective monthly return", () => {
    const card = getCardById("santander-santander-american-express-gold-card-f813c0b48b");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
      membershipRewardsPointTravelValuePerThousandBrl: 95,
      membershipRewardsPointSaleValuePerThousandBrl: 45,
    });

    expect(score.pointsRewardMonthlyBrl).toBe(32.4);
    expect(score.pointsRewardMonthlyTravelBrl).toBe(68.4);
    expect(score.dataQualityNotes).toContain(
      "Membership Rewards: retorno realizável de venda em R$45 por 1.000 pontos; potencial de utilizacao em R$95 por 1.000 pontos."
    );
  });

  it("values Livelo and Esfera points in BRL per thousand points", () => {
    const card = getCardById("btg-pactual-btg-pactual-opcao-avancada-79583395cd");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
      liveloPointSaleValuePerThousandBrl: 32,
      liveloPointTravelValuePerThousandBrl: 45,
    });

    expect(score.pointsRewardMonthlyBrl).toBe(30.72);
    expect(score.pointsRewardMonthlyTravelBrl).toBe(43.2);
    expect(score.dataQualityNotes).toContain(
      "Livelo/Esfera: retorno realizável de venda em R$32 por 1.000 pontos; potencial de utilizacao em R$45 por 1.000 pontos."
    );
  });

  it("uses a stricter Livelo sale valuation for non-travelers", () => {
    const card = getCardById("btg-pactual-btg-pactual-opcao-avancada-79583395cd");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, {
      ...baseProfile,
      travelFrequency: "none",
      preferences: {
        wantsLounge: false,
        prefersCashback: true,
        prefersPoints: false,
        prefersInvestback: false,
      },
    });

    expect(score.dataQualityNotes).toContain(
      "Livelo/Esfera: retorno realizável de venda em R$20 por 1.000 pontos; potencial de utilizacao em R$45 por 1.000 pontos."
    );
    expect(score.components.find((component) => component.key === "rewards")?.explanation).toContain(
      "Livelo/Esfera a R$20/1k pts (venda)"
    );
  });

  it("uses a stricter generic sale valuation for non-travelers", () => {
    const card = getCardById("c6-bank-c6-mastercard-black-42584fec91");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, {
      ...baseProfile,
      travelFrequency: "none",
      preferences: {
        wantsLounge: false,
        prefersCashback: true,
        prefersPoints: false,
        prefersInvestback: false,
      },
    });

    expect(score.dataQualityNotes).toContain(
      "Programa de pontos não identificado; usado retorno conservador de R$20 por 1.000 pontos e potencial de utilizacao de R$45 por 1.000 pontos."
    );
    expect(score.components.find((component) => component.key === "rewards")?.explanation).toContain(
      "pontos a R$20/1k pts (venda)"
    );
  });

  it("applies only a light score adjustment for user reward preferences", () => {
    const card = getCardById("santander-santander-american-express-gold-card-f813c0b48b");
    expect(card).toBeDefined();

    const cashbackProfile: UserProfile = {
      ...baseProfile,
      preferences: {
        wantsLounge: false,
        prefersCashback: true,
        prefersPoints: false,
        prefersInvestback: false,
      },
    };
    const pointsProfile: UserProfile = {
      ...baseProfile,
      preferences: {
        wantsLounge: false,
        prefersCashback: false,
        prefersPoints: true,
        prefersInvestback: false,
      },
    };

    const cashbackScore = scoreCardValue(card!, cashbackProfile);
    const pointsScore = scoreCardValue(card!, pointsProfile);

    expect(pointsScore.netMonthlyValueBrl).toBe(cashbackScore.netMonthlyValueBrl);
    expect(pointsScore.score0To100 - cashbackScore.score0To100).toBeGreaterThanOrEqual(5);
    expect(pointsScore.score0To100 - cashbackScore.score0To100).toBeLessThanOrEqual(6);
  });

  it("uses a broader break-even that includes benefits and international costs", () => {
    const card = getCardById("caixa-caixa-icone-visa-infinite-421cd080e8");
    expect(card).toBeDefined();

    const domesticOnly = scoreCardValue(card!, {
      ...baseProfile,
      avgMonthlySpendBrl: 12_000,
      monthlyInternationalSpendBrl: 0,
    });
    const withInternational = scoreCardValue(card!, {
      ...baseProfile,
      avgMonthlySpendBrl: 12_000,
      monthlyInternationalSpendBrl: 2_000,
    });

    expect(domesticOnly.breakEvenMonthlySpendBrl).not.toBeNull();
    expect(domesticOnly.breakEvenByRewardsOnlyMonthlySpendBrl).not.toBeNull();
    expect(domesticOnly.breakEvenMonthlySpendBrl!).toBeLessThanOrEqual(
      domesticOnly.breakEvenByRewardsOnlyMonthlySpendBrl!
    );
    expect(withInternational.internationalMonthlyCostBrl).toBeGreaterThan(0);
    if (withInternational.breakEvenMonthlySpendBrl === null) {
      expect(withInternational.netMonthlyValueBrl).toBeLessThanOrEqual(0);
    } else {
      expect(withInternational.breakEvenMonthlySpendBrl).toBeGreaterThan(
        domesticOnly.breakEvenMonthlySpendBrl!
      );
    }
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

  it("applies Centurion account-holder annual fee condition", () => {
    const card = getCardById("bradesco-bradesco-american-express-the-centurion-card-6d6ffcfe73");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile);

    expect(score.effectiveAnnualFeeBrl).toBe(18_000);
    expect(score.feeAppliedReason).toBe(
      "Anuidade efetiva de R$18.000 após regra estruturada."
    );
    expect(score.dataQualityNotes).toContain(
      "Anuidade de correntista aplicada por condição estruturada."
    );
  });
});
