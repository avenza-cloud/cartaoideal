import { describe, expect, it } from "vitest";
import {
  feeWaiverBadgesForCard,
  feeWaiverBadgesFromRules,
  feeWaiverRuleDisplayLabel,
} from "@/lib/fee-waiver-badges";
import { getCardById } from "@/lib/cards";
import type { FeeWaiverRule, UserProfile } from "@/types/cards";

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

describe("feeWaiverBadges", () => {
  it("investment vem antes de gasto quando ambas as isenções existem", () => {
    const rules: FeeWaiverRule[] = [
      {
        category: "monthly_spend",
        threshold_brl: 5000,
        period: "monthly",
        full_waiver: true,
        description: "Gasto",
        raw_text: "x",
      },
      {
        category: "investment",
        threshold_brl: 50000,
        full_waiver: true,
        description: "Investimento",
        raw_text: "x",
      },
    ];
    const badges = feeWaiverBadgesFromRules(rules, 1068);
    expect(badges.map((b) => b.key)).toEqual(["investment", "monthly_spend"]);
    expect(badges[0]?.label).toBe("Isento por investimento");
    expect(badges[1]?.label).toBe("Anuidade se paga");
  });

  it("com perfil que já isenta por investimento, omite badge âmbar de gasto alto", () => {
    const rules: FeeWaiverRule[] = [
      {
        category: "monthly_spend",
        threshold_brl: 5000,
        period: "monthly",
        full_waiver: true,
        description: "Gasto",
        raw_text: "x",
      },
      {
        category: "investment",
        threshold_brl: 50000,
        full_waiver: true,
        description: "Investimento",
        raw_text: "x",
      },
    ];
    const profile: UserProfile = { ...baseProfile, avgInvestedBrl: 60_000 };
    const badges = feeWaiverBadgesFromRules(rules, 1068, profile);
    expect(badges).toHaveLength(1);
    expect(badges[0]?.key).toBe("investment");
    expect(badges[0]?.label).toBe("Isento por investimento");
  });

  it("PicPay Epic + investimento acima do piso — só badge de investimento", () => {
    const card = getCardById("picpay-picpay-epic-8a1bb7c054");
    expect(card).toBeDefined();
    const profile: UserProfile = { ...baseProfile, avgInvestedBrl: 60_000 };
    const badges = feeWaiverBadgesForCard(card!, profile);
    expect(badges.some((b) => b.label === "Anuidade se paga")).toBe(false);
    expect(badges.some((b) => b.key === "investment")).toBe(true);
  });

  it("C6 Mastercard Black — anuidade cobrada por padrão: badge não diz 'Isento por gasto'", () => {
    const card = getCardById("c6-bank-c6-mastercard-black-42584fec91");
    expect(card).toBeDefined();
    const badges = feeWaiverBadgesForCard(card!);
    const spend = badges.find((b) => b.key === "monthly_spend");
    expect(spend).toBeDefined();
    expect(spend!.label).toBe("Anuidade se paga");
    expect(spend!.variant).toBe("paid_fee_default");
  });

  it("isenção por gasto com anuidade R$ 0 — mantém 'Isento por gasto'", () => {
    const rules: FeeWaiverRule[] = [
      {
        category: "monthly_spend",
        threshold_brl: 3000,
        period: "monthly",
        full_waiver: true,
        description: "test",
        raw_text: "test",
      },
    ];
    const badges = feeWaiverBadgesFromRules(rules, 0);
    expect(badges[0]?.label).toBe("Isento por gasto");
    expect(badges[0]?.variant).toBe("waiver_benefit");
  });

  it("feeWaiverRuleDisplayLabel alinha com badges para monthly_spend + anuidade > 0", () => {
    const rule: FeeWaiverRule = {
      category: "monthly_spend",
      threshold_brl: 5000,
      period: "monthly",
      full_waiver: true,
      description: "x",
      raw_text: "x",
    };
    expect(feeWaiverRuleDisplayLabel(rule, 600)).toBe("Anuidade se paga");
    expect(feeWaiverRuleDisplayLabel(rule, 0)).toBe("Isento por gasto");
  });

  it("RecargaPay Mastercard Platinum — isenção com R$ 1k/mês: 'Isento por gasto'", () => {
    const card = getCardById("recargapay-recargapay-mastercard-platinum-cbed0936fe");
    expect(card).toBeDefined();
    const badges = feeWaiverBadgesForCard(card!);
    const spend = badges.find((b) => b.key === "monthly_spend");
    expect(spend).toBeDefined();
    expect(spend!.label).toBe("Isento por gasto");
    expect(spend!.variant).toBe("waiver_benefit");
  });

  it("meta de isenção integral < R$ 4k/mês + anuidade > 0 — mantém 'Isento por gasto'", () => {
    const rules: FeeWaiverRule[] = [
      {
        category: "monthly_spend",
        threshold_brl: 3999,
        period: "monthly",
        full_waiver: true,
        description: "test",
        raw_text: "test",
      },
    ];
    const badges = feeWaiverBadgesFromRules(rules, 600);
    expect(badges[0]?.label).toBe("Isento por gasto");
    expect(badges[0]?.variant).toBe("waiver_benefit");
  });

  it("meta de isenção integral >= R$ 4k/mês + anuidade > 0 — 'Anuidade se paga'", () => {
    const rules: FeeWaiverRule[] = [
      {
        category: "monthly_spend",
        threshold_brl: 4000,
        period: "monthly",
        full_waiver: true,
        description: "test",
        raw_text: "test",
      },
    ];
    const badges = feeWaiverBadgesFromRules(rules, 600);
    expect(badges[0]?.label).toBe("Anuidade se paga");
    expect(badges[0]?.variant).toBe("paid_fee_default");
  });
});
