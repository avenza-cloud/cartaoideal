import { describe, expect, it } from "vitest";
import {
  applyPercentileScores,
  compareCardValueScores,
  DEFAULT_VALUE_ASSUMPTIONS,
  decisionMonthlyValue,
  netMonthlyValueForRanking,
  scoreCardInContext,
  scoreCardValue,
  scoreCardValues,
  travelFrequencyForValueModeling,
} from "@/lib/card-value";
import { getCardById, getAllCards } from "@/lib/cards";
import type { CardFacet, CardValueScore, UserProfile } from "@/types/cards";

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

function rewardAuditText(card: CardFacet): string {
  return [
    card.display_name,
    card.variant_band,
    card.reward_return?.earning_summary,
    card.lounge_access?.summary,
    ...(card.characteristics ?? []).map(
      (item) => `${item.label} ${item.value} ${item.details ?? ""}`
    ),
  ].join(" ");
}

function isPremiumVariant(card: CardFacet): boolean {
  return (
    card.market_segment_guess === "premium" ||
    card.market_segment_guess === "ultra_premium" ||
    /black|platinum|infinite|signature|grafite|private|personnalit|uniclass/i.test(
      `${card.display_name} ${card.variant_band}`
    )
  );
}

function hasExplicitNumericRewardSignal(card: CardFacet): boolean {
  const text = rewardAuditText(card);
  return (
    /(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?)\s*(?:por|\/)\s*(?:d[oó]lar|usd|real|r\$)/i.test(text) ||
    /(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s*)?(cashback|investback|retorno|cr[eé]dito na fatura)/i.test(
      text
    )
  );
}

describe("scoreCardValue", () => {
  it("does not value conditional Rico lounge access when neither spend nor investment gate is met", () => {
    const card = getCardById("rico-rico-visa-infinite-cashback-a93f2e1c7d");
    expect(card).toBeDefined();

    // Rico lounge requires R$50k invested OR R$3k monthly spend — profile meets neither
    const lowProfile: UserProfile = {
      ...baseProfile,
      avgMonthlySpendBrl: 1500,
      avgInvestedBrl: 1000,
    };
    const score = scoreCardValue(card!, lowProfile);

    expect(score.intangibleMonthlyValueBrl).toBe(24);
    expect(score.dataQualityNotes).toContain(
      "Benefício de sala VIP não valorizado porque exige gasto mensal de R$3.000 ou investimento de R$50.000."
    );
  });

  it("single-card score is the percentile in a set of one (no absolute bump)", () => {
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
    expect(directScore.decisionMonthlyValueBrl).toBe(0);
    expect(directScore.grossRewardMonthlyBrl).toBe(0);
    expect(directScore.intangibleMonthlyValueBrl).toBe(0);
    expect(directScore.score0To100).toBe(100);

    const rankedScore = scoreCardValues([card!], profile)[0];
    expect(rankedScore.score0To100).toBe(100);
  });

  it("Nomad stays near the top for a lower-spend investor (in-context percentile)", () => {
    const card = getCardById("nomad-nomad-explorer-visa-infinite-aae26793ed");
    expect(card).toBeDefined();

    const profile: UserProfile = {
      ...baseProfile,
      monthlySalaryBrl: 2000,
      avgMonthlySpendBrl: 1200,
      avgInvestedBrl: 25000,
      travelFrequency: "occasional",
    };

    // 25.000 / 4,96 = US$5.040 → 3,0 pts/USD; 1.200 / 4,96 × 3 = 725,806 pts × R$22/1k = 15,968;
    // sala VIP 4 acessos × R$80 / 12 = 26,667 → venda 42,634 → 42,63.
    const score = scoreCardInContext(card!, getAllCards(), profile);
    expect(score.netMonthlyValueBrl).toBe(42.63);
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
      "Membership Rewards: retorno realizável de venda em R$45 por 1.000 pontos; potencial de utilização em R$95 por 1.000 pontos."
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
      "Livelo/Esfera: retorno realizável de venda em R$32 por 1.000 pontos; potencial de utilização em R$45 por 1.000 pontos."
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
      "Livelo/Esfera: retorno realizável de venda em R$20 por 1.000 pontos; potencial de utilização em R$45 por 1.000 pontos. Venda limitada a R$20/1k porque o perfil não viaja (sem utilização em viagem)."
    );
    expect(
      score.components.find((component) => component.key === "rewards")?.explanation
    ).toContain("Livelo/Esfera a R$20/1k pts (venda)");
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
      "Programa de pontos não identificado; usado retorno conservador de R$20 por 1.000 pontos e potencial de utilização de R$45 por 1.000 pontos (limitado ao da Livelo). Venda limitada a R$20/1k porque o perfil não viaja (sem utilização em viagem)."
    );
    expect(
      score.components.find((component) => component.key === "rewards")?.explanation
    ).toContain("pontos a R$20/1k pts (venda)");
  });

  it("reward preferences do not change the value, the decision value or the score", () => {
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
    expect(pointsScore.decisionMonthlyValueBrl).toBe(cashbackScore.decisionMonthlyValueBrl);
    expect(scoreCardInContext(card!, getAllCards(), pointsProfile).score0To100).toBe(
      scoreCardInContext(card!, getAllCards(), cashbackProfile).score0To100
    );
    expect(pointsScore.scoreDrivers.join(" ")).not.toMatch(/Preferências/);
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

    const midTier = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 12_600 });
    expect(midTier.effectiveAnnualFeeBrl).toBe(825);

    expect(belowTier.effectiveAnnualFeeBrl).toBe(1650);
    expect(halfTier.effectiveAnnualFeeBrl).toBe(825);
    expect(fullTier.effectiveAnnualFeeBrl).toBe(0);
  });

  it("applies CAIXA Mastercard Black monthly-fee cashback tiers correctly", () => {
    const card = getCardById("caixa-caixa-mastercard-black-fee0bdc264");
    expect(card).toBeDefined();

    const belowTier = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 3_999 });
    const halfTier = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 4_500 });
    const fullTier = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 8_000 });

    expect(belowTier.effectiveAnnualFeeBrl).toBe(921);
    expect(halfTier.effectiveAnnualFeeBrl).toBe(460.5);
    expect(fullTier.effectiveAnnualFeeBrl).toBe(0);
    expect(card!.fee_waiver_rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ threshold_brl: 4000, full_waiver: false }),
        expect.objectContaining({ threshold_brl: 8000, full_waiver: true }),
      ])
    );
  });

  it("applies Banco PAN Mastercard Platinum annual fee waiver only from R$5k/month spend", () => {
    const card = getCardById("banco-pan-banco-pan-mastercard-platinum-8a57720e28");
    expect(card).toBeDefined();

    const belowWaiver = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 4_999 });
    const atWaiver = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 5_000 });

    expect(belowWaiver.effectiveAnnualFeeBrl).toBe(500);
    expect(atWaiver.effectiveAnnualFeeBrl).toBe(0);
  });

  it("does not apply Magalu-only Dinheiro de Volta to general monthly spend (no 1% fallback)", () => {
    const card = getCardById("itau-magalu-visa-platinum");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 3_000 });
    expect(score.grossRewardMonthlyBrl).toBe(0);
    expect(score.dataQualityNotes).toEqual(
      expect.arrayContaining([
        "Cashback identificado apenas como bônus/categoria específica; não aplicado ao gasto geral.",
      ])
    );
  });

  it("scores Porto Bank Visa Infinite Privilege with non-zero points return", () => {
    const card = getCardById("porto-bank-porto-bank-visa-infinite-privilege-54faff3c16");
    expect(card).toBeDefined();

    // earning_summary is "Até 5,0 pontos por dólar gasto" — ceiling-only phrasing
    // must still produce a non-zero points return
    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
    });

    expect(score.pointsRewardMonthlyBrl).toBeGreaterThan(0);
    expect(score.grossRewardMonthlyBrl).toBeGreaterThan(0);
    expect(score.dataQualityNotes).toContain(
      "Taxa de pontos informada como teto máximo; retorno calculado com taxa máxima declarada de forma conservadora."
    );
  });

  it("scores Banco do Brasil Visa Altus with non-zero points return", () => {
    const card = getCardById("banco-do-brasil-banco-do-brasil-visa-altus-07dee92c5a");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
    });

    expect(score.pointsRewardMonthlyBrl).toBeGreaterThan(0);
    expect(score.grossRewardMonthlyBrl).toBeGreaterThan(0);
  });

  it("scores Banco do Brasil Visa Altus Liv with non-zero points return", () => {
    const card = getCardById("banco-do-brasil-banco-do-brasil-visa-altus-liv-0ba9e1e5c9");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
    });

    expect(score.pointsRewardMonthlyBrl).toBeGreaterThan(0);
    expect(score.grossRewardMonthlyBrl).toBeGreaterThan(0);
  });

  it("scores Itaú Uniclass Black with non-zero rewards and premium benefits", () => {
    const card = getCardById("itau-uniclass-black");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
    });

    expect(score.grossRewardMonthlyBrl).toBeGreaterThan(0);
    expect(score.intangibleMonthlyValueBrl).toBeGreaterThan(0);
    expect(score.dataQualityNotes.join(" ")).not.toMatch(/Sem taxa de retorno estruturada/);
  });

  it("scores Petrobras Visa as no-fee card with statement-credit rewards", () => {
    const card = getCardById("banco-do-brasil-petrobras-visa");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile, "profile", {
      ...DEFAULT_VALUE_ASSUMPTIONS,
      ptaxBrlPerUsd: 5,
    });

    expect(score.effectiveAnnualFeeBrl).toBe(0);
    expect(score.grossRewardMonthlyBrl).toBeGreaterThan(0);
    expect(card!.reward_return.has_cashlike_return).toBe(true);
    expect(card!.facets_boolean.earn_cashback).toBe(true);
    expect(card!.reward_return.earning_summary).toContain("desconto na fatura");
    expect(
      card!.characteristics?.some((item) => String(item.value).includes("Posto Preferido"))
    ).toBe(true);
  });

  it("scores Dotz BV Mastercard Platinum as cashback, not points", () => {
    const card = getCardById("banco-bv-dotz-bv-mastercard-platinum-34f0748cf2");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile);

    expect(score.effectiveAnnualFeeBrl).toBe(259);
    expect(score.cashlikeRewardMonthlyBrl).toBe(18);
    expect(score.pointsRewardMonthlyBrl).toBe(0);
    expect(card!.reward_return.has_cashlike_return).toBe(true);
    expect(card!.reward_return.earning_summary).toBe("0,6% de cashback");
    expect(card!.facets_boolean.earn_cashback).toBe(true);
    expect(card!.facets_boolean.earn_points_or_miles).toBe(false);
    expect(card!.lounge_access.has_lounge_access).toBe(false);
  });

  it("does not silently zero cards with explicit numeric points or cashback", () => {
    const auditProfile: UserProfile = {
      ...baseProfile,
      avgInvestedBrl: 100_000,
      monthlyInternationalSpendBrl: 500,
    };
    const brokenCards = getAllCards().filter((card) => {
      if (!hasExplicitNumericRewardSignal(card)) return false;
      if (!card.facets_boolean.earn_points_or_miles && !card.reward_return.has_cashlike_return)
        return false;

      const score = scoreCardValue(card, auditProfile);
      return score.grossRewardMonthlyBrl === 0;
    });

    expect(brokenCards.map((card) => card.display_name)).toEqual([]);
  });

  it("does not leave premium point claims without a structured earning rate", () => {
    const unstructuredPremiumClaims = getAllCards().filter((card) => {
      if (!isPremiumVariant(card)) return false;
      if (!card.facets_boolean.earn_points_or_miles) return false;

      const text = rewardAuditText(card);
      return /\bpontos?\s+por\s+d[oó]lar\b/i.test(text) && !hasExplicitNumericRewardSignal(card);
    });

    expect(unstructuredPremiumClaims.map((card) => card.display_name)).toEqual([]);
  });

  it("does not give zero card-value to premium cards that declare rewards or benefits", () => {
    const zeroValuePremiumCards = getAllCards().filter((card) => {
      if (!isPremiumVariant(card)) return false;

      const declaresValue =
        hasExplicitNumericRewardSignal(card) ||
        card.lounge_access.has_lounge_access ||
        card.facets_boolean.mentions_travel_insurance ||
        card.facets_boolean.mentions_concierge;
      if (!declaresValue) return false;

      const score = scoreCardValue(card, baseProfile);
      return score.grossRewardMonthlyBrl === 0 && score.intangibleMonthlyValueBrl === 0;
    });

    expect(zeroValuePremiumCards.map((card) => card.display_name)).toEqual([]);
  });

  it("cards with only 'até X pontos por dólar' earning data produce non-zero gross return", () => {
    // These cards previously returned R$0 because their earning rate was phrased as
    // a ceiling ("até X pts/USD") and was silently dropped. The fix uses the ceiling
    // rate as a conservative fallback when no other structured rate is present.
    const allCards = getAllCards();
    const brokenCards = allCards.filter((card) => {
      if (!card.facets_boolean?.earn_points_or_miles) return false;
      const summary = card.reward_return?.earning_summary ?? "";
      // Only check cards whose earning is expressed as a per-dollar ceiling
      if (!/até\s+\d.*pontos?\s+por\s+(d[oó]lar|usd)/i.test(summary)) return false;
      const earningChars = (card.characteristics ?? []).filter(
        (c) => c.key === "earning_rate" || c.key === "earning_detail"
      );
      const allTexts = [summary, ...earningChars.map((c) => String(c.value))];
      // Only flag cards where every earning text is ceiling-only (no domestic/international split)
      const hasSplit = allTexts.some((t) => /brasil|nacion|exterior|internacion/i.test(t));
      if (hasSplit) return false;
      const score = scoreCardValue(card, baseProfile);
      return score.grossRewardMonthlyBrl === 0 && score.pointsRewardMonthlyBrl === 0;
    });
    expect(brokenCards.map((c) => c.display_name)).toEqual([]);
  });

  it("applies Centurion account-holder annual fee condition", () => {
    const card = getCardById("bradesco-bradesco-american-express-the-centurion-card-6d6ffcfe73");
    expect(card).toBeDefined();

    const score = scoreCardValue(card!, baseProfile);

    expect(score.effectiveAnnualFeeBrl).toBe(18_000);
    expect(score.feeAppliedReason).toBe("Anuidade efetiva de R$18.000 após regra estruturada.");
    expect(score.dataQualityNotes).toContain(
      "Anuidade de correntista aplicada por condição estruturada."
    );
  });

  it("caps Bradesco Like Visa category-restricted cashback and prevents top-10 false ranking", () => {
    const card = getCardById("bradesco-bradesco-like-visa-bb515842d5");
    expect(card).toBeDefined();

    // At R$3,000/mo spend: 10% in apps at 5% = R$15 (cap) + 25% in chosen package at 3% = R$22.50 -> R$37.50 gross.
    // Minus R$50/mo annual fee (R$600/yr) = -R$12.50/mo net decision value.
    const s3k = scoreCardValue(card!, { ...baseProfile, avgMonthlySpendBrl: 3_000 });
    expect(s3k.effectiveAnnualFeeBrl).toBe(600);
    expect(s3k.cashlikeRewardMonthlyBrl).toBe(37.5);
    expect(s3k.decisionMonthlyValueBrl).toBe(-12.5);
    expect(s3k.verdict).toBe("Tende a destruir valor neste perfil.");

    // At R$6,500/mo spend, R$18k salary, R$150k invested:
    // R$15 (apps cap) + R$48.75 (25% * 6500 * 3%) = R$63.75 gross - R$50 fee = +R$13.75/mo (not R$325/mo!).
    const highProfile: UserProfile = {
      ...baseProfile,
      monthlySalaryBrl: 18_000,
      avgMonthlySpendBrl: 6_500,
      avgInvestedBrl: 150_000,
    };
    const s65k = scoreCardValue(card!, highProfile);
    expect(s65k.cashlikeRewardMonthlyBrl).toBe(63.75);
    expect(s65k.decisionMonthlyValueBrl).toBe(13.75);

    const top10Ids = scoreCardValues(getAllCards(), highProfile)
      .slice(0, 10)
      .map((s) => s.card.card_stable_id);
    expect(top10Ids).not.toContain("bradesco-bradesco-like-visa-bb515842d5");
  });

  it("applies spend-tiered cashback and points rates accurately across spend levels", () => {
    // PagBank: 0.5% below R$3,000, 1.0% from R$3,000+
    const pagbank = getCardById("pagbank-cartao-de-credito")!;
    expect(
      scoreCardValue(pagbank, { ...baseProfile, avgMonthlySpendBrl: 1_500 })
        .cashlikeRewardMonthlyBrl
    ).toBe(7.5);
    expect(
      scoreCardValue(pagbank, { ...baseProfile, avgMonthlySpendBrl: 3_000 })
        .cashlikeRewardMonthlyBrl
    ).toBe(30);

    // BV Único Visa Infinite: 0.3% up to R$3k, 0.5% from R$3k to R$6k, 0.8% from R$6k to R$10k, 1.5% above R$10k
    const bvUnico = getCardById("banco-bv-bv-unico-visa-infinite-7cbc5d3c85")!;
    expect(
      scoreCardValue(bvUnico, { ...baseProfile, avgMonthlySpendBrl: 2_000 })
        .cashlikeRewardMonthlyBrl
    ).toBe(6);
    expect(
      scoreCardValue(bvUnico, { ...baseProfile, avgMonthlySpendBrl: 5_000 })
        .cashlikeRewardMonthlyBrl
    ).toBe(25);
    expect(
      scoreCardValue(bvUnico, { ...baseProfile, avgMonthlySpendBrl: 12_000 })
        .cashlikeRewardMonthlyBrl
    ).toBe(180);

    // Porto Bank Mastercard Black: 2.5 pts/USD up to R$20k, 3.5 pts/USD above R$20k
    const portoBlack = getCardById("porto-bank-porto-bank-mastercard-black-f201dd088d")!;
    const porto10k = scoreCardValue(
      portoBlack,
      { ...baseProfile, monthlySalaryBrl: 20_000, avgMonthlySpendBrl: 10_000 },
      "profile",
      { ...DEFAULT_VALUE_ASSUMPTIONS, ptaxBrlPerUsd: 5 }
    );
    const porto25k = scoreCardValue(
      portoBlack,
      { ...baseProfile, monthlySalaryBrl: 20_000, avgMonthlySpendBrl: 25_000 },
      "profile",
      { ...DEFAULT_VALUE_ASSUMPTIONS, ptaxBrlPerUsd: 5 }
    );
    // At R$10k / PTAX 5 = US$2,000 * 2.5 pts = 5,000 pts * R$22/1k = R$110
    expect(porto10k.pointsRewardMonthlySaleBrl).toBe(110);
    // At R$25k / PTAX 5 = US$5,000 * 3.5 pts = 17,500 pts * R$22/1k = R$385
    expect(porto25k.pointsRewardMonthlySaleBrl).toBe(385);

    // Itaú Personnalité Visa Infinite: 2.0 pts/USD domestic (not 2.0 pts/BRL)
    const personnaliteVi = getCardById("itau-itau-personnalite-visa-infinite-194dedbeda")!;
    const pScore = scoreCardValue(
      personnaliteVi,
      {
        ...baseProfile,
        monthlySalaryBrl: 18_000,
        avgMonthlySpendBrl: 5_000,
        avgInvestedBrl: 50_000,
      },
      "profile",
      { ...DEFAULT_VALUE_ASSUMPTIONS, ptaxBrlPerUsd: 5 }
    );
    expect(pScore.eligible).toBe(true);
    // R$5,000 / PTAX 5 = US$1,000 * 2.0 pts/USD = 2,000 pts * R$22/1k = R$44
    expect(pScore.pointsRewardMonthlySaleBrl).toBe(44);
  });
});

function fakeScore(partial: Partial<CardValueScore>): CardValueScore {
  return {
    eligible: true,
    feeKnown: true,
    decisionMonthlyValueBrl: 0,
    netMonthlyValueBrl: 0,
    netMonthlyValueRangeHighBrl: 0,
    score0To100: 0,
    ...partial,
  } as CardValueScore;
}

describe("netMonthlyValueForRanking", () => {
  it("is the decision value for every travel frequency", () => {
    const s = fakeScore({
      netMonthlyValueBrl: 100,
      netMonthlyValueRangeHighBrl: 300,
      decisionMonthlyValueBrl: 200,
    });
    for (const travelFrequency of ["none", "occasional", "frequent"] as const) {
      expect(netMonthlyValueForRanking(s, { ...baseProfile, travelFrequency })).toBe(200);
    }
  });

  it("decision value = venda + p × (viagem − venda), p by declared frequency only", () => {
    // p: none 0, occasional 0,5, frequent 0,8.
    expect(decisionMonthlyValue(100, 300, { ...baseProfile, travelFrequency: "none" })).toBe(100);
    expect(decisionMonthlyValue(100, 300, { ...baseProfile, travelFrequency: "occasional" })).toBe(
      200
    );
    expect(decisionMonthlyValue(100, 300, { ...baseProfile, travelFrequency: "frequent" })).toBe(
      260
    );
    const noneButLikesPoints: UserProfile = {
      ...baseProfile,
      travelFrequency: "none",
      preferences: { ...baseProfile.preferences, prefersPoints: true, wantsLounge: true },
    };
    expect(decisionMonthlyValue(100, 300, noneButLikesPoints)).toBe(100);
  });
});

describe("travelFrequencyForValueModeling", () => {
  it('keeps "não viajo" even when the user prefers points or wants lounge', () => {
    const withPoints: UserProfile = {
      ...baseProfile,
      travelFrequency: "none",
      preferences: { ...baseProfile.preferences, prefersPoints: true, wantsLounge: false },
    };
    const withLounge: UserProfile = {
      ...baseProfile,
      travelFrequency: "none",
      preferences: { ...baseProfile.preferences, prefersPoints: false, wantsLounge: true },
    };
    expect(travelFrequencyForValueModeling(withPoints)).toBe("none");
    expect(travelFrequencyForValueModeling(withLounge)).toBe("none");
  });

  it("keeps declared frequency when not none", () => {
    expect(travelFrequencyForValueModeling({ ...baseProfile, travelFrequency: "frequent" })).toBe(
      "frequent"
    );
  });
});

describe("compareCardValueScores + applyPercentileScores", () => {
  it("orders eligible → known fee → decision value", () => {
    const ineligibleHigh = fakeScore({ eligible: false, decisionMonthlyValueBrl: 999 });
    const unknownFeeHigh = fakeScore({ feeKnown: false, decisionMonthlyValueBrl: 500 });
    const knownLow = fakeScore({ decisionMonthlyValueBrl: 10 });
    const knownHigh = fakeScore({ decisionMonthlyValueBrl: 50 });
    const sorted = [ineligibleHigh, unknownFeeHigh, knownLow, knownHigh].sort(
      compareCardValueScores
    );
    expect(sorted).toEqual([knownHigh, knownLow, unknownFeeHigh, ineligibleHigh]);
  });

  it("score is the percentile among eligible cards; ties share it; ineligible is 0", () => {
    const sorted = [
      fakeScore({ decisionMonthlyValueBrl: 50 }),
      fakeScore({ decisionMonthlyValueBrl: 50 }),
      fakeScore({ decisionMonthlyValueBrl: 10 }),
      fakeScore({ feeKnown: false, decisionMonthlyValueBrl: 80 }),
      fakeScore({ eligible: false, decisionMonthlyValueBrl: 999 }),
    ];
    // 4 elegíveis → índices 0..3: 100, 100 (empate), 100 × (1 − 2/3) = 33, 0.
    expect(applyPercentileScores(sorted).map((s) => s.score0To100)).toEqual([100, 100, 33, 0, 0]);
  });
});
